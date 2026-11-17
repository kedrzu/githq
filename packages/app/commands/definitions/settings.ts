import { RefreshCw } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './settings.loc.js';

/**
 * Goes to a section of Settings by its place in the column (`1` Repositories … `8` Updates; commands D9), on Settings
 * itself; the command menu's level under Settings has rows of its own for them. The binding names the section and gives
 * its icon.
 */
export const goToSettingsSection = defineAppCommand({
    id: 'goToSettingsSection',
    title: l.goToSettingsSection,
    numbers: { first: 1, last: 8 },
    places: ['settings'],
});

/**
 * Asks whether a newer githq is out (desktop app): in Settings' Updates section by its key; the command menu's level
 * under Updates has a row of its own for it.
 */
export const checkForUpdates = defineAppCommand({
    id: 'checkForUpdates',
    title: l.checkForUpdates,
    icon: RefreshCw,
    key: 'U',
    places: ['settings'],
});

/**
 * On the first sign-in, loads the settings found on GitHub in place of this device's and turns on syncing them
 * (settings-sync G11).
 */
export const loadSavedSettings = defineAppCommand({
    id: 'loadSavedSettings',
    title: l.loadSavedSettings,
    key: 'Mod+Enter',
    places: ['signIn'],
});

/** In Sync settings, combines this device's settings with those found on GitHub and turns on syncing them (T6). */
export const combineSettings = defineAppCommand({
    id: 'combineSettings',
    title: l.combineSettings,
    key: 'Mod+Enter',
    places: ['settings'],
});

/** Leaves both sides as they were, rather than combining this device's settings with GitHub's (settings-sync T6). */
export const cancelCombining = defineAppCommand({
    id: 'cancelCombining',
    title: l.cancelCombining,
    key: 'Escape',
    places: ['settings'],
    configurable: false,
});

/** Turns off syncing the settings to GitHub (settings-sync T4, T7); the repository stays. */
export const turnOffSync = defineAppCommand({
    id: 'turnOffSync',
    title: l.turnOffSync,
    places: ['settings'],
});

/**
 * The desktop app's sign-in screen's next step (S1–S3): signing in with GitHub, copying the code and opening GitHub, or
 * a new code after a failure. The binding names it.
 */
export const signIn = defineAppCommand({
    id: 'signIn',
    title: l.signIn,
    key: 'Enter',
    places: ['signIn'],
    configurable: false,
});

/** Abandons the device code the desktop app's sign-in waits on, also while it is being asked for (S2). */
export const cancelSignIn = defineAppCommand({
    id: 'cancelSignIn',
    title: l.cancelSignIn,
    key: 'Escape',
    places: ['signIn'],
    configurable: false,
});
