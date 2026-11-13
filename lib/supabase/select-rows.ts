/**
 * Reads a whole table, retrying a couple of times if the database hiccups.
 *
 * Before this, a failed read was treated as "no rows", so a one-off database
 * error showed up as a page full of zeros that looked like real data. Now it
 * retries, and if it still fails it throws so the page shows the error screen.
 */
export async function selectRows<T>(
  what: string,
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  attempts = 3
): Promise<T[]> {
  let lastMessage = "no response";
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await run();
      if (!error) return data ?? [];
      lastMessage = error.message;
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  throw new Error(`Could not read ${what}: ${lastMessage}`);
}
