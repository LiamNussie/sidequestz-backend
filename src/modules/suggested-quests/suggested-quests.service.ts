import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateSuggestedQuestDto } from './dto/create-suggested-quest.dto';
import { GetSuggestedQuestsQueryDto } from './dto/get-suggested-quests-query.dto';
import { UpdateSuggestedQuestDto } from './dto/update-suggested-quest.dto';
import {
  SuggestedQuest,
  SuggestedQuestDocument,
} from './schemas/suggested-quest.schema';

@Injectable()
export class SuggestedQuestsService {
  constructor(
    @InjectModel(SuggestedQuest.name)
    private readonly suggestedQuestModel: Model<SuggestedQuestDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreateSuggestedQuestDto,
    creatorId: string,
    creatorEmail: string,
  ): Promise<SuggestedQuestDocument> {
    const doc = await this.suggestedQuestModel.create({
      ...dto,
      creatorId,
      creatorEmail: creatorEmail.toLowerCase(),
    });
    this.notificationsService.notifySuggestedQuestCreated(creatorId, doc.title);
    return doc;
  }

  async findAll(query: GetSuggestedQuestsQueryDto): Promise<{
    data: Array<
      Record<string, unknown> & {
        creator: {
          id: string;
          username: string | null;
          avatar: string | null;
        };
      }
    >;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.suggestedQuestModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.suggestedQuestModel.countDocuments({}).exec(),
    ]);

    const creatorIds = Array.from(new Set(data.map((item) => item.creatorId)));
    const creators = await this.userModel
      .find({ _id: { $in: creatorIds } })
      .select('_id username avatar')
      .lean()
      .exec();

    const creatorMap = new Map(
      creators.map((creator) => [
        String(creator._id),
        {
          id: String(creator._id),
          username: (creator as { username?: string | null }).username ?? null,
          avatar: (creator as { avatar?: string | null }).avatar ?? null,
        },
      ]),
    );

    const mappedData = data.map((item) => {
      const rest = item.toObject() as unknown as {
        creatorId?: string;
        creatorEmail?: string;
        [key: string]: unknown;
      };
      delete rest.creatorId;
      delete rest.creatorEmail;
      const creator = creatorMap.get(item.creatorId) ?? {
        id: item.creatorId,
        username: null,
        avatar: null,
      };

      // Return compact creator object instead of exposing creatorId/email separately.
      return {
        ...rest,
        creator,
      };
    });

    return {
      data: mappedData,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<SuggestedQuestDocument> {
    const quest = await this.suggestedQuestModel.findById(id).exec();
    if (!quest) {
      throw new NotFoundException('Suggested quest not found');
    }
    return quest;
  }

  async update(
    id: string,
    dto: UpdateSuggestedQuestDto,
    userId: string,
  ): Promise<SuggestedQuestDocument> {
    const quest = await this.suggestedQuestModel.findById(id).exec();
    if (!quest) {
      throw new NotFoundException('Suggested quest not found');
    }
    if (quest.creatorId !== userId) {
      throw new ForbiddenException(
        'Only the creator can update this suggestion',
      );
    }

    const updated = await this.suggestedQuestModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Suggested quest not found');
    }

    this.notificationsService.notifySuggestedQuestUpdated(
      userId,
      updated.title,
    );

    return updated;
  }

  async remove(
    id: string,
    userId: string,
    role: 'user' | 'admin',
  ): Promise<{ message: string }> {
    const quest = await this.suggestedQuestModel.findById(id).exec();
    if (!quest) {
      throw new NotFoundException('Suggested quest not found');
    }

    const isCreator = quest.creatorId === userId;
    const isAdmin = role === 'admin';
    if (!isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Only the creator or an admin can delete this suggestion',
      );
    }

    if (isAdmin && !isCreator) {
      this.notificationsService.notifySuggestedQuestDeletedByAdmin(
        quest.creatorId,
        quest.title,
      );
    } else {
      this.notificationsService.notifySuggestedQuestDeletedBySelf(
        quest.creatorId,
        quest.title,
      );
    }

    await this.suggestedQuestModel.findByIdAndDelete(id).exec();
    return { message: 'Suggested quest deleted successfully' };
  }

  async upvote(id: string, userId: string): Promise<SuggestedQuestDocument> {
    const quest = await this.suggestedQuestModel
      .findById(id)
      .select('+upvoterIds +downvoterIds')
      .exec();
    if (!quest) {
      throw new NotFoundException('Suggested quest not found');
    }

    const upvoters = new Set(quest.upvoterIds);
    const downvoters = new Set(quest.downvoterIds);
    upvoters.add(userId);
    downvoters.delete(userId);

    quest.upvoterIds = Array.from(upvoters);
    quest.downvoterIds = Array.from(downvoters);
    quest.upvotes = quest.upvoterIds.length;
    quest.downvotes = quest.downvoterIds.length;

    await quest.save();
    const upvotes = quest.upvotes;
    if (upvotes > 0 && upvotes % 5 === 0) {
      this.notificationsService.notifySuggestedQuestUpvoteMilestone(
        quest.creatorId,
        quest.title,
        upvotes,
      );
    }
    return this.findOne(id);
  }

  async downvote(id: string, userId: string): Promise<SuggestedQuestDocument> {
    const quest = await this.suggestedQuestModel
      .findById(id)
      .select('+upvoterIds +downvoterIds')
      .exec();
    if (!quest) {
      throw new NotFoundException('Suggested quest not found');
    }

    const upvoters = new Set(quest.upvoterIds);
    const downvoters = new Set(quest.downvoterIds);

    downvoters.add(userId);
    upvoters.delete(userId);

    quest.upvoterIds = Array.from(upvoters);
    quest.downvoterIds = Array.from(downvoters);
    quest.upvotes = quest.upvoterIds.length;
    quest.downvotes = quest.downvoterIds.length;

    await quest.save();
    return this.findOne(id);
  }
}
