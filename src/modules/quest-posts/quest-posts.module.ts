import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  QuestSubmission,
  QuestSubmissionSchema,
} from '../quests/schemas/quest-submission.schema';
import { QuestPostsController } from './quest-posts.controller';
import { QuestPostsService } from './quest-posts.service';
import { QuestPost, QuestPostSchema } from './schemas/quest-post.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: QuestPost.name, schema: QuestPostSchema },
      { name: QuestSubmission.name, schema: QuestSubmissionSchema },
    ]),
  ],
  controllers: [QuestPostsController],
  providers: [QuestPostsService],
})
export class QuestPostsModule {}
