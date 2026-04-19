import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { LynkupsModule } from '../lynkups/lynkups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  LynkupChatMessage,
  LynkupChatMessageSchema,
} from './schemas/lynkup-chat-message.schema';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: LynkupChatMessage.name, schema: LynkupChatMessageSchema },
    ]),
    LynkupsModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
