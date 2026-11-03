import type { BrowserShape } from '@/services/Browser.js';

import { JobLogRefusal } from '@/workflows/utils/JobLogRefusal.js';

import type { NativeBridgeShape } from './NativeBridge.js';

/** The one address the native side reads, as `readJobLog` in `@githq/github` asks for it. */
const JOB_LOG_URL = /^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/actions\/jobs\/(\d+)\/logs$/u;

/**
 * The browser of the desktop app's window, reading a job's log through the native side: GitHub redirects it to a blob
 * the window's content security policy keeps out of reach (actions D3). Everything else goes the usual way. It answers
 * as `fetch` would, so what comes of an answer — "gone", a refusal's status, the allowance — is decided as on the web.
 * With no answer it fails as `fetch` would when GitHub could not be reached; the native side turning the log down is a
 * {@link JobLogRefusal}, GitHub having no part in it.
 */
export function withNativeJobLogs<TBrowser extends Pick<BrowserShape, 'fetch'>>(
    browser: TBrowser,
    bridge: Pick<NativeBridgeShape, 'readJobLog'>,
): TBrowser {
    return {
        ...browser,
        fetch: async (input, init) => {
            const url = input instanceof Request ? input.url : input.toString();
            const [, owner, name, jobId] = JOB_LOG_URL.exec(url) ?? [];
            if (owner === undefined || name === undefined || jobId === undefined) {
                return await browser.fetch(input, init);
            }

            const token = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /u, '') ?? '';
            try {
                const { status, headers, text } = await bridge.readJobLog({ owner, name, jobId: Number(jobId), token });
                return new Response(text, { status, headers });
            } catch (error) {
                throw toLogFailure(error);
            }
        },
    };
}

/** What `read_job_log` rejected with, as what is thrown: only `offline` is no answer. */
function toLogFailure(code: unknown) {
    switch (code) {
        case 'tooLarge':
            return new JobLogRefusal('tooLarge');
        case 'refused':
        case 'invalid':
        case 'failed':
            return new JobLogRefusal('refused');
        default:
            return code;
    }
}
