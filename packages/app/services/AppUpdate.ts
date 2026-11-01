import { defineInterface } from '@nzyme/ioc/Interface.js';

/**
 * A new version of the app, downloaded and waiting for the user: the desktop app's status bar says so, and the
 * command menu offers to restart into it. Nothing restarts without the user's word.
 */
export interface AppUpdateShape {
    /** The version ready to run (`1.4.0`) while it is offered; `null` before, and after "Later"; reactive. */
    readonly readyVersion: string | null;
    /** Restarts into the ready version. */
    restart(): void;
    /** Stops offering it until the app next starts. */
    later(): void;
}

/** The app's updates: none on the web, where every load is the latest; the desktop app sets its own (`desktop/`). */
export const AppUpdate = defineInterface<AppUpdateShape>({
    name: 'AppUpdate',
    default: () => ({
        readyVersion: null,
        restart: () => {},
        later: () => {},
    }),
});
