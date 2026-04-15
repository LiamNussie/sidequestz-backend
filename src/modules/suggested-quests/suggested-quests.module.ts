import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SuggestedQuestsController } from './suggested-quests.controller';
import { SuggestedQuestsService } from './suggested-quests.service';
import {
  SuggestedQuest,
  SuggestedQuestSchema,
} from './schemas/suggested-quest.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SuggestedQuest.name, schema: SuggestedQuestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SuggestedQuestsController],
  providers: [SuggestedQuestsService],
})
export class SuggestedQuestsModule {}
