/**
 * Prepares the app for the desktop app's window (`packages/desktop`) before any of its services start. The one way
 * in for the desktop code (`desktop/`): only the desktop build calls it (`__DESKTOP__`, `plugins/iocPlugin.ts`), so
 * the web builds drop it with everything it imports.
 */
export function installDesktop() {
    // The desktop build reaches the native side through what Tauri injects into its window. Opened anywhere else (a
    // browser), it stops here rather than run half working.
    if (!('__TAURI_INTERNALS__' in window)) {
        throw new Error('The desktop build of githq runs in the githq desktop app only');
    }
}
