import { getLocalDb } from "./client";

export function getHotPositionIdsLocal(): string[] {
  const rows = getLocalDb().prepare("SELECT position_id FROM hot_positions").all() as { position_id: string }[];
  return rows.map((r) => r.position_id);
}

export function setHotPositionLocal(positionId: string, hot: boolean, markedBy: string | null): void {
  const db = getLocalDb();
  if (hot) {
    db.prepare("INSERT OR REPLACE INTO hot_positions (position_id, marked_by, marked_at) VALUES (?, ?, ?)").run(
      positionId,
      markedBy,
      new Date().toISOString()
    );
  } else {
    db.prepare("DELETE FROM hot_positions WHERE position_id = ?").run(positionId);
  }
}
