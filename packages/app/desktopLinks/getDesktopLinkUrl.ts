/**
 * The address that opens a githq screen in the desktop app: `githq://` and the screen's address without its leading
 * slash, so that it mirrors github.com's (`/acme/web/pull/1?x=1#c` → `githq://acme/web/pull/1?x=1#c`; `/` → `githq://`).
 * @__NO_SIDE_EFFECTS__
 */
export function getDesktopLinkUrl(fullPath: string): string {
    return `githq://${fullPath.replace(/^\//, '')}`;
}
