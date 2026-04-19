import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppConfigService } from '../../core/config/app-config.service';
import { REDIS } from '../../core/redis/redis.module';

const GEO_KEY = 'lynkfinder:geo:online';

function hbKey(userId: string): string {
  return `lynkfinder:hb:${userId}`;
}

export type LynkFinderPeer = {
  userId: string;
  distanceM: number;
  lat: number;
  lng: number;
};

function parseGeoradiusReply(reply: unknown): LynkFinderPeer[] {
  if (!Array.isArray(reply)) {
    return [];
  }
  const out: LynkFinderPeer[] = [];
  for (const row of reply) {
    if (!Array.isArray(row) || row.length < 3) {
      continue;
    }
    const userId = String(row[0]);
    const distanceM = Number.parseFloat(String(row[1]));
    const coord = row[2];
    if (!Array.isArray(coord) || coord.length < 2) {
      continue;
    }
    const lng = Number.parseFloat(String(coord[0]));
    const lat = Number.parseFloat(String(coord[1]));
    if (
      !Number.isFinite(distanceM) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      continue;
    }
    out.push({ userId, distanceM, lat, lng });
  }
  return out;
}

@Injectable()
export class LynkFinderService {
  private readonly lastWriteMs = new Map<string, number>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly appConfig: AppConfigService,
  ) {}

  private radiusM(): number {
    return this.appConfig.getLynkFinderRadiusM();
  }

  private ttlSeconds(): number {
    return this.appConfig.getLynkFinderPresenceTtlSeconds();
  }

  private minIntervalMs(): number {
    return this.appConfig.getLynkFinderMinUpdateIntervalMs();
  }

  /**
   * Writes location + heartbeat TTL. Returns nearby peers (excluding self) after
   * pruning stale GEO members whose heartbeat expired.
   */
  async upsertLocation(
    userId: string,
    lat: number,
    lng: number,
  ): Promise<{ peers: LynkFinderPeer[]; throttled: boolean }> {
    const now = Date.now();
    const last = this.lastWriteMs.get(userId) ?? 0;
    if (now - last < this.minIntervalMs()) {
      return { peers: [], throttled: true };
    }

    const ttl = this.ttlSeconds();
    const pipeline = this.redis.pipeline();
    pipeline.geoadd(GEO_KEY, lng, lat, userId);
    pipeline.set(hbKey(userId), '1', 'EX', ttl);
    await pipeline.exec();
    this.lastWriteMs.set(userId, now);

    const peers = await this.nearbyPeers(lng, lat, userId);
    return { peers, throttled: false };
  }

  async nearbyPeers(
    lng: number,
    lat: number,
    excludeUserId: string,
  ): Promise<LynkFinderPeer[]> {
    const raw = await this.redis.georadius(
      GEO_KEY,
      lng,
      lat,
      this.radiusM(),
      'm',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
      'COUNT',
      100,
    );
    const parsed = parseGeoradiusReply(raw);
    const candidates = parsed.filter((p) => p.userId !== excludeUserId);
    const filtered: LynkFinderPeer[] = [];
    const staleIds: string[] = [];

    const check = this.redis.pipeline();
    for (const p of candidates) {
      check.exists(hbKey(p.userId));
    }
    const existsResults = (await check.exec()) ?? [];

    for (let i = 0; i < candidates.length; i += 1) {
      const p = candidates[i];
      const row = existsResults[i];
      const exists = row?.[1] === 1;
      if (exists) {
        filtered.push(p);
      } else {
        staleIds.push(p.userId);
      }
    }

    if (staleIds.length > 0) {
      const cleanup = this.redis.pipeline();
      for (const id of staleIds) {
        cleanup.zrem(GEO_KEY, id);
      }
      await cleanup.exec();
    }

    return filtered;
  }

  /** Last known position for `userId` in GEO, if any. */
  async getPosition(
    userId: string,
  ): Promise<{ lng: number; lat: number } | null> {
    const pos = await this.redis.geopos(GEO_KEY, userId);
    const first = pos[0];
    if (!first) {
      return null;
    }
    const lng = Number.parseFloat(String(first[0]));
    const lat = Number.parseFloat(String(first[1]));
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }
    return { lng, lat };
  }

  async removeUser(userId: string): Promise<void> {
    this.lastWriteMs.delete(userId);
    await this.redis
      .pipeline()
      .zrem(GEO_KEY, userId)
      .del(hbKey(userId))
      .exec();
  }

  /** Who should see `userId` disappear (GEO + heartbeat still present). */
  async listNeighborUserIdsForUser(userId: string): Promise<string[]> {
    const pos = await this.getPosition(userId);
    if (!pos) {
      return [];
    }
    const peers = await this.nearbyPeers(pos.lng, pos.lat, userId);
    return peers.map((p) => p.userId);
  }
}
