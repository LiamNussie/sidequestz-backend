import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class SocialsDto {
  @IsOptional()
  @IsString()
  x?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;
}

export class CompleteOnboardingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  avatar: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  profileImages?: string[];

  @ValidateNested()
  @IsDefined()
  @Type(() => SocialsDto)
  socials: SocialsDto;
}
