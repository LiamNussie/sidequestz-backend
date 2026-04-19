import { IsIn, IsMongoId } from 'class-validator';

export class SendLynkRequestSocketDto {
  @IsMongoId()
  toUserId: string;
}

export class RespondLynkRequestSocketDto {
  @IsMongoId()
  requestId: string;

  @IsIn(['accept', 'decline'])
  action: 'accept' | 'decline';
}
