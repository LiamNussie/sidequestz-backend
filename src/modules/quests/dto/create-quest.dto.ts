import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { QUEST_DIFFICULTIES } from '../schemas/quest.schema';
import type { QuestDifficulty } from '../schemas/quest.schema';

export class CreateQuestDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(1500)
  description: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  images: string[];

  @IsEnum(QUEST_DIFFICULTIES)
  difficulty: QuestDifficulty;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  instructions: string[];
}
