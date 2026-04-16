import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CreateQuestPostDto } from './dto/create-quest-post.dto';
import { GetQuestPostsQueryDto } from './dto/get-quest-posts-query.dto';
import { QuestPostsService } from './quest-posts.service';

@Controller('quest-posts')
export class QuestPostsController {
  constructor(private readonly questPostsService: QuestPostsService) {}

  @Get()
  findAll(@Query() query: GetQuestPostsQueryDto) {
    return this.questPostsService.findAll(query);
  }

  @UseGuards(AccessTokenGuard)
  @Post()
  create(
    @Body() dto: CreateQuestPostDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.questPostsService.create(userId, dto);
  }

  @UseGuards(AccessTokenGuard)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: 'user' | 'admin',
  ) {
    return this.questPostsService.remove(id, userId, role);
  }
}
