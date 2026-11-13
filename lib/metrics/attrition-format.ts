export function pctText(n: number | null): string {
  return n === null ? "–" : `${n.toFixed(1)}%`;
}

export function countText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Groups with fewer than this many people on average get a "Few people" tag: with
 *  so few people the attrition % swings wildly (1 of 1 leaving shows 200%). */
export const SMALL_GROUP_AVERAGE_STAFF = 3;

export function isSmallGroup(averageHeadcount: number): boolean {
  return averageHeadcount < SMALL_GROUP_AVERAGE_STAFF;
}
