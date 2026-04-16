import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PUSH_PLATFORMS } from '../schemas/push-device.schema';
import type { PushPlatform } from '../schemas/push-device.schema';

export class RegisterPushDeviceDto {
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token: string;

  @IsIn([...PUSH_PLATFORMS])
  platform: PushPlatform;
}
