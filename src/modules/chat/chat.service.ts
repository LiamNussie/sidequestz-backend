import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LynkupsService } from '../lynkups/lynkups.service';
import { GetChatMessagesQueryDto } from './dto/get-chat-messages-query.dto';
import {
  LynkupChatMessage,
  LynkupChatMessageDocument,
} from './schemas/lynkup-chat-message.schema';

export type LynkupChatMessageRow = {
  id: string;
  lynkupId: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(LynkupChatMessage.name)
    private readonly messageModel: Model<LynkupChatMessageDocument>,
    private readonly lynkupsService: LynkupsService,
  ) {}

  toRow(doc: LynkupChatMessageDocument): LynkupChatMessageRow {
    return {
      id: String(doc.id),
      lynkupId: doc.lynkupId,
      senderId: doc.senderId,
      body: doc.body,
      createdAt: doc.createdAt,
    };
  }

  async createMessage(
    lynkupId: string,
    senderId: string,
    text: string,
  ): Promise<LynkupChatMessageDocument> {
    await this.lynkupsService.requireParticipantAccess(lynkupId, senderId);

    const body = text.trim();
    if (!body) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (body.length > 2000) {
      throw new BadRequestException('Message is too long');
    }

    return this.messageModel.create({
      lynkupId,
      senderId,
      body,
    });
  }

  async findMessagesForParticipant(
    lynkupId: string,
    userId: string,
    query: GetChatMessagesQueryDto,
  ): Promise<{
    data: LynkupChatMessageRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    await this.lynkupsService.requireParticipantAccess(lynkupId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const filter = { lynkupId };

    const [docs, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);

    return {
      data: docs.map((d) => this.toRow(d)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
