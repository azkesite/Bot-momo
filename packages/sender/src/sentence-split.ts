export type SentenceSplitResult = {
  sentences: string[];
  split: boolean;
};

const CONNECTOR_PATTERNS = ['但是', '不过', '所以', '然后', '先', '再', '因为'];
const SERIOUS_PATTERNS = ['抱歉', '不能', '不行', '提醒一下', '澄清一下'];

export function splitReplyText(text: string): SentenceSplitResult {
  const normalized = text.trim();

  if (shouldKeepSingleSentence(normalized)) {
    return {
      sentences: [normalized],
      split: false,
    };
  }

  const targetCount = chooseSentenceTargetCount(normalized);
  const sentences = splitByPunctuation(normalized, targetCount);

  return {
    sentences,
    split: sentences.length > 1,
  };
}

function shouldKeepSingleSentence(text: string): boolean {
  if (text.length <= 22) {
    return true;
  }

  if (SERIOUS_PATTERNS.some((pattern) => text.includes(pattern))) {
    return true;
  }

  if (/https?:\/\//u.test(text) || /[A-Za-z]:\\/u.test(text) || /```/u.test(text)) {
    return true;
  }

  if (text.length <= 45 && !hasStrongSplitTrigger(text)) {
    return true;
  }

  return false;
}

function chooseSentenceTargetCount(text: string): number {
  if (text.length > 90 || hasStrongSplitTrigger(text)) {
    return 3;
  }

  return 2;
}

function hasStrongSplitTrigger(text: string): boolean {
  return CONNECTOR_PATTERNS.some((pattern) => text.includes(pattern));
}

function splitByPunctuation(text: string, targetCount: number): string[] {
  const primary = text
    .split(/(?<=[，。！？；])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (primary.length <= 1) {
    return chunkText(text, targetCount);
  }

  if (primary.length <= 4) {
    return primary;
  }

  return primary.slice(0, 4);
}

function chunkText(text: string, targetCount: number): string[] {
  const count = Math.min(Math.max(targetCount, 2), 4);
  const chunkSize = Math.ceil(text.length / count);
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize).trim());
  }

  return chunks.filter((chunk) => chunk.length > 0).slice(0, 4);
}
