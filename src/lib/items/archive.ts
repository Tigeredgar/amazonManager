export function getItemArchiveChanges(archived: boolean, now = new Date()) {
  return archived
    ? { archivedAt: now, updatedAt: now }
    : { archivedAt: null, decision: "undecided" as const, updatedAt: now };
}
