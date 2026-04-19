import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationType } from './notification-types';
import { PushService } from './push.service';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import {
  PushDevice,
  PushDeviceDocument,
  PushPlatform,
} from './schemas/push-device.schema';

const FANOUT_BATCH = 200;
const FANOUT_MAX_USERS = 5_000;

export type DispatchInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
  emailSubject?: string;
  emailHtml?: string;
  skipInApp?: boolean;
  skipPush?: boolean;
  toEmailOverride?: string;
};

function metaStrings(meta: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(PushDevice.name)
    private readonly pushDeviceModel: Model<PushDeviceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
  ) {}

  fireAndForget(input: DispatchInput): void {
    void this.dispatch(input).catch((err: unknown) => {
      this.logger.warn(
        `Notification dispatch failed (${input.type}): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async dispatch(input: DispatchInput): Promise<void> {
    const metadata = input.metadata ?? {};

    if (!input.skipInApp) {
      await this.notificationModel.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata,
        readAt: null,
      });
    }

    let email: string | undefined = input.toEmailOverride;
    if (!email && input.sendEmail && input.emailSubject && input.emailHtml) {
      const user = await this.userModel
        .findById(input.userId)
        .select('email')
        .lean()
        .exec();
      email = (user as { email?: string } | null)?.email;
    }

    if (input.sendEmail && input.emailSubject && input.emailHtml && email) {
      await this.mailService.sendHtmlEmail(
        email,
        input.emailSubject,
        input.emailHtml,
      );
    }

    if (!input.skipPush) {
      await this.pushService.sendToUser(
        input.userId,
        input.title,
        input.body,
        metaStrings(metadata),
      );
    }
  }

  async fanOutToAllUsers(input: {
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    skipPush?: boolean;
  }): Promise<void> {
    let skip = 0;
    let total = 0;
    while (total < FANOUT_MAX_USERS) {
      const rows = await this.userModel
        .find()
        .select('_id')
        .sort({ _id: 1 })
        .skip(skip)
        .limit(FANOUT_BATCH)
        .lean()
        .exec();
      if (!rows.length) break;
      for (const row of rows) {
        this.fireAndForget({
          userId: String(row._id),
          type: input.type,
          title: input.title,
          body: input.body,
          metadata: input.metadata,
          skipPush: input.skipPush,
          sendEmail: false,
        });
      }
      total += rows.length;
      skip += rows.length;
      if (rows.length < FANOUT_BATCH) break;
    }
  }

  async purgeUserData(userId: string): Promise<void> {
    await Promise.all([
      this.notificationModel.deleteMany({ userId }).exec(),
      this.pushDeviceModel.deleteMany({ userId }).exec(),
    ]);
  }

  async registerDevice(
    userId: string,
    token: string,
    platform: PushPlatform,
  ): Promise<{ message: string }> {
    await this.pushDeviceModel.deleteMany({ token }).exec();
    await this.pushDeviceModel.findOneAndUpdate(
      { userId, token },
      { userId, token, platform },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { message: 'Push device registered' };
  }

  async unregisterDevice(
    userId: string,
    token: string,
  ): Promise<{ message: string }> {
    await this.pushDeviceModel.deleteOne({ userId, token }).exec();
    return { message: 'Push device removed' };
  }

  async findMine(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: NotificationDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  }> {
    const skip = (page - 1) * limit;
    const filter = { userId };
    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
      this.notificationModel.countDocuments({ ...filter, readAt: null }).exec(),
    ]);
    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationDocument> {
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId },
        { readAt: new Date() },
        { new: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException('Notification not found');
    }
    return doc;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.notificationModel
      .updateMany({ userId, readAt: null }, { readAt: new Date() })
      .exec();
    return { updated: res.modifiedCount ?? 0 };
  }

  notifyRegistrationPending(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.EMAIL_VERIFICATION_SENT,
      title: 'Verify your email',
      body: 'We sent a 6-digit code to your inbox. Enter it to activate your account.',
      sendEmail: false,
    });
  }

  notifyEmailVerified(userId: string, email: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.EMAIL_VERIFIED,
      title: 'Email verified',
      body: 'Your email address is verified. You are ready to explore Sidequestz.',
      sendEmail: true,
      emailSubject: 'Welcome to Sidequestz',
      emailHtml:
        '<p>Your email is verified. Thanks for joining Sidequestz.</p><p>You can close this message and return to the app.</p>',
      toEmailOverride: email,
    });
  }

  notifyPasswordResetSuccess(userId: string, email: string): void {
    void this.dispatch({
      userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: 'Password updated',
      body: 'Your password was reset successfully. All sessions were signed out.',
      sendEmail: true,
      emailSubject: 'Your Sidequestz password was changed',
      emailHtml:
        '<p>Your password was changed successfully.</p><p>If you did not do this, contact support immediately.</p>',
      toEmailOverride: email,
    }).catch((err: unknown) => {
      this.logger.error(
        `Password-changed notification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  notifyPasswordResetRequested(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.PASSWORD_RESET_REQUESTED,
      title: 'Password reset requested',
      body: 'If you requested a reset, check your email for the code.',
      sendEmail: false,
    });
  }

  notifyLoginSuccess(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.LOGIN_SUCCESS,
      title: 'Signed in',
      body: 'You signed in to your account.',
      skipPush: true,
    });
  }

  notifyLogout(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.LOGOUT,
      title: 'Signed out',
      body: 'You were signed out of this device.',
      skipPush: true,
    });
  }

  notifyOnboardingCompleted(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.ONBOARDING_COMPLETED,
      title: 'Profile complete',
      body: 'Your profile is set up. Start completing quests to earn XP.',
    });
  }

  notifyProfileUpdated(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.PROFILE_UPDATED,
      title: 'Profile updated',
      body: 'Your profile changes were saved.',
    });
  }

  notifyAccountDeleted(email: string): void {
    void this.mailService
      .sendHtmlEmail(
        email,
        'Your Sidequestz account was deleted',
        '<p>Your account and associated data have been deleted as requested.</p><p>If you did not request this, contact support.</p>',
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `Account-deleted email failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  notifyQuestCompletedFirst(input: {
    userId: string;
    questTitle: string;
    xpEarned: number;
  }): void {
    this.fireAndForget({
      userId: input.userId,
      type: NotificationType.QUEST_COMPLETED,
      title: 'Quest completed',
      body: `You completed “${input.questTitle}” and earned ${String(input.xpEarned)} XP.`,
      metadata: { questTitle: input.questTitle, xpEarned: input.xpEarned },
    });
  }

  notifyQuestSubmissionUpdated(userId: string, questTitle: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.QUEST_SUBMISSION_UPDATED,
      title: 'Submission updated',
      body: `Your submission for “${questTitle}” was updated. No additional XP was awarded.`,
      metadata: { questTitle },
      skipPush: true,
    });
  }

  notifyQuestPublished(questTitle: string, questId: string): void {
    void this.fanOutToAllUsers({
      type: NotificationType.QUEST_PUBLISHED,
      title: 'New quest',
      body: `A new quest is live: “${questTitle}”.`,
      metadata: { questId, questTitle },
      skipPush: false,
    }).catch((err: unknown) => {
      this.logger.warn(
        `Quest publish fan-out failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  notifyQuestUpdated(questTitle: string, questId: string): void {
    void this.fanOutToAllUsers({
      type: NotificationType.QUEST_UPDATED,
      title: 'Quest updated',
      body: `“${questTitle}” was updated. Check the latest details in the app.`,
      metadata: { questId, questTitle },
      skipPush: true,
    }).catch((err: unknown) => {
      this.logger.warn(
        `Quest update fan-out failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  notifyQuestDeleted(questTitle: string, questId: string): void {
    void this.fanOutToAllUsers({
      type: NotificationType.QUEST_DELETED,
      title: 'Quest removed',
      body: `“${questTitle}” is no longer available.`,
      metadata: { questId, questTitle },
      skipPush: true,
    }).catch((err: unknown) => {
      this.logger.warn(
        `Quest delete fan-out failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  notifyQuestPostCreated(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.QUEST_POST_CREATED,
      title: 'Shared to feed',
      body: 'Your quest completion was posted to the feed.',
    });
  }

  notifyQuestPostDeletedByOwner(userId: string): void {
    this.fireAndForget({
      userId,
      type: NotificationType.QUEST_POST_DELETED,
      title: 'Feed post removed',
      body: 'Your feed post was deleted.',
      skipPush: true,
    });
  }

  notifyQuestPostRemovedByAdmin(
    ownerUserId: string,
    captionSnippet: string,
  ): void {
    this.fireAndForget({
      userId: ownerUserId,
      type: NotificationType.QUEST_POST_REMOVED_BY_ADMIN,
      title: 'Feed post removed by moderator',
      body: `A moderator removed one of your feed posts${captionSnippet ? `: “${captionSnippet.slice(0, 80)}${captionSnippet.length > 80 ? '…' : ''}”` : ''}.`,
      sendEmail: true,
      emailSubject: 'Your feed post was removed',
      emailHtml: `<p>A moderator removed a quest completion post from the public feed.</p>${captionSnippet ? `<p>Caption started with: ${captionSnippet.slice(0, 200)}</p>` : ''}`,
    });
  }

  notifySuggestedQuestCreated(creatorId: string, title: string): void {
    this.fireAndForget({
      userId: creatorId,
      type: NotificationType.SUGGESTED_QUEST_CREATED,
      title: 'Suggestion submitted',
      body: `Your suggested quest “${title}” was received.`,
      metadata: { title },
    });
  }

  notifySuggestedQuestUpdated(creatorId: string, title: string): void {
    this.fireAndForget({
      userId: creatorId,
      type: NotificationType.SUGGESTED_QUEST_UPDATED,
      title: 'Suggestion updated',
      body: `Your suggested quest “${title}” was updated.`,
      metadata: { title },
    });
  }

  notifySuggestedQuestDeletedBySelf(creatorId: string, title: string): void {
    this.fireAndForget({
      userId: creatorId,
      type: NotificationType.SUGGESTED_QUEST_DELETED,
      title: 'Suggestion deleted',
      body: `Your suggested quest “${title}” was removed.`,
      metadata: { title },
      skipPush: true,
    });
  }

  notifySuggestedQuestDeletedByAdmin(creatorId: string, title: string): void {
    this.fireAndForget({
      userId: creatorId,
      type: NotificationType.SUGGESTED_QUEST_DELETED_BY_ADMIN,
      title: 'Suggestion removed',
      body: `A moderator removed your suggested quest “${title}”.`,
      metadata: { title },
      sendEmail: true,
      emailSubject: 'Your suggested quest was removed',
      emailHtml: `<p>A moderator removed your suggested quest titled “${title}”.</p>`,
    });
  }

  notifySuggestedQuestUpvoteMilestone(
    creatorId: string,
    title: string,
    upvotes: number,
  ): void {
    this.fireAndForget({
      userId: creatorId,
      type: NotificationType.SUGGESTED_QUEST_UPVOTE_MILESTONE,
      title: 'Suggestion gaining traction',
      body: `“${title}” reached ${String(upvotes)} upvotes.`,
      metadata: { title, upvotes },
    });
  }

  notifyLynkupChatMessage(
    recipientUserId: string,
    input: { lynkupId: string; senderName: string; preview: string },
  ): void {
    const preview =
      input.preview.length > 120
        ? `${input.preview.slice(0, 117)}…`
        : input.preview;
    this.fireAndForget({
      userId: recipientUserId,
      type: NotificationType.LYNKUP_CHAT_MESSAGE,
      title: `${input.senderName}`,
      body: preview,
      metadata: {
        lynkupId: input.lynkupId,
        senderName: input.senderName,
      },
    });
  }

  notifyLynkupParticipantJoined(
    hostUserId: string,
    input: { lynkupId: string; lynkupTitle: string; joinerName: string },
  ): void {
    this.fireAndForget({
      userId: hostUserId,
      type: NotificationType.LYNKUP_PARTICIPANT_JOINED,
      title: 'Someone joined your lynkup',
      body: `${input.joinerName} joined “${input.lynkupTitle}”.`,
      metadata: {
        lynkupId: input.lynkupId,
        lynkupTitle: input.lynkupTitle,
        joinerName: input.joinerName,
      },
    });
  }

  notifyLynkRequestReceived(
    recipientUserId: string,
    input: { requestId: string; fromName: string },
  ): void {
    this.fireAndForget({
      userId: recipientUserId,
      type: NotificationType.LYNK_REQUEST_RECEIVED,
      title: 'New lynk request',
      body: `${input.fromName} wants to connect.`,
      metadata: { requestId: input.requestId, fromName: input.fromName },
    });
  }

  notifyLynkRequestAccepted(
    senderUserId: string,
    input: { requestId: string; conversationId: string; peerName: string },
  ): void {
    this.fireAndForget({
      userId: senderUserId,
      type: NotificationType.LYNK_REQUEST_ACCEPTED,
      title: 'Lynk request accepted',
      body: `${input.peerName} accepted your request. You can chat now.`,
      metadata: {
        requestId: input.requestId,
        conversationId: input.conversationId,
        peerName: input.peerName,
      },
    });
  }

  notifyLynkRequestDeclined(
    senderUserId: string,
    input: { requestId: string; peerName: string },
  ): void {
    this.fireAndForget({
      userId: senderUserId,
      type: NotificationType.LYNK_REQUEST_DECLINED,
      title: 'Lynk request declined',
      body: `${input.peerName} declined your request.`,
      metadata: { requestId: input.requestId, peerName: input.peerName },
      skipPush: true,
    });
  }
}
