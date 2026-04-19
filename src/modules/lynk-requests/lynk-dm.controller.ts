import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ListDmMessagesQueryDto } from './dto/list-dm-messages-query.dto';
import { LynkDmService } from './lynk-dm.service';

@UseGuards(AccessTokenGuard)
@Controller('lynk-dm')
export class LynkDmController {
  constructor(private readonly lynkDmService: LynkDmService) {}

  @Get('conversations/:conversationId/messages')
  listMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: ListDmMessagesQueryDto,
  ) {
    return this.lynkDmService.listMessages(
      conversationId,
      userId,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }
}
