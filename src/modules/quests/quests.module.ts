import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { Quest, QuestSchema } from './schemas/quest.schema';
import {
  QuestSubmission,
  QuestSubmissionSchema,
} from './schemas/quest-submission.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Quest.name, schema: QuestSchema },
      { name: QuestSubmission.name, schema: QuestSubmissionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [QuestsController],
  providers: [QuestsService],
})
export class QuestsModule {}
