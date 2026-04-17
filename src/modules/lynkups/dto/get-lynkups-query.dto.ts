import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GetLynkupsQueryDto {
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
  @IsMongoId()
  eventId?: string;

  /** Inclusive lower bound on the linked event’s `date` (ISO 8601). */
  @IsOptional()
  @IsDateString()
  eventDateFrom?: string;

  /** Inclusive upper bound on the linked event’s `date` (ISO 8601). */
  @IsOptional()
  @IsDateString()
  eventDateTo?: string;
}
