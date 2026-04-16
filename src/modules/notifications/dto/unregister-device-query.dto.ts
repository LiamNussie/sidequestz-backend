import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnregisterDeviceQueryDto {
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token: string;
}
