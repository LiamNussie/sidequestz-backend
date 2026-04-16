import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { xpRewardForDifficulty } from '../../common/constants/reward-points.constant';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateQuestDto } from './dto/create-quest.dto';
import { GetMyQuestsQueryDto } from './dto/get-my-quests-query.dto';
import { GetQuestSubmissionsQueryDto } from './dto/get-quest-submissions-query.dto';
import { GetQuestsQueryDto } from './dto/get-quests-query.dto';
import { SubmitQuestDto } from './dto/submit-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { Quest, QuestDocument } from './schemas/quest.schema';
import {
  QuestSubmission,
  QuestSubmissionDocument,
} from './schemas/quest-submission.schema';
import type {
  PaginatedQuestSubmissions,
  SubmitQuestResponse,
} from './quests-responses.types';

@Injectable()
export class QuestsService {
  constructor(
    @InjectModel(Quest.name) private readonly questModel: Model<QuestDocument>,
    @InjectModel(QuestSubmission.name)
    private readonly questSubmissionModel: Model<QuestSubmissionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createQuestDto: CreateQuestDto): Promise<QuestDocument> {
    const xpReward =
      createQuestDto.xpReward !== undefined
        ? createQuestDto.xpReward
        : xpRewardForDifficulty(createQuestDto.difficulty);

    const quest = await this.questModel.create({
      ...createQuestDto,
      xpReward,
    });
    this.notificationsService.notifyQuestPublished(
      quest.title,
      String(quest._id),
    );
    return quest;
  }

  async findAll(query: GetQuestsQueryDto): Promise<{
    data: QuestDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: {
      difficulty?: string;
      $or?: Array<{ title?: RegExp; description?: RegExp }>;
    } = {};

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }

    const search = query.search?.trim();
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { title: regex },
        // Keep description searchable for better UX even if "name" is absent.
        { description: regex },
      ];
    }

    const [data, total] = await Promise.all([
      this.questModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.questModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<QuestDocument> {
    const quest = await this.questModel.findById(id).exec();
    if (!quest) {
      throw new NotFoundException('Quest not found');
    }
    return quest;
  }

  async submitQuest(
    userId: string,
    submitQuestDto: SubmitQuestDto,
  ): Promise<SubmitQuestResponse> {
    const quest = await this.questModel.findById(submitQuestDto.questId).exec();
    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    const xpToAward = quest.xpReward ?? xpRewardForDifficulty(quest.difficulty);

    const existingSubmission = await this.questSubmissionModel
      .findOne({
        userId,
        questId: submitQuestDto.questId,
      })
      .select('_id')
      .lean()
      .exec();

    if (existingSubmission) {
      const updated = await this.questSubmissionModel
        .findOneAndUpdate(
          { userId, questId: submitQuestDto.questId },
          {
            $set: {
              imageUrls: submitQuestDto.imageUrls,
              videoUrl: submitQuestDto.videoUrl ?? null,
              note: submitQuestDto.note ?? null,
              status: 'completed',
              submittedAt: new Date(),
            },
          },
          { new: true, runValidators: true },
        )
        .populate('questId')
        .exec();

      if (!updated) {
        throw new NotFoundException('Quest submission not found');
      }

      const user = await this.userModel
        .findById(userId)
        .select('totalXp')
        .exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.notificationsService.notifyQuestSubmissionUpdated(
        userId,
        quest.title,
      );

      return {
        message:
          'Yay! Your quest submission has been updated! No additional XP was awarded.',
        xpEarned: 0,
        totalXp: user.totalXp ?? 0,
        submission: updated,
      };
    }

    const submission = await this.questSubmissionModel.create({
      userId,
      questId: submitQuestDto.questId,
      imageUrls: submitQuestDto.imageUrls,
      videoUrl: submitQuestDto.videoUrl ?? null,
      note: submitQuestDto.note ?? null,
      status: 'completed',
      submittedAt: new Date(),
    });

    await this.questModel
      .findByIdAndUpdate(submitQuestDto.questId, {
        $inc: { completedCount: 1 },
      })
      .exec();

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: { totalXp: xpToAward },
          $set: { lastXpMilestoneAt: new Date() },
        },
        { new: true, runValidators: true },
      )
      .select('totalXp')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const createdSubmission = await this.questSubmissionModel
      .findById(submission._id)
      .populate('questId')
      .orFail(new NotFoundException('Quest submission not found'))
      .exec();

    this.notificationsService.notifyQuestCompletedFirst({
      userId,
      questTitle: quest.title,
      xpEarned: xpToAward,
    });

    return {
      message: `Yay! You have successfully completed this quest and earned ${xpToAward}XP!`,
      xpEarned: xpToAward,
      totalXp: user.totalXp ?? 0,
      submission: createdSubmission,
    };
  }

  async findMySubmissions(
    queryUserId: string,
    query: GetMyQuestsQueryDto,
  ): Promise<PaginatedQuestSubmissions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.questSubmissionModel
        .find({ userId: queryUserId })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('questId')
        .exec(),
      this.questSubmissionModel.countDocuments({ userId: queryUserId }).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findAllSubmissions(
    query: GetQuestSubmissionsQueryDto,
  ): Promise<PaginatedQuestSubmissions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: { questId?: string } = {};
    if (query.questId) {
      filter.questId = query.questId;
    }

    const [data, total] = await Promise.all([
      this.questSubmissionModel
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('questId')
        .exec(),
      this.questSubmissionModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async update(
    id: string,
    updateQuestDto: UpdateQuestDto,
  ): Promise<QuestDocument> {
    const payload: UpdateQuestDto = { ...updateQuestDto };
    if (payload.difficulty !== undefined && payload.xpReward === undefined) {
      payload.xpReward = xpRewardForDifficulty(payload.difficulty);
    }

    const quest = await this.questModel
      .findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    this.notificationsService.notifyQuestUpdated(
      quest.title,
      String(quest._id),
    );

    return quest;
  }

  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.questModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Quest not found');
    }
    await this.questModel.findByIdAndDelete(id).exec();
    this.notificationsService.notifyQuestDeleted(
      existing.title,
      String(existing._id),
    );
    return { message: 'Quest deleted successfully' };
  }
}
