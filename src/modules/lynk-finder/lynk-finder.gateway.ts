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
import { UpdateLocationDto } from './dto/update-location.dto';
import { LynkFinderSocketRegistry } from './lynk-finder-socket-registry.service';
import { LynkFinderService } from './lynk-finder.service';

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
  namespace: '/lynkFinder',
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
export class LynkFinderGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly lynkFinderService: LynkFinderService,
    private readonly registry: LynkFinderSocketRegistry,
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
      client.data.lynkFinderOn = false;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    void this.handleGoOffline(client);
  }

  @SubscribeMessage('goOnline')
  async goOnline(@ConnectedSocket() client: Socket): Promise<{ ok: true }> {
    try {
      const userId = this.requireSocketUserId(client);
      client.data.lynkFinderOn = true;
      this.registry.add(userId, client.id);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('goOffline')
  async goOffline(@ConnectedSocket() client: Socket): Promise<{ ok: true }> {
    try {
      await this.handleGoOffline(client);
      return { ok: true };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  @SubscribeMessage('updateLocation')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: UpdateLocationDto,
  ): Promise<{ ok: true; peers: unknown[]; throttled: boolean }> {
    try {
      const userId = this.requireSocketUserId(client);
      if (!client.data.lynkFinderOn) {
        throw new WsException('Call goOnline before updateLocation');
      }

      const { peers, throttled } = await this.lynkFinderService.upsertLocation(
        userId,
        body.lat,
        body.lng,
      );

      if (!throttled) {
        client.emit('nearby', { peers });

        const payload = {
          userId,
          lat: body.lat,
          lng: body.lng,
        };
        for (const p of peers) {
          for (const socketId of this.registry.getSocketIds(p.userId)) {
            if (socketId === client.id) {
              continue;
            }
            this.server.to(socketId).emit('peerLocation', payload);
          }
        }
      }

      return { ok: true, peers, throttled };
    } catch (err: unknown) {
      throw this.toWsException(err);
    }
  }

  private async handleGoOffline(client: Socket): Promise<void> {
    const userId = client.data.userId;
    if (typeof userId !== 'string') {
      return;
    }
    client.data.lynkFinderOn = false;
    const removed = this.registry.removeSocket(client.id);
    if (!removed?.empty) {
      return;
    }
    const notifyIds =
      await this.lynkFinderService.listNeighborUserIdsForUser(userId);
    await this.lynkFinderService.removeUser(userId);
    for (const peerId of notifyIds) {
      for (const socketId of this.registry.getSocketIds(peerId)) {
        this.server.to(socketId).emit('peerLeft', { userId });
      }
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
