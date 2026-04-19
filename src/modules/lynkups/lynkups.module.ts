import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { Lynkup, LynkupSchema } from './schemas/lynkup.schema';
import { LynkupsController } from './lynkups.controller';
import { LynkupsService } from './lynkups.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Lynkup.name, schema: LynkupSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [LynkupsController],
  providers: [LynkupsService],
  exports: [LynkupsService],
})
export class LynkupsModule {}
