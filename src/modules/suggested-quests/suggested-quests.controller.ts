import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CreateSuggestedQuestDto } from './dto/create-suggested-quest.dto';
import { GetSuggestedQuestsQueryDto } from './dto/get-suggested-quests-query.dto';
import { UpdateSuggestedQuestDto } from './dto/update-suggested-quest.dto';
import { SuggestedQuestsService } from './suggested-quests.service';

@UseGuards(AccessTokenGuard)
@Controller('suggested-quests')
export class SuggestedQuestsController {
  constructor(
    private readonly suggestedQuestsService: SuggestedQuestsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateSuggestedQuestDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
  ) {
    return this.suggestedQuestsService.create(dto, userId, email);
  }

  @Get()
  findAll(@Query() query: GetSuggestedQuestsQueryDto) {
    return this.suggestedQuestsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suggestedQuestsService.findOne(id);
  }

  @Post(':id/upvote')
  upvote(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.suggestedQuestsService.upvote(id, userId);
  }

  @Post(':id/downvote')
  downvote(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.suggestedQuestsService.downvote(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSuggestedQuestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.suggestedQuestsService.update(id, dto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: 'user' | 'admin',
  ) {
    return this.suggestedQuestsService.remove(id, userId, role);
  }
}
