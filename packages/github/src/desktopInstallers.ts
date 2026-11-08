/** githq's releases on GitHub, where every desktop installer lives. */
export const GITHQ_RELEASES_URL = 'https://github.com/kedrzu/githq/releases';

/**
 * Where githq.dev keeps a fixed link to each installer of the latest Stable release: `/download/<build>`. The Worker
 * answers it with a redirect to the release's file, which has the version in its name (`packages/worker/src/download.ts`).
 * `/download` itself is the app's page with every build.
 */
export const DESKTOP_INSTALLER_PATH = '/download';

/**
 * Every installer a Stable release has, by the last segment of its link, with the end of its file name: Tauri names
 * it `githq_<version>_<ending>`.
 */
export const DESKTOP_INSTALLERS = {
    'macos-silicon': 'aarch64.dmg',
    'macos-intel': 'x64.dmg',
    windows: 'x64-setup.exe',
    'linux-appimage': 'amd64.AppImage',
    'linux-deb': 'amd64.deb',
} as const satisfies Record<string, string>;

/** A key of {@link DESKTOP_INSTALLERS}. */
export type DesktopInstaller = keyof typeof DESKTOP_INSTALLERS;

/**
 * The fixed link to an installer of the latest Stable release. Absolute, so that the SPA's router never takes it for one
 * of its own pages: the browser goes to the Worker, also from `nuxt dev`.
 */
export function getDesktopInstallerUrl(installer: DesktopInstaller): string {
    return `https://githq.dev${DESKTOP_INSTALLER_PATH}/${installer}`;
}

/** The installer's file in the release tagged `v<version>`. */
export function getDesktopInstallerAssetUrl(installer: DesktopInstaller, version: string): string {
    return `${GITHQ_RELEASES_URL}/download/v${version}/githq_${version}_${DESKTOP_INSTALLERS[installer]}`;
}
