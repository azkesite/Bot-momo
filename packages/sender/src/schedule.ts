export type ScheduledSentence = {
  content: string;
  sentenceIndex: number;
  delayMs: number;
};

export function createSendSchedule(sentences: string[]): ScheduledSentence[] {
  return sentences.map((sentence, index) => ({
    content: sentence,
    sentenceIndex: index,
    delayMs: index === 0 ? 0 : chooseDelayMs(sentence.length),
  }));
}

function chooseDelayMs(length: number): number {
  if (length <= 8) {
    return 900;
  }

  if (length <= 20) {
    return 1200;
  }

  if (length <= 35) {
    return 1800;
  }

  return 2200;
}
