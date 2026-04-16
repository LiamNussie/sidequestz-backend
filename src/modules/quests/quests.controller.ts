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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CreateQuestDto } from './dto/create-quest.dto';
import { GetMyQuestsQueryDto } from './dto/get-my-quests-query.dto';
import { GetQuestSubmissionsQueryDto } from './dto/get-quest-submissions-query.dto';
import { GetQuestsQueryDto } from './dto/get-quests-query.dto';
import { SubmitQuestDto } from './dto/submit-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import type {
  PaginatedQuestSubmissions,
  SubmitQuestResponse,
} from './quests-responses.types';
import { QuestsService } from './quests.service';

@UseGuards(AccessTokenGuard)
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  findAll(@Query() query: GetQuestsQueryDto) {
    return this.questsService.findAll(query);
  }

  @Get('me')
  async findMySubmissions(
    @CurrentUser('userId') userId: string,
    @Query() query: GetMyQuestsQueryDto,
  ): Promise<PaginatedQuestSubmissions> {
    return await this.questsService.findMySubmissions(userId, query);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('submissions')
  async findAllSubmissions(
    @Query() query: GetQuestSubmissionsQueryDto,
  ): Promise<PaginatedQuestSubmissions> {
    return await this.questsService.findAllSubmissions(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questsService.findOne(id);
  }

  @Post('submit')
  async submitQuest(
    @Body() submitQuestDto: SubmitQuestDto,
    @CurrentUser('userId') userId: string,
  ): Promise<SubmitQuestResponse> {
    return await this.questsService.submitQuest(userId, submitQuestDto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createQuestDto: CreateQuestDto) {
    return this.questsService.create(createQuestDto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuestDto: UpdateQuestDto) {
    return this.questsService.update(id, updateQuestDto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questsService.remove(id);
  }
}
