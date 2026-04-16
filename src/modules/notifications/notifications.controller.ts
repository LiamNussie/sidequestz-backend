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
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { UnregisterDeviceQueryDto } from './dto/unregister-device-query.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  findMine(
    @CurrentUser('userId') userId: string,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.notificationsService.findMine(userId, page, limit);
  }

  @Patch('me/read-all')
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser('userId') userId: string,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return this.notificationsService.registerDevice(
      userId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('devices')
  unregisterDevice(
    @CurrentUser('userId') userId: string,
    @Query() query: UnregisterDeviceQueryDto,
  ) {
    return this.notificationsService.unregisterDevice(userId, query.token);
  }
}
