import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuestPostDto {
  @IsMongoId()
  submissionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  caption: string;
}
