// The sheets are typed by hand, so the same source turns up spelled in several
// ways ("Job Enquiry", "Job enquiry", "job enquiry ", "apna" / "Apna"). These
// helpers treat spellings that differ only by capital letters or spaces as one
// source and show the spelling people used most.

export const sourceKey = (source: string): string => source.trim().replace(/\s+/g, " ").toLowerCase();

const tidy = (source: string): string => source.trim().replace(/\s+/g, " ");

/** Returns a function mapping any spelling to the most common spelling of it. */
export function makeSourceNamer(raws: Iterable<string | null | undefined>): (raw: string) => string {
  const counts = new Map<string, Map<string, number>>();
  for (const raw of raws) {
    if (!raw || !raw.trim()) continue;
    const key = sourceKey(raw);
    const spellings = counts.get(key) ?? new Map<string, number>();
    const label = tidy(raw);
    spellings.set(label, (spellings.get(label) ?? 0) + 1);
    counts.set(key, spellings);
  }
  const best = new Map<string, string>();
  for (const [key, spellings] of counts) {
    let top = "";
    let topCount = -1;
    for (const [label, n] of spellings) {
      // On a tie prefer the one that starts with a capital letter.
      const better = n > topCount || (n === topCount && /^[A-Z]/.test(label) && !/^[A-Z]/.test(top));
      if (better) {
        top = label;
        topCount = n;
      }
    }
    best.set(key, top);
  }
  return (raw) => best.get(sourceKey(raw)) ?? tidy(raw);
}

/** Merges rows whose source differs only by capitals or spaces (adds the counts). */
export function mergeSourceRows<T extends { source: string | null; total_candidates: number; joined_candidates: number }>(
  rows: T[]
): T[] {
  const merged = new Map<string, T & { _top: number }>();
  for (const row of rows) {
    if (!row.source) continue;
    const key = sourceKey(row.source);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row, source: tidy(row.source), _top: row.total_candidates });
      continue;
    }
    existing.total_candidates += row.total_candidates;
    existing.joined_candidates += row.joined_candidates;
    if (row.total_candidates > existing._top) {
      existing.source = tidy(row.source);
      existing._top = row.total_candidates;
    }
  }
  return Array.from(merged.values())
    .map(({ _top, ...row }) => row as unknown as T)
    .sort((a, b) => b.total_candidates - a.total_candidates);
}
