import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import type { UserGender } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LynkDmService } from './lynk-dm.service';
import { ListLynkRequestsQueryDto } from './dto/list-lynk-requests-query.dto';
import {
  LynkRequest,
  LynkRequestDocument,
  LynkRequestStatus,
} from './schemas/lynk-request.schema';

export type PublicLynkProfile = {
  id: string;
  name: string;
  gender: UserGender | null;
  avatar: string | null;
};

export type LynkRequestRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: LynkRequestStatus;
  createdAt: Date;
  fromUser?: PublicLynkProfile;
  toUser?: PublicLynkProfile;
};

@Injectable()
export class LynkRequestsService {
  constructor(
    @InjectModel(LynkRequest.name)
    private readonly requestModel: Model<LynkRequestDocument>,
    private readonly usersService: UsersService,
    private readonly lynkDmService: LynkDmService,
  ) {}

  toPublicProfile(user: {
    id: string;
    name: string;
    gender?: UserGender | null;
    avatar?: string | null;
  }): PublicLynkProfile {
    return {
      id: user.id,
      name: user.name,
      gender: user.gender ?? null,
      avatar: user.avatar ?? null,
    };
  }

  async getPreview(
    viewerId: string,
    targetUserId: string,
  ): Promise<PublicLynkProfile> {
    if (!isValidObjectId(targetUserId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (targetUserId === viewerId) {
      throw new BadRequestException('Use your profile screen for your own info');
    }
    const user = await this.usersService.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicProfile(user);
  }

  async createPendingRequest(
    fromUserId: string,
    toUserId: string,
  ): Promise<LynkRequestDocument> {
    if (!isValidObjectId(toUserId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException('You cannot send a lynk request to yourself');
    }
    const target = await this.usersService.findById(toUserId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existsDm = await this.lynkDmService.conversationExistsBetween(
      fromUserId,
      toUserId,
    );
    if (existsDm) {
      throw new ConflictException('You already have a lynk chat with this user');
    }

    try {
      return await this.requestModel.create({
        fromUserId,
        toUserId,
        status: 'pending',
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11_000) {
        throw new ConflictException(
          'A pending lynk request already exists between you and this user',
        );
      }
      throw err;
    }
  }

  async listIncoming(
    userId: string,
    query: ListLynkRequestsQueryDto,
  ): Promise<{
    data: LynkRequestRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    return this.listRequests({ toUserId: userId, status: 'pending' }, query);
  }

  async listOutgoing(
    userId: string,
    query: ListLynkRequestsQueryDto,
  ): Promise<{
    data: LynkRequestRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    return this.listRequests({ fromUserId: userId, status: 'pending' }, query);
  }

  private async listRequests(
    filter: { toUserId?: string; fromUserId?: string; status: LynkRequestStatus },
    query: ListLynkRequestsQueryDto,
  ): Promise<{
    data: LynkRequestRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);

    const data: LynkRequestRow[] = [];
    for (const doc of docs) {
      const fromUser = await this.usersService.findById(doc.fromUserId);
      const toUser = await this.usersService.findById(doc.toUserId);
      data.push({
        id: String(doc.id),
        fromUserId: doc.fromUserId,
        toUserId: doc.toUserId,
        status: doc.status,
        createdAt: doc.createdAt,
        fromUser: fromUser ? this.toPublicProfile(fromUser) : undefined,
        toUser: toUser ? this.toPublicProfile(toUser) : undefined,
      });
    }

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async respondToRequest(
    recipientUserId: string,
    requestId: string,
    action: 'accept' | 'decline',
  ): Promise<{
    status: LynkRequestStatus;
    requestId: string;
    conversationId?: string;
    fromUserId: string;
    toUserId: string;
  }> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request id');
    }

    const updated = await this.requestModel
      .findOneAndUpdate(
        { _id: requestId, toUserId: recipientUserId, status: 'pending' },
        { $set: { status: action === 'accept' ? 'accepted' : 'declined' } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Request not found or already handled');
    }

    if (action === 'decline') {
      return {
        status: 'declined',
        requestId: String(updated.id),
        fromUserId: updated.fromUserId,
        toUserId: updated.toUserId,
      };
    }

    const conv = await this.lynkDmService.findOrCreateConversation(
      updated.fromUserId,
      updated.toUserId,
    );

    return {
      status: 'accepted',
      requestId: String(updated.id),
      conversationId: String(conv.id),
      fromUserId: updated.fromUserId,
      toUserId: updated.toUserId,
    };
  }

  async getRequestForUser(
    requestId: string,
    userId: string,
  ): Promise<LynkRequestDocument> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request id');
    }
    const doc = await this.requestModel.findById(requestId).exec();
    if (!doc) {
      throw new NotFoundException('Request not found');
    }
    if (doc.fromUserId !== userId && doc.toUserId !== userId) {
      throw new ForbiddenException('Not allowed to view this request');
    }
    return doc;
  }
}
