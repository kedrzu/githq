import { defineInterface } from '@nzyme/ioc/Interface.js';

/** The operating system's window controls, as far as they take up room in the page. */
export interface WindowControlsShape {
    /**
     * Whether the controls are over the window's top left corner right now, for the page to keep clear; reactive. Never
     * on the web or under a title bar of their own, and not in macOS's full screen, which hides them.
     */
    readonly overlaid: boolean;
}

/** The seam between the app's shell and the desktop app's window; set by `installDesktop` on a Mac. */
export const WindowControls = defineInterface<WindowControlsShape>({
    name: 'WindowControls',
    default: () => ({ overlaid: false }),
});
