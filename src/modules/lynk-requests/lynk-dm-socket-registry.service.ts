import { Injectable } from '@nestjs/common';

@Injectable()
export class LynkDmSocketRegistry {
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

  removeSocket(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return;
    }
    this.socketToUser.delete(socketId);
    const set = this.userToSockets.get(userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        this.userToSockets.delete(userId);
      }
    }
  }

  getSocketIds(userId: string): string[] {
    return [...(this.userToSockets.get(userId) ?? [])];
  }
}
