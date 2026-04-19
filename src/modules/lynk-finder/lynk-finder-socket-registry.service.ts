import { Injectable } from '@nestjs/common';

@Injectable()
export class LynkFinderSocketRegistry {
  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();

  add(userId: string, socketId: string): void {
    let set = this.userToSockets.get(userId);
    if (!set) {
      set = new Set();
      this.userToSockets.set(userId, set);
    }
    set.add(socketId);
    this.socketToUser.set(socketId, userId);
  }

  /**
   * @returns `null` if socket was unknown; otherwise whether the user has no sockets left.
   */
  removeSocket(socketId: string): { userId: string; empty: boolean } | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return null;
    }
    this.socketToUser.delete(socketId);
    const set = this.userToSockets.get(userId);
    if (!set) {
      return { userId, empty: true };
    }
    set.delete(socketId);
    if (set.size === 0) {
      this.userToSockets.delete(userId);
      return { userId, empty: true };
    }
    return { userId, empty: false };
  }

  getSocketIds(userId: string): string[] {
    return [...(this.userToSockets.get(userId) ?? [])];
  }
}
