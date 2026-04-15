import { ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateSuggestedQuestDto {
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
}
