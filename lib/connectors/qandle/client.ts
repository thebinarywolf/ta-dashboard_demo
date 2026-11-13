// Qandle HRMS API (see "the Qandle API guide"): a client_credentials
// token from POST /oauth/access-token, then GET /client-api/all-user with
// it as a Bearer token. The secret never leaves the server and is never put
// in an error message or log line.

export interface QandleConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export type QandleUser = Record<string, unknown>;

/** null when QANDLE_CLIENT_ID / QANDLE_CLIENT_SECRET aren't both set. */
export function getQandleConfig(): QandleConfig | null {
  const clientId = process.env.QANDLE_CLIENT_ID;
  const clientSecret = process.env.QANDLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    baseUrl: (process.env.QANDLE_BASE_URL ?? "https://your-company.qandle.com").replace(/\/+$/, ""),
    clientId,
    clientSecret,
  };
}

const TIMEOUT_MS = 60_000;

async function getAccessToken(config: QandleConfig): Promise<string> {
  const res = await fetch(`${config.baseUrl}/oauth/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    let reason = "";
    try {
      const body = (await res.json()) as { error?: string };
      reason = body.error ? `: ${body.error}` : "";
    } catch {
      // body wasn't JSON — status code alone is enough
    }
    throw new Error(
      `Qandle rejected the credentials (HTTP ${res.status}${reason}). Check QANDLE_CLIENT_ID / QANDLE_CLIENT_SECRET.`
    );
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Qandle returned no access_token.");
  return body.access_token;
}

/** Every employee Qandle returns, raw — callers must drop what they don't need. */
export async function fetchAllQandleUsers(config: QandleConfig): Promise<QandleUser[]> {
  const token = await getAccessToken(config);

  const res = await fetch(`${config.baseUrl}/client-api/all-user`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Qandle all-user request failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as { status?: string; data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new Error("Qandle all-user response had no data array.");
  }
  return body.data as QandleUser[];
}
