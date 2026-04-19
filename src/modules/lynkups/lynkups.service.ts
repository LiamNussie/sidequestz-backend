import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Event, EventDocument } from '../events/schemas/event.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UserGender } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateLynkupDto } from './dto/create-lynkup.dto';
import { GetLynkupsQueryDto } from './dto/get-lynkups-query.dto';
import { UpdateLynkupDto } from './dto/update-lynkup.dto';
import {
  Lynkup,
  LynkupDocument,
  LynkupParticipantGender,
  LynkupStatus,
} from './schemas/lynkup.schema';

function parseInclusiveDateEnd(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return d;
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  if (isDateOnly) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function openOrFull(
  participantCount: number,
  maxParticipants: number,
): 'open' | 'full' {
  return participantCount >= maxParticipants ? 'full' : 'open';
}

@Injectable()
export class LynkupsService {
  constructor(
    @InjectModel(Lynkup.name) private readonly lynkupModel: Model<LynkupDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    creatorId: string,
    dto: CreateLynkupDto,
  ): Promise<LynkupDocument> {
    await this.requireUserGenderForLynkup(creatorId);

    const maxParticipants = dto.maxParticipants;
    this.assertParticipantGenderAllowed(dto.participantGender, maxParticipants);

    const event = await this.eventModel.findById(dto.eventId).exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const description =
      dto.description === undefined
        ? null
        : dto.description.trim() || null;

    const participantGender =
      maxParticipants === 2 ? (dto.participantGender ?? null) : null;

    const status = openOrFull(1, maxParticipants);

    const doc = await this.lynkupModel.create({
      creatorId,
      title: dto.title.trim(),
      description,
      eventId: dto.eventId,
      maxParticipants,
      participantGender,
      participants: [creatorId],
      status,
    });

    return this.findDocumentByIdOrThrow(String(doc.id));
  }

  async join(lynkupId: string, userId: string): Promise<LynkupDocument> {
    if (!isValidObjectId(lynkupId)) {
      throw new BadRequestException('Invalid lynkup id');
    }

    const joinerGender = await this.requireUserGenderForLynkup(userId);

    const lynkup = await this.lynkupModel.findById(lynkupId).exec();
    if (!lynkup) {
      throw new NotFoundException('Lynkup not found');
    }

    if (
      lynkup.participantGender != null &&
      joinerGender !== lynkup.participantGender
    ) {
      throw new ForbiddenException(
        'This lynkup is only open to users whose profile gender matches the participant gender set by the host',
      );
    }

    if (lynkup.status === 'closed') {
      throw new ForbiddenException('This lynkup is closed');
    }
    if (lynkup.participants.length >= lynkup.maxParticipants) {
      throw new BadRequestException('This lynkup is full');
    }
    if (lynkup.participants.includes(userId)) {
      throw new ConflictException('You are already in this lynkup');
    }

    const participants = [...lynkup.participants, userId];
    const status: LynkupStatus = openOrFull(
      participants.length,
      lynkup.maxParticipants,
    );

    const updated = await this.lynkupModel
      .findByIdAndUpdate(
        lynkupId,
        { participants, status },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Lynkup not found');
    }

    if (updated.creatorId !== userId) {
      const joiner = await this.usersService.findById(userId);
      const joinerName = joiner?.name ?? 'Someone';
      this.notificationsService.notifyLynkupParticipantJoined(updated.creatorId, {
        lynkupId,
        lynkupTitle: updated.title,
        joinerName,
      });
    }

    return this.findDocumentByIdOrThrow(lynkupId);
  }

  async exit(lynkupId: string, userId: string): Promise<LynkupDocument> {
    if (!isValidObjectId(lynkupId)) {
      throw new BadRequestException('Invalid lynkup id');
    }

    const lynkup = await this.lynkupModel.findById(lynkupId).exec();
    if (!lynkup) {
      throw new NotFoundException('Lynkup not found');
    }

    if (lynkup.creatorId === userId) {
      throw new ForbiddenException(
        'The host cannot leave a lynkup; delete it instead if you no longer want it',
      );
    }

    if (!lynkup.participants.includes(userId)) {
      throw new BadRequestException('You are not a participant in this lynkup');
    }

    const participants = lynkup.participants.filter((id) => id !== userId);
    const status: LynkupStatus = openOrFull(
      participants.length,
      lynkup.maxParticipants,
    );

    const updated = await this.lynkupModel
      .findByIdAndUpdate(
        lynkupId,
        { participants, status },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Lynkup not found');
    }

    return this.findDocumentByIdOrThrow(lynkupId);
  }

  async findAll(query: GetLynkupsQueryDto): Promise<{
    data: LynkupDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: { eventId?: string | { $in: string[] } } = {};

    const hasEventFilter =
      query.eventId !== undefined ||
      query.eventDateFrom !== undefined ||
      query.eventDateTo !== undefined;

    if (hasEventFilter) {
      const onlyEventId =
        query.eventId !== undefined &&
        query.eventDateFrom === undefined &&
        query.eventDateTo === undefined;

      if (onlyEventId) {
        filter.eventId = query.eventId;
      } else {
        const eventMatch: Record<string, unknown> = {};
        if (query.eventId !== undefined) {
          eventMatch._id = query.eventId;
        }
        if (query.eventDateFrom !== undefined) {
          const from = new Date(query.eventDateFrom);
          if (Number.isNaN(from.getTime())) {
            throw new BadRequestException('eventDateFrom must be a valid date');
          }
          eventMatch.date = {
            ...(eventMatch.date as Record<string, Date> | undefined),
            $gte: from,
          };
        }
        if (query.eventDateTo !== undefined) {
          const to = parseInclusiveDateEnd(query.eventDateTo);
          if (Number.isNaN(to.getTime())) {
            throw new BadRequestException('eventDateTo must be a valid date');
          }
          eventMatch.date = {
            ...(eventMatch.date as Record<string, Date> | undefined),
            $lte: to,
          };
        }

        const matchingEvents = await this.eventModel
          .find(eventMatch)
          .select('_id')
          .lean()
          .exec();

        const ids = matchingEvents.map((e) => String(e._id));
        if (ids.length === 0) {
          return {
            data: [],
            page,
            limit,
            total: 0,
            totalPages: 1,
          };
        }
        filter.eventId = { $in: ids };
      }
    }

    const [data, total] = await Promise.all([
      this.lynkupModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'eventId', model: Event.name })
        .exec(),
      this.lynkupModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<LynkupDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid lynkup id');
    }
    return this.findDocumentByIdOrThrow(id);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateLynkupDto,
  ): Promise<LynkupDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid lynkup id');
    }

    const existing = await this.lynkupModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Lynkup not found');
    }
    if (existing.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can update this lynkup');
    }

    const onlyCreatorListed =
      existing.participants.length === 1 &&
      existing.participants[0] === existing.creatorId;
    if (!onlyCreatorListed) {
      throw new ForbiddenException(
        'A lynkup can only be edited before anyone else has joined',
      );
    }

    const payload: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      payload.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      payload.description = dto.description.trim() || null;
    }

    let nextMax = existing.maxParticipants;
    if (dto.maxParticipants !== undefined) {
      nextMax = dto.maxParticipants;
      if (nextMax < existing.participants.length) {
        throw new BadRequestException(
          'maxParticipants cannot be less than the current number of participants',
        );
      }
      payload.maxParticipants = nextMax;
    }

    if (dto.participantGender !== undefined) {
      this.assertParticipantGenderAllowed(dto.participantGender, nextMax);
    }
    if (nextMax !== 2) {
      if (existing.participantGender !== null || dto.participantGender !== undefined) {
        payload.participantGender = null;
      }
    } else if (dto.participantGender !== undefined) {
      payload.participantGender = dto.participantGender;
    }

    if (Object.keys(payload).length === 0) {
      return this.findDocumentByIdOrThrow(id);
    }

    const updated = await this.lynkupModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Lynkup not found');
    }

    return this.findDocumentByIdOrThrow(id);
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid lynkup id');
    }

    const existing = await this.lynkupModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Lynkup not found');
    }
    if (existing.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can delete this lynkup');
    }

    await this.lynkupModel.findByIdAndDelete(id).exec();
    return { message: 'Lynkup deleted successfully' };
  }

  /**
   * Loads the lynkup and ensures `userId` is in `participants` (for chat, etc.).
   * Document is not populated.
   */
  async requireParticipantAccess(
    lynkupId: string,
    userId: string,
  ): Promise<LynkupDocument> {
    if (!isValidObjectId(lynkupId)) {
      throw new BadRequestException('Invalid lynkup id');
    }
    const lynkup = await this.lynkupModel.findById(lynkupId).exec();
    if (!lynkup) {
      throw new NotFoundException('Lynkup not found');
    }
    if (!lynkup.participants.includes(userId)) {
      throw new ForbiddenException('Only lynkup participants can use this chat');
    }
    return lynkup;
  }

  private assertParticipantGenderAllowed(
    gender: LynkupParticipantGender | undefined,
    maxParticipants: number,
  ): void {
    if (gender !== undefined && maxParticipants !== 2) {
      throw new BadRequestException(
        'participantGender can only be set when maxParticipants is 2',
      );
    }
  }

  private async requireUserGenderForLynkup(userId: string): Promise<UserGender> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.gender == null) {
      throw new BadRequestException(
        'Set your gender on your profile before creating or joining a lynkup',
      );
    }
    return user.gender;
  }

  private async findDocumentByIdOrThrow(id: string): Promise<LynkupDocument> {
    const doc = await this.lynkupModel
      .findById(id)
      .populate({ path: 'eventId', model: Event.name })
      .exec();
    if (!doc) {
      throw new NotFoundException('Lynkup not found');
    }
    return doc;
  }
}
