import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import {
  LynkDmConversation,
  LynkDmConversationDocument,
} from './schemas/lynk-dm-conversation.schema';
import {
  LynkDmMessage,
  LynkDmMessageDocument,
} from './schemas/lynk-dm-message.schema';

export type LynkDmMessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class LynkDmService {
  constructor(
    @InjectModel(LynkDmConversation.name)
    private readonly conversationModel: Model<LynkDmConversationDocument>,
    @InjectModel(LynkDmMessage.name)
    private readonly messageModel: Model<LynkDmMessageDocument>,
  ) {}

  toMessageRow(doc: LynkDmMessageDocument): LynkDmMessageRow {
    return {
      id: String(doc.id),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      body: doc.body,
      createdAt: doc.createdAt,
    };
  }

  async findOrCreateConversation(
    userIdA: string,
    userIdB: string,
  ): Promise<LynkDmConversationDocument> {
    const [a, b] = sortedPair(userIdA, userIdB);
    const existing = await this.conversationModel
      .findOne({ participants: [a, b] })
      .exec();
    if (existing) {
      return existing;
    }
    try {
      return await this.conversationModel.create({ participants: [a, b] });
    } catch {
      const again = await this.conversationModel
        .findOne({ participants: [a, b] })
        .exec();
      if (again) {
        return again;
      }
      throw new BadRequestException('Could not create conversation');
    }
  }

  async requireParticipant(
    conversationId: string,
    userId: string,
  ): Promise<LynkDmConversationDocument> {
    if (!isValidObjectId(conversationId)) {
      throw new BadRequestException('Invalid conversation id');
    }
    const conv = await this.conversationModel.findById(conversationId).exec();
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    if (!conv.participants.includes(userId)) {
      throw new NotFoundException('Conversation not found');
    }
    return conv;
  }

  async conversationExistsBetween(
    userIdA: string,
    userIdB: string,
  ): Promise<boolean> {
    const [a, b] = sortedPair(userIdA, userIdB);
    const n = await this.conversationModel
      .countDocuments({ participants: [a, b] })
      .exec();
    return n > 0;
  }

  async appendMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ): Promise<LynkDmMessageDocument> {
    await this.requireParticipant(conversationId, senderId);
    const body = text.trim();
    if (!body) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (body.length > 2000) {
      throw new BadRequestException('Message is too long');
    }
    return this.messageModel.create({
      conversationId,
      senderId,
      body,
    });
  }

  async listMessages(
    conversationId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: LynkDmMessageRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    await this.requireParticipant(conversationId, userId);
    const skip = (page - 1) * limit;
    const filter = { conversationId };
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
      data: docs.map((d) => this.toMessageRow(d)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
