import type { UserMemoryProfile } from './user-memory.js';
import { classifyMemoryCandidate } from './memory-filter.js';

export type MemoryWritebackPlan = {
  profileUpdate: {
    nicknameHistory: string[];
    preferences?: string[];
    relationshipSummary: string;
    lastInteractionAt: Date;
  };
  factToPersist?: {
    scope: 'mid_term' | 'long_term';
    fact: string;
    confidence: number;
  };
  summaryLine?: string;
};

export function buildMemoryWritebackPlan(input: {
  messageText: string;
  replyText: string;
  nickname: string;
  currentProfile: UserMemoryProfile;
  now: Date;
}): MemoryWritebackPlan {
  const normalizedMessageText = normalizeMessageText(input.messageText);
  const candidate = classifyMemoryCandidate(normalizedMessageText);
  const nicknameHistory = mergeUniqueStrings(input.currentProfile.nicknameHistory, [input.nickname]);
  const summaryLine = buildSummaryLine(normalizedMessageText, input.replyText);

  if (candidate.scope === 'discard') {
    return {
      profileUpdate: {
        nicknameHistory,
        relationshipSummary: input.currentProfile.relationshipSummary,
        lastInteractionAt: input.now,
      },
    };
  }

  const relationshipSummary = mergeSummaryLine(input.currentProfile.relationshipSummary, summaryLine);
  const plan: MemoryWritebackPlan = {
    profileUpdate: {
      nicknameHistory,
      relationshipSummary,
      lastInteractionAt: input.now,
    },
    summaryLine,
  };

  if (candidate.scope === 'long_term') {
    plan.profileUpdate.preferences = mergeUniqueStrings(input.currentProfile.preferences, [normalizedMessageText]);
    plan.factToPersist = {
      scope: 'long_term',
      fact: normalizedMessageText,
      confidence: Math.round(candidate.confidence * 100),
    };
  }

  if (candidate.scope === 'mid_term') {
    plan.factToPersist = {
      scope: 'mid_term',
      fact: normalizedMessageText,
      confidence: Math.round(candidate.confidence * 100),
    };
  }

  return plan;
}

function buildSummaryLine(messageText: string, replyText: string): string {
  const topic = truncateText(messageText.trim(), 28);
  const response = truncateText(replyText.trim(), 24);
  return `最近聊到${topic}，我回了${response}`;
}

function mergeSummaryLine(currentSummary: string, nextLine: string): string {
  const lines = [currentSummary.trim(), nextLine.trim()].filter((line) => line.length > 0);
  return Array.from(new Set(lines)).slice(-2).join('；').slice(0, 120);
}

function mergeUniqueStrings(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming.map((item) => item.trim()).filter((item) => item.length > 0)])];
}

function truncateText(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function normalizeMessageText(text: string): string {
  return text
    .replace(/^@\S+\s*/u, '')
    .trim();
}
