import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateEventDto } from './dto/create-event.dto';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, EventDocument } from './schemas/event.schema';

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

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {}

  create(dto: CreateEventDto): Promise<EventDocument> {
    return this.eventModel.create({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      date: new Date(dto.date),
      bannerUrl: dto.bannerUrl.trim(),
      location: dto.location?.trim() ?? null,
      ticketLink: dto.ticketLink?.trim() ?? null,
    });
  }

  async findAll(query: GetEventsQueryDto): Promise<{
    data: EventDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: {
      name?: RegExp;
      date?: { $gte?: Date; $lte?: Date };
    } = {};

    const search = query.search?.trim();
    if (search) {
      filter.name = new RegExp(search, 'i');
    }

    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) {
        filter.date = { ...filter.date, $gte: from };
      }
    }
    if (query.dateTo) {
      const to = parseInclusiveDateEnd(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        filter.date = { ...filter.date, $lte: to };
      }
    }

    const [data, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDocument> {
    const payload: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      payload.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      payload.description = dto.description.trim() || null;
    }
    if (dto.date !== undefined) {
      payload.date = new Date(dto.date);
    }
    if (dto.bannerUrl !== undefined) {
      payload.bannerUrl = dto.bannerUrl.trim();
    }
    if (dto.location !== undefined) {
      payload.location = dto.location.trim() || null;
    }
    if (dto.ticketLink !== undefined) {
      payload.ticketLink = dto.ticketLink.trim() || null;
    }

    const event = await this.eventModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .exec();

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.eventModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Event not found');
    }
    return { message: 'Event deleted successfully' };
  }
}
