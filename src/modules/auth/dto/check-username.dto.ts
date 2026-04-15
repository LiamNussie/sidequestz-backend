import { IsString, MaxLength, MinLength } from 'class-validator';

export class CheckUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;
}
