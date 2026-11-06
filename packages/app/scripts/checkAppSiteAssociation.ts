import { DOWNLOAD_PATH } from '@/landing/desktopBuilds.js';
import { OAUTH_CALLBACK_PATH } from '@githq/github/oauth.js';

/** The app the file names: the Team ID of the Developer ID the app is signed with, and its bundle identifier. */
const APP_ID = '36227N57ZP.dev.githq.desktop';

/**
 * What stays in the browser whatever else the file says. `/login` is `SIGN_IN_PATH`, spelled out: the module holding it
 * reads `__DESKTOP__`, which only a build defines, and this runs after one.
 */
const BROWSER_ONLY_PATHS = [
    '/',
    DOWNLOAD_PATH,
    '/login',
    OAUTH_CALLBACK_PATH,
    '/api/auth/token',
    '/_landing',
    '/_nuxt/entry.js',
    '/_ipx/w_640/landing/shot.webp',
    '/.well-known/apple-app-site-association',
];

/** The app's screens, a repository with a dot in its name among them, which a careless `/*.*` would give away. */
const APP_PATHS = ['/acme/web/issues/12', '/vercel/next.js/pull/7', '/settings', '/pulls/mentioned'];

interface AppLinkComponent {
    readonly path: string;
    readonly exclude: boolean;
}

/**
 * What is wrong with the `apple-app-site-association` file: it must be JSON, name the app, leave in the browser
 * everything but the app's screens — the files of the build (`builtPaths`) too — and claim those screens.
 */
export function checkAppSiteAssociation(content: string, builtPaths: readonly string[]): string[] {
    const details = readDetails(content);
    if (!details) {
        return ['apple-app-site-association: not the JSON Apple reads'];
    }

    const problems: string[] = [];
    if (!details.appIds.includes(APP_ID)) {
        problems.push(`apple-app-site-association: does not name ${APP_ID}`);
    }

    // What is served at the root: `_headers` is not, and the output's folders are listed too.
    const builtFiles = builtPaths.filter(file => /^[^./][^/]*\.[^/]+$/.test(file)).map(file => `/${file}`);
    for (const path of [...BROWSER_ONLY_PATHS, ...builtFiles]) {
        if (isClaimed(path, details.components)) {
            problems.push(`apple-app-site-association: claims ${path}, which must stay in the browser`);
        }
    }

    for (const path of APP_PATHS) {
        if (!isClaimed(path, details.components)) {
            problems.push(`apple-app-site-association: does not claim ${path}`);
        }
    }

    return problems;
}

/** Whether the app opens `path`: the first component matching it decides, as on Apple's side; none means no. */
function isClaimed(path: string, components: readonly AppLinkComponent[]) {
    const component = components.find(({ path: pattern }) => toRegExp(pattern).test(path));
    return component !== undefined && !component.exclude;
}

/** A component's pattern as a regular expression: `*` is any characters, `/` among them, `?` is one. */
function toRegExp(pattern: string) {
    const source = pattern
        .replaceAll(/[$()+.[\\\]^{|}]/g, '\\$&')
        .replaceAll('*', '.*')
        .replaceAll('?', '.');
    return new RegExp(`^${source}$`);
}

function readDetails(content: string) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return null;
    }

    const detail = getField(getField(parsed, 'applinks'), 'details');
    const first: unknown = Array.isArray(detail) ? detail[0] : undefined;
    const appIds: unknown = getField(first, 'appIDs');
    const components: unknown = getField(first, 'components');
    if (!Array.isArray(appIds) || !Array.isArray(components)) {
        return null;
    }

    return {
        appIds: appIds.filter(id => typeof id === 'string'),
        components: components.flatMap((component: unknown): AppLinkComponent[] => {
            const path = getField(component, '/');
            return typeof path === 'string' ? [{ path, exclude: getField(component, 'exclude') === true }] : [];
        }),
    };
}

function getField(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null && key in value
        ? Object.entries(value).find(([name]) => name === key)?.[1]
        : undefined;
}
