// The contract of opt-out usage statistics (anonymous counts, no cookies, no identifiers). The Worker, the app and the
// VitePress docs config all import it from here, so they agree on the events, the opt-out flag and the beacon. It
// has no imports on purpose: VitePress config, Node and bundlers load it the same way.

/** The events the Worker counts in Workers Analytics Engine. */
export const USAGE_EVENTS = ['token_created', 'token_refreshed', 'token_revoked', 'installer_download'] as const;

/** One of the counted {@link USAGE_EVENTS}. */
export type UsageEvent = (typeof USAGE_EVENTS)[number];

/**
 * The `localStorage` key of the device-level opt-out flag. The app mirrors the account's setting into it; it survives
 * signing out, so the landing page and the docs, which cannot know the account, honour it too.
 */
export const USAGE_STATISTICS_OFF_KEY = 'githq.usageStatistics';

/** The value of {@link USAGE_STATISTICS_OFF_KEY} that means statistics are off. */
export const USAGE_STATISTICS_OFF_VALUE = 'off';

/**
 * The field the app adds as `false` to the body of an OAuth request (token exchange, revoke, refresh) when statistics
 * are off, so the Worker does not count it.
 */
export const USAGE_STATISTICS_FIELD = 'telemetry';

/**
 * The public Cloudflare Web Analytics site token of githq.dev. It is public (it ships in every page), not a secret.
 * TODO: replace the placeholder with the real token from the Cloudflare dashboard.
 */
export const CLOUDFLARE_WEB_ANALYTICS_TOKEN = 'REPLACE_WITH_CLOUDFLARE_WEB_ANALYTICS_TOKEN';

/** The host that is counted; any other (localhost, previews, the desktop webview) loads nothing. */
const COUNTED_HOST = 'githq.dev';

/** Options of {@link getBeaconLoaderScript}. */
export interface BeaconLoaderOptions {
    /**
     * Whether the page navigates client-side. `false` on the prerendered landing page, so only the visit is counted;
     * `true` on the docs site.
     */
    spa: boolean;
}

/**
 * The source of a small IIFE to inline into an HTML `<script>`. It loads Cloudflare's cookieless Web Analytics beacon
 * only on githq.dev and only when the opt-out flag is not set. An unavailable `localStorage` (private mode) skips the
 * beacon rather than throwing.
 * @__NO_SIDE_EFFECTS__
 */
export function getBeaconLoaderScript({ spa }: BeaconLoaderOptions): string {
    const beaconData = JSON.stringify({ token: CLOUDFLARE_WEB_ANALYTICS_TOKEN, spa });
    return `(function(){
if(location.hostname!==${JSON.stringify(COUNTED_HOST)})return;
try{if(localStorage.getItem(${JSON.stringify(USAGE_STATISTICS_OFF_KEY)})===${JSON.stringify(USAGE_STATISTICS_OFF_VALUE)})return;}catch(e){return;}
var s=document.createElement('script');
s.defer=true;
s.src='https://static.cloudflareinsights.com/beacon.min.js';
s.setAttribute('data-cf-beacon',${JSON.stringify(beaconData)});
document.head.appendChild(s);
})();`;
}
