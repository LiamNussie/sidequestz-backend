import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { UsersModule } from '../users/users.module';
import { Lynkup, LynkupSchema } from './schemas/lynkup.schema';
import { LynkupsController } from './lynkups.controller';
import { LynkupsService } from './lynkups.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Lynkup.name, schema: LynkupSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [LynkupsController],
  providers: [LynkupsService],
})
export class LynkupsModule {}
