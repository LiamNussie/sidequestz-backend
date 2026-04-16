import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateQuestPostDto } from './dto/create-quest-post.dto';
import { GetQuestPostsQueryDto } from './dto/get-quest-posts-query.dto';
import { QuestPost, QuestPostDocument } from './schemas/quest-post.schema';
import {
  QuestSubmission,
  QuestSubmissionDocument,
} from '../quests/schemas/quest-submission.schema';

@Injectable()
export class QuestPostsService {
  constructor(
    @InjectModel(QuestPost.name)
    private readonly questPostModel: Model<QuestPostDocument>,
    @InjectModel(QuestSubmission.name)
    private readonly questSubmissionModel: Model<QuestSubmissionDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateQuestPostDto,
  ): Promise<QuestPostDocument> {
    const submission = await this.questSubmissionModel
      .findById(dto.submissionId)
      .exec();
    if (!submission) {
      throw new NotFoundException('Quest submission not found');
    }
    if (submission.userId !== userId) {
      throw new ForbiddenException(
        'You can only share your own quest submissions',
      );
    }

    const existing = await this.questPostModel
      .findOne({ submissionId: dto.submissionId })
      .select('_id')
      .lean()
      .exec();
    if (existing) {
      throw new ConflictException(
        'This submission has already been posted to the feed',
      );
    }

    const post = await this.questPostModel.create({
      userId,
      submissionId: dto.submissionId,
      caption: dto.caption,
    });

    const populated = await this.questPostModel
      .findById(post._id)
      .populate({
        path: 'submissionId',
        populate: { path: 'questId' },
      })
      .orFail(new NotFoundException('Quest post not found'))
      .exec();

    this.notificationsService.notifyQuestPostCreated(userId);

    return populated;
  }

  async findAll(query: GetQuestPostsQueryDto): Promise<{
    data: QuestPostDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.questPostModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'submissionId',
          populate: { path: 'questId' },
        })
        .exec(),
      this.questPostModel.countDocuments({}).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async remove(
    id: string,
    userId: string,
    role: 'user' | 'admin',
  ): Promise<{ message: string }> {
    const post = await this.questPostModel.findById(id).exec();
    if (!post) {
      throw new NotFoundException('Quest post not found');
    }

    const isOwner = post.userId === userId;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only the post owner or an admin can delete this post',
      );
    }

    const caption = post.caption;
    if (isAdmin && !isOwner) {
      this.notificationsService.notifyQuestPostRemovedByAdmin(
        post.userId,
        caption,
      );
    } else if (isOwner) {
      this.notificationsService.notifyQuestPostDeletedByOwner(userId);
    }

    await this.questPostModel.findByIdAndDelete(id).exec();
    return { message: 'Quest post deleted successfully' };
  }
}
