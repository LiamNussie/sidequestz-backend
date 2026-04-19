import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class LynkupChatRoomDto {
  @IsMongoId()
  lynkupId: string;
}

export class SendLynkupChatMessageSocketDto {
  @IsMongoId()
  lynkupId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
