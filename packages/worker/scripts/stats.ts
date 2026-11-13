/**
 * Prints the last 30 days of usage statistics from Workers Analytics Engine, newest day first: how often each event
 * happened, by client and platform (the data point's layout is in `src/usage.ts`). Run it with
 * `bun --cwd packages/worker stats`; the token comes from the secret store (the `secrets` skill).
 */
import { readFile } from 'node:fs/promises';

const TOKEN_VARIABLE = 'CLOUDFLARE_ANALYTICS_TOKEN';

const QUERY = `
SELECT
    toStartOfDay(timestamp) AS day,
    blob1 AS event,
    blob2 AS client,
    blob3 AS platform,
    SUM(_sample_interval) AS total
FROM githq_usage
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, event, client, platform
ORDER BY day DESC, event, client, platform
FORMAT JSON`;

const COLUMNS = ['day', 'event', 'client', 'platform', 'total'] as const;

type StatsRow = Record<(typeof COLUMNS)[number], string>;

const token = process.env[TOKEN_VARIABLE];
if (!token) {
    console.error(
        `${TOKEN_VARIABLE} is not set. Create a Cloudflare API token (My Profile → API Tokens, permission ` +
            'Account → Account Analytics → Read) and store it once with:\n\n' +
            '  GITHQ_ENV=stats bun nzyme secrets set CLOUDFLARE_ANALYTICS_TOKEN ' +
            '--prompt="Cloudflare API token with Account Analytics: Read"\n\n' +
            'then run `bun --cwd packages/worker stats`.',
    );
    process.exit(1);
}

const accountId = await readAccountId();
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: QUERY,
});
if (!response.ok) {
    console.error(`Analytics Engine answered ${response.status}: ${await response.text()}`);
    process.exit(1);
}
printTable(readRows(await response.json()));

/** The account is named in `wrangler.jsonc` (JSONC: comments, so not `JSON.parse`). */
async function readAccountId(): Promise<string> {
    const config = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    const match = /^\s*"account_id":\s*"([0-9a-f]+)"/m.exec(config);
    if (!match?.[1]) {
        throw new Error('No account_id in packages/worker/wrangler.jsonc');
    }
    return match[1];
}

/** The `data` rows of a `FORMAT JSON` answer, every value as text. */
function readRows(body: unknown): StatsRow[] {
    if (typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
        throw new Error('Unexpected answer from Analytics Engine: no data array');
    }
    return body.data.map((row: Record<string, unknown>) => ({
        day: String(row.day).slice(0, 10),
        event: String(row.event),
        client: String(row.client),
        platform: String(row.platform),
        total: String(Math.round(Number(row.total))),
    }));
}

function printTable(rows: readonly StatsRow[]): void {
    if (rows.length === 0) {
        console.log('No usage in the last 30 days.');
        return;
    }
    const widths = COLUMNS.map(column => Math.max(column.length, ...rows.map(row => row[column].length)));
    const line = (cells: readonly string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ');
    console.log(line(COLUMNS));
    console.log(line(widths.map(width => '-'.repeat(width))));
    for (const row of rows) {
        console.log(line(COLUMNS.map(column => row[column])));
    }
}
