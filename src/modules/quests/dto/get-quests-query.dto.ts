import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { QUEST_DIFFICULTIES } from '../schemas/quest.schema';
import type { QuestDifficulty } from '../schemas/quest.schema';

export class GetQuestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(QUEST_DIFFICULTIES)
  difficulty?: QuestDifficulty;
}
