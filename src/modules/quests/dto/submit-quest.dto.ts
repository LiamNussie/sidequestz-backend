import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitQuestDto {
  @IsMongoId()
  questId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imageUrls: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  note?: string;
}
