import type { QuestDifficulty } from '../../modules/quests/schemas/quest.schema';

/**
 * Base quest XP when `xpReward` is not set explicitly on create/update.
 * Must stay in sync with `QUEST_DIFFICULTIES` on the Quest schema.
 */
export const QUEST_DIFFICULTY_XP_REWARD: Record<QuestDifficulty, number> = {
  rookie: 100,
  amateur: 250,
  pro: 350,
  quester: 500,
  impossible: 1000,
};

export function xpRewardForDifficulty(difficulty: QuestDifficulty): number {
  return QUEST_DIFFICULTY_XP_REWARD[difficulty];
}
