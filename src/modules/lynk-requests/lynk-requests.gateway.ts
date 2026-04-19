import { HttpException, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AppConfigService } from '../../core/config/app-config.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  RespondLynkRequestSocketDto,
  SendLynkRequestSocketDto,
} from './dto/lynk-requests-socket.dto';
import { LynkRequestsSocketRegistry } from './lynk-requests-socket-registry.service';
import type { PublicLynkProfile } from './lynk-requests.service';
import { LynkRequestsService } from './lynk-requests.service';

function extractAccessToken(client: Socket): string | undefined {
  const auth = client.handshake.auth as { token?: string } | undefined;
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token;
  }
  const header = client.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const q = client.handshake.query?.token;
  if (typeof q === 'string' && q.length > 0) {
    return q;
  }
  return undefined;
}

@WebSocketGateway({
  namespace: '/lynkRequests',
  cors: { origin: true, credentials: true },
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
)
export class LynkRequestsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly lynkRequestsService: LynkRequestsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly registry: LynkRequestsSocketRegistry,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = extractAccessToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.appConfig.getJwtAccessSecret(),
      });
      client.data.userId = payload.sub;
      this.registry.add(payload.sub, client.id);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.registry.removeSocket(client.id);
  }

  @SubscribeMessage('sendRequest')
  async sendRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendLynkRequestSocketDto,
  ): Promise<{ ok: true; requestId: string }> {
    try {
      const userId = this.requireSocketUserId(client);
      const doc = await this.lynkRequestsService.createPendingRequest(
        userId,
        body.toUserId,
      );
      const requestId = String(doc.id);
      const fromUser = await this.usersService.findById(userId);
      const fromName = fromUser?.name ?? 'Someone';
      const fromProfile: PublicLynkProfile = fromUser
        ? this.lynkRequestsService.toPublicProfile(fromUser)
        : { id: userId, name: fromName, gender: null, avatar: null };

      const incoming = { requestId, fromUser: fromProfile };
      for (const sid of this.registry.getSocketIds(body.toUserId)) {
        this.server.to(sid).emit('lynkRequestIncoming', incoming);
      }

      this.notificationsService.notifyLynkRequestReceived(body.toUserId, {
        requestId,
        fromName,
      });

      return { ok: true, requestId };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('respondToRequest')
  async respondToRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RespondLynkRequestSocketDto,
  ): Promise<{ ok: true; status: string; conversationId?: string }> {
    try {
      const userId = this.requireSocketUserId(client);
      const result = await this.lynkRequestsService.respondToRequest(
        userId,
        body.requestId,
        body.action,
      );

      const fromUser = await this.usersService.findById(result.fromUserId);
      const toUser = await this.usersService.findById(result.toUserId);
      if (!fromUser || !toUser) {
        throw new WsException('User not found');
      }
      const senderProfile = this.lynkRequestsService.toPublicProfile(fromUser);
      const recipientProfile = this.lynkRequestsService.toPublicProfile(toUser);

      const base = {
        requestId: result.requestId,
        status: result.status,
        conversationId: result.conversationId,
      };

      for (const sid of this.registry.getSocketIds(result.fromUserId)) {
        this.server.to(sid).emit('lynkRequestOutcome', {
          ...base,
          peer: recipientProfile,
        });
      }
      for (const sid of this.registry.getSocketIds(result.toUserId)) {
        this.server.to(sid).emit('lynkRequestOutcome', {
          ...base,
          peer: senderProfile,
        });
      }

      if (result.status === 'accepted') {
        this.notificationsService.notifyLynkRequestAccepted(result.fromUserId, {
          requestId: result.requestId,
          conversationId: result.conversationId!,
          peerName: recipientProfile.name,
        });
      } else {
        this.notificationsService.notifyLynkRequestDeclined(result.fromUserId, {
          requestId: result.requestId,
          peerName: recipientProfile.name,
        });
      }

      return {
        ok: true,
        status: result.status,
        conversationId: result.conversationId,
      };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  private requireSocketUserId(client: Socket): string {
    const userId = client.data.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new WsException('Unauthorized');
    }
    return userId;
  }

  private toWsException(err: unknown): WsException {
    if (err instanceof WsException) {
      return err;
    }
    if (err instanceof HttpException) {
      return new WsException(err.message);
    }
    if (err instanceof Error) {
      return new WsException(err.message);
    }
    return new WsException('Request failed');
  }
}
