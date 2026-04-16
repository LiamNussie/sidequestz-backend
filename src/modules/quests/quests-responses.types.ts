import type { QuestSubmissionDocument } from './schemas/quest-submission.schema';

export type SubmitQuestResponse = {
  message: string;
  xpEarned: number;
  totalXp: number;
  submission: QuestSubmissionDocument;
};

export type PaginatedQuestSubmissions = {
  data: QuestSubmissionDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
