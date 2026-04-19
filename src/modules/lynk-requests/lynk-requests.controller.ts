import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { ListLynkRequestsQueryDto } from './dto/list-lynk-requests-query.dto';
import { LynkRequestsService } from './lynk-requests.service';

@UseGuards(AccessTokenGuard)
@Controller('lynk-requests')
export class LynkRequestsController {
  constructor(private readonly lynkRequestsService: LynkRequestsService) {}

  @Get('users/:userId/preview')
  getUserPreview(
    @Param('userId') userId: string,
    @CurrentUser('userId') viewerId: string,
  ) {
    return this.lynkRequestsService.getPreview(viewerId, userId);
  }

  @Get('incoming')
  listIncoming(
    @CurrentUser('userId') userId: string,
    @Query() query: ListLynkRequestsQueryDto,
  ) {
    return this.lynkRequestsService.listIncoming(userId, query);
  }

  @Get('outgoing')
  listOutgoing(
    @CurrentUser('userId') userId: string,
    @Query() query: ListLynkRequestsQueryDto,
  ) {
    return this.lynkRequestsService.listOutgoing(userId, query);
  }
}
