import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoreModule } from './core/core.module';
import { AppConfigService } from './core/config/app-config.service';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { QuestPostsModule } from './modules/quest-posts/quest-posts.module';
import { QuestsModule } from './modules/quests/quests.module';
import { SuggestedQuestsModule } from './modules/suggested-quests/suggested-quests.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    CoreModule,
    MongooseModule.forRootAsync({
      imports: [CoreModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        uri: appConfig.getMongoUri(),
      }),
    }),
    UsersModule,
    AuthModule,
    QuestsModule,
    QuestPostsModule,
    SuggestedQuestsModule,
    HealthModule,
    LeaderboardModule,
  ],
})
export class AppModule {}
