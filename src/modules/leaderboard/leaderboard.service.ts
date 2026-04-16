import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { User } from '../users/schemas/user.schema';

const LEADERBOARD_LIMIT = 100;

/** Users without `lastXpMilestoneAt` sort after those with a milestone (same XP). */
const XP_TIE_NULL_PLACEHOLDER = new Date(253402318800000);

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  totalXp: number;
};

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
    const pipeline: PipelineStage[] = [
      {
        $addFields: {
          _xpTiebreak: {
            $ifNull: [
              '$lastXpMilestoneAt',
              { $literal: XP_TIE_NULL_PLACEHOLDER },
            ],
          },
        },
      },
      { $sort: { totalXp: -1, _xpTiebreak: 1, createdAt: 1 } },
      { $limit: LEADERBOARD_LIMIT },
      {
        $project: {
          _id: 1,
          name: 1,
          username: 1,
          avatar: 1,
          totalXp: 1,
        },
      },
    ];

    const rows = await this.userModel
      .aggregate<{
        _id: unknown;
        name: string;
        username: string | null;
        avatar: string | null;
        totalXp: number;
      }>(pipeline)
      .exec();

    const leaderboard: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      userId: String(row._id),
      name: row.name,
      username: row.username ?? null,
      avatar: row.avatar ?? null,
      totalXp: row.totalXp ?? 0,
    }));

    return { leaderboard };
  }
}
