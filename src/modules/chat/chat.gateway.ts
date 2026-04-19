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
import { LynkupsService } from '../lynkups/lynkups.service';
import { UsersService } from '../users/users.service';
import { lynkupChatRoomId } from './chat-room.util';
import { ChatService } from './chat.service';
import type { LynkupChatMessageRow } from './chat.service';
import {
  LynkupChatRoomDto,
  SendLynkupChatMessageSocketDto,
} from './dto/lynkup-chat-socket.dto';

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
  namespace: '/chat',
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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly lynkupsService: LynkupsService,
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
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
      client.data.joinedLynkupIds = new Set<string>();
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const joined = client.data.joinedLynkupIds as Set<string> | undefined;
    if (!joined) {
      return;
    }
    for (const lynkupId of joined) {
      void client.leave(lynkupChatRoomId(lynkupId));
    }
    joined.clear();
  }

  @SubscribeMessage('joinLynkup')
  async joinLynkup(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LynkupChatRoomDto,
  ): Promise<{ ok: true }> {
    try {
      const userId = this.requireSocketUserId(client);
      await this.lynkupsService.requireParticipantAccess(body.lynkupId, userId);
      const room = lynkupChatRoomId(body.lynkupId);
      await client.join(room);
      const joined = client.data.joinedLynkupIds as Set<string>;
      joined.add(body.lynkupId);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('leaveLynkup')
  async leaveLynkup(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LynkupChatRoomDto,
  ): Promise<{ ok: true }> {
    try {
      this.requireSocketUserId(client);
      const room = lynkupChatRoomId(body.lynkupId);
      await client.leave(room);
      const joined = client.data.joinedLynkupIds as Set<string> | undefined;
      joined?.delete(body.lynkupId);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendLynkupChatMessageSocketDto,
  ): Promise<{ ok: true; message: LynkupChatMessageRow }> {
    const userId = this.requireSocketUserId(client);
    try {
      const lynkup = await this.lynkupsService.requireParticipantAccess(
        body.lynkupId,
        userId,
      );
      const doc = await this.chatService.createMessage(
        body.lynkupId,
        userId,
        body.text,
      );
      const row = this.chatService.toRow(doc);
      const room = lynkupChatRoomId(body.lynkupId);
      this.server.to(room).emit('newMessage', row);

      const socketsInRoom = await this.server.in(room).fetchSockets();
      const presentUserIds = new Set(
        socketsInRoom.map((s) => String(s.data.userId)),
      );

      const sender = await this.usersService.findById(userId);
      const senderName = sender?.name ?? 'Someone';

      for (const participantId of lynkup.participants) {
        if (participantId === userId) {
          continue;
        }
        if (presentUserIds.has(participantId)) {
          continue;
        }
        this.notificationsService.notifyLynkupChatMessage(participantId, {
          lynkupId: body.lynkupId,
          senderName,
          preview: row.body,
        });
      }

      return { ok: true, message: row };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
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

  private requireSocketUserId(client: Socket): string {
    const userId = client.data.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new WsException('Unauthorized');
    }
    return userId;
  }
}
