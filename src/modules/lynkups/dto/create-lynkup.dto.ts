import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLynkupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsMongoId()
  eventId: string;

  /** Including the creator; maximum allowed is 6. */
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(6)
  maxParticipants: number;

  /** Only allowed when `maxParticipants` is 2. */
  @IsOptional()
  @IsIn(['male', 'female'])
  participantGender?: 'male' | 'female';
}
