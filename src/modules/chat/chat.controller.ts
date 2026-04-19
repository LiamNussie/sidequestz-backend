import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ChatService } from './chat.service';
import { GetChatMessagesQueryDto } from './dto/get-chat-messages-query.dto';

@UseGuards(AccessTokenGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('lynkups/:lynkupId/messages')
  getLynkupMessages(
    @Param('lynkupId') lynkupId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: GetChatMessagesQueryDto,
  ) {
    return this.chatService.findMessagesForParticipant(lynkupId, userId, query);
  }
}
