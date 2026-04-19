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
import {
  JoinLynkDmSocketDto,
  SendLynkDmMessageSocketDto,
} from './dto/lynk-dm-socket.dto';
import { lynkDmRoomId } from './lynk-dm-room.util';
import { LynkDmSocketRegistry } from './lynk-dm-socket-registry.service';
import { LynkDmService } from './lynk-dm.service';
import type { LynkDmMessageRow } from './lynk-dm.service';

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
  namespace: '/lynkDm',
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
export class LynkDmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly lynkDmService: LynkDmService,
    private readonly registry: LynkDmSocketRegistry,
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
      client.data.lynkDmConversationIds = new Set<string>();
      this.registry.add(payload.sub, client.id);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const joined = client.data.lynkDmConversationIds as
      | Set<string>
      | undefined;
    if (joined) {
      for (const cid of joined) {
        void client.leave(lynkDmRoomId(cid));
      }
      joined.clear();
    }
    this.registry.removeSocket(client.id);
  }

  @SubscribeMessage('joinDm')
  async joinDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinLynkDmSocketDto,
  ): Promise<{ ok: true }> {
    try {
      const userId = this.requireSocketUserId(client);
      await this.lynkDmService.requireParticipant(body.conversationId, userId);
      const room = lynkDmRoomId(body.conversationId);
      await client.join(room);
      const joined = client.data.lynkDmConversationIds as Set<string>;
      joined.add(body.conversationId);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('leaveDm')
  async leaveDm(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinLynkDmSocketDto,
  ): Promise<{ ok: true }> {
    try {
      this.requireSocketUserId(client);
      const room = lynkDmRoomId(body.conversationId);
      await client.leave(room);
      const joined = client.data.lynkDmConversationIds as Set<string>;
      joined.delete(body.conversationId);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('sendDmMessage')
  async sendDmMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendLynkDmMessageSocketDto,
  ): Promise<{ ok: true; message: LynkDmMessageRow }> {
    try {
      const userId = this.requireSocketUserId(client);
      const doc = await this.lynkDmService.appendMessage(
        body.conversationId,
        userId,
        body.text,
      );
      const row = this.lynkDmService.toMessageRow(doc);
      this.server.to(lynkDmRoomId(body.conversationId)).emit('dmNewMessage', row);
      return { ok: true, message: row };
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
