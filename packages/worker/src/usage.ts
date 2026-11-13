import { USAGE_STATISTICS_FIELD } from '@githq/github/usageStatistics.js';
import type { UsageEvent } from '@githq/github/usageStatistics.js';

import type { WorkerEnv } from './WorkerEnv.js';

/**
 * Which app made a counted request: the web app, the desktop app, or `''` where it is not an app's call (an installer
 * download).
 */
export type UsageClient = 'web' | 'desktop' | '';

/** What {@link recordUsage} writes besides the event. */
export interface UsageContext {
    client: UsageClient;
    /** The installer's name (`DesktopInstaller`) for `installer_download`, `''` otherwise. */
    platform: string;
}

/**
 * Counts one {@link UsageEvent} in Workers Analytics Engine. The data point is the whole contract read by the stats
 * script: `blobs: [event, client, platform]`, `doubles: [1]`, `indexes: [event]` — nothing else, so no code, token,
 * IP, User-Agent or country is ever written. Fire-and-forget: `writeDataPoint` returns nothing to wait for, and a
 * missing binding or one that throws changes nothing in the answer.
 */
export function recordUsage(env: WorkerEnv, event: UsageEvent, { client, platform }: UsageContext): void {
    if (!env.USAGE) {
        return;
    }
    try {
        env.USAGE.writeDataPoint({ blobs: [event, client, platform], doubles: [1], indexes: [event] });
    } catch {
        console.warn('Usage data point not written');
    }
}

/**
 * The app behind an `/api/*` request. The web app calls from the Worker's own origin (or sends no `Origin`); on
 * `/api/*` only the refresh and the revocation answer CORS, and the desktop app's webview calls them from its own
 * origin, so any other origin is the desktop app.
 * @__NO_SIDE_EFFECTS__
 */
export function getUsageClient(request: Request): UsageClient {
    const origin = request.headers.get('origin');
    return origin == null || origin === new URL(request.url).origin ? 'web' : 'desktop';
}

/**
 * Whether the request's body turned statistics off: the app adds `telemetry: false` (`USAGE_STATISTICS_FIELD`) when
 * the user did.
 * @__NO_SIDE_EFFECTS__
 */
export function isUsageOptedOut(body: unknown): boolean {
    return (
        typeof body === 'object' &&
        body !== null &&
        USAGE_STATISTICS_FIELD in body &&
        body[USAGE_STATISTICS_FIELD] === false
    );
}
