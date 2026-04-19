import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { LynkDmController } from './lynk-dm.controller';
import { LynkDmGateway } from './lynk-dm.gateway';
import { LynkDmSocketRegistry } from './lynk-dm-socket-registry.service';
import { LynkDmService } from './lynk-dm.service';
import { LynkRequestsController } from './lynk-requests.controller';
import { LynkRequestsGateway } from './lynk-requests.gateway';
import { LynkRequestsSocketRegistry } from './lynk-requests-socket-registry.service';
import { LynkRequestsService } from './lynk-requests.service';
import {
  LynkDmConversation,
  LynkDmConversationSchema,
} from './schemas/lynk-dm-conversation.schema';
import {
  LynkDmMessage,
  LynkDmMessageSchema,
} from './schemas/lynk-dm-message.schema';
import { LynkRequest, LynkRequestSchema } from './schemas/lynk-request.schema';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: LynkRequest.name, schema: LynkRequestSchema },
      { name: LynkDmConversation.name, schema: LynkDmConversationSchema },
      { name: LynkDmMessage.name, schema: LynkDmMessageSchema },
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [LynkRequestsController, LynkDmController],
  providers: [
    LynkRequestsService,
    LynkDmService,
    LynkRequestsGateway,
    LynkDmGateway,
    LynkRequestsSocketRegistry,
    LynkDmSocketRegistry,
  ],
})
export class LynkRequestsModule {}
