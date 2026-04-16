export const NotificationType = {
  EMAIL_VERIFICATION_SENT: 'email_verification_sent',
  EMAIL_VERIFIED: 'email_verified',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  LOGIN_SUCCESS: 'login_success',
  LOGOUT: 'logout',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PROFILE_UPDATED: 'profile_updated',
  ACCOUNT_DELETED: 'account_deleted',
  QUEST_COMPLETED: 'quest_completed',
  QUEST_SUBMISSION_UPDATED: 'quest_submission_updated',
  QUEST_PUBLISHED: 'quest_published',
  QUEST_UPDATED: 'quest_updated',
  QUEST_DELETED: 'quest_deleted',
  QUEST_POST_CREATED: 'quest_post_created',
  QUEST_POST_DELETED: 'quest_post_deleted',
  QUEST_POST_REMOVED_BY_ADMIN: 'quest_post_removed_by_admin',
  SUGGESTED_QUEST_CREATED: 'suggested_quest_created',
  SUGGESTED_QUEST_UPDATED: 'suggested_quest_updated',
  SUGGESTED_QUEST_DELETED: 'suggested_quest_deleted',
  SUGGESTED_QUEST_DELETED_BY_ADMIN: 'suggested_quest_deleted_by_admin',
  SUGGESTED_QUEST_UPVOTE_MILESTONE: 'suggested_quest_upvote_milestone',
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
