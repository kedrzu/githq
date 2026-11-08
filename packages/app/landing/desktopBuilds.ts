import { getDesktopInstallerUrl } from '@githq/github/desktopInstallers.js';

import { RELEASES_URL } from './landingLinks.js';

/** A system the desktop app has builds for. */
export type DesktopSystem = 'linux' | 'macos' | 'windows';

/** The address of `/download`, the page with every build. */
export const DOWNLOAD_PATH = '/download';

/** The Development stream's one release on GitHub. */
export const DEVELOPMENT_RELEASE_URL = `${RELEASES_URL}/tag/development`;

/** Every installer `/download` lists, in its order, each at its fixed link on githq.dev. */
export const DESKTOP_BUILDS = {
    macosSilicon: { system: 'macos', file: '.dmg', url: getDesktopInstallerUrl('macos-silicon') },
    macosIntel: { system: 'macos', file: '.dmg', url: getDesktopInstallerUrl('macos-intel') },
    windows: { system: 'windows', file: '-setup.exe', url: getDesktopInstallerUrl('windows') },
    linuxAppImage: { system: 'linux', file: '.AppImage', url: getDesktopInstallerUrl('linux-appimage') },
    linuxDeb: { system: 'linux', file: '.deb', url: getDesktopInstallerUrl('linux-deb') },
} as const satisfies Record<string, { system: DesktopSystem; file: string; url: string }>;

/** A key of {@link DESKTOP_BUILDS}. */
export type DesktopBuildId = keyof typeof DESKTOP_BUILDS;

/**
 * The build one click downloads on each system. A Mac is taken for Apple Silicon: a browser can't reliably tell it
 * from Intel, so `/download` lists Intel right below it.
 */
export const DEFAULT_DESKTOP_BUILD = {
    macos: 'macosSilicon',
    windows: 'windows',
    linux: 'linuxAppImage',
} as const satisfies Record<DesktopSystem, DesktopBuildId>;

/** What {@link detectDesktopSystem} reads of the browser's `navigator`. */
export interface DesktopSystemHints {
    readonly userAgent: string;
    readonly maxTouchPoints: number;
}

/**
 * The visitor's system, or `null` when there is nothing to install on it: a phone, a tablet, or a system with no build.
 * An iPad asks for desktop pages and says it is a Mac; only its touch screen gives it away.
 */
export function detectDesktopSystem({ userAgent, maxTouchPoints }: DesktopSystemHints): DesktopSystem | null {
    if (/android|iphone|ipad|ipod|cros/i.test(userAgent)) {
        return null;
    }
    if (/macintosh|mac os x/i.test(userAgent)) {
        return maxTouchPoints > 1 ? null : 'macos';
    }
    if (/windows/i.test(userAgent)) {
        return 'windows';
    }
    return /linux/i.test(userAgent) ? 'linux' : null;
}
