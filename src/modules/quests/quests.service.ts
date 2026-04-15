import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateQuestDto } from './dto/create-quest.dto';
import { GetQuestsQueryDto } from './dto/get-quests-query.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { Quest, QuestDocument } from './schemas/quest.schema';

@Injectable()
export class QuestsService {
  constructor(
    @InjectModel(Quest.name) private readonly questModel: Model<QuestDocument>,
  ) {}

  create(createQuestDto: CreateQuestDto): Promise<QuestDocument> {
    return this.questModel.create(createQuestDto);
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

  async update(
    id: string,
    updateQuestDto: UpdateQuestDto,
  ): Promise<QuestDocument> {
    const quest = await this.questModel
      .findByIdAndUpdate(id, updateQuestDto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    return quest;
  }

  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.questModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Quest not found');
    }
    return { message: 'Quest deleted successfully' };
  }
}
