import type { ParsedAmazonItem } from "./types";

export type MatchableItem = {
  id: string;
  normalizedTitle: string;
};

export function findItemCandidates<T extends MatchableItem>(source: ParsedAmazonItem, existing: T[]): T[] {
  const sourceTitle = source.normalizedTitle;
  const exact = existing.filter((item) => item.normalizedTitle === sourceTitle);
  if (exact.length) return exact;

  return existing.filter((item) => {
    const shorter = item.normalizedTitle.length < sourceTitle.length ? item.normalizedTitle : sourceTitle;
    const longer = item.normalizedTitle.length < sourceTitle.length ? sourceTitle : item.normalizedTitle;
    return shorter.length >= 16 && longer.startsWith(shorter);
  });
}
