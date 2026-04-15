import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { QUEST_DIFFICULTIES } from '../schemas/quest.schema';
import type { QuestDifficulty } from '../schemas/quest.schema';

export class UpdateQuestDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsEnum(QUEST_DIFFICULTIES)
  difficulty?: QuestDifficulty;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instructions?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  activePlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedCount?: number;
}
