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
import { CreateLynkupDto } from './dto/create-lynkup.dto';
import { GetLynkupsQueryDto } from './dto/get-lynkups-query.dto';
import { UpdateLynkupDto } from './dto/update-lynkup.dto';
import { LynkupsService } from './lynkups.service';

@UseGuards(AccessTokenGuard)
@Controller('lynkups')
export class LynkupsController {
  constructor(private readonly lynkupsService: LynkupsService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLynkupDto,
  ) {
    return this.lynkupsService.create(userId, dto);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.lynkupsService.join(id, userId);
  }

  @Post(':id/exit')
  exit(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.lynkupsService.exit(id, userId);
  }

  @Get()
  findAll(@Query() query: GetLynkupsQueryDto) {
    return this.lynkupsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lynkupsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateLynkupDto,
  ) {
    return this.lynkupsService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.lynkupsService.remove(id, userId);
  }
}
