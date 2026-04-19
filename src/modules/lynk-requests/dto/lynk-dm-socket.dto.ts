import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class JoinLynkDmSocketDto {
  @IsMongoId()
  conversationId: string;
}

export class SendLynkDmMessageSocketDto {
  @IsMongoId()
  conversationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
