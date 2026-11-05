import type { LocationQuery, RouteLocationNormalizedLoaded } from 'vue-router';

/** Settings (D15), at GitHub's own settings address, so no owner's address (`/owner`) is ever taken for it. */
export const SETTINGS_PATH = '/settings';

/**
 * Settings' Updates section with the confirmation of switching to Stable open (U13): the one way a Development build
 * leaves for Stable from outside that section. The section only has to read `confirm`; only its dialog switches.
 */
export const CONFIRM_STABLE_PATH = `${SETTINGS_PATH}?tab=updates&confirm=stable`;

/** A section of Settings. */
export type SettingsSection =
    | 'account'
    | 'display'
    | 'projects'
    | 'repositories'
    | 'review'
    | 'sync'
    | 'updates'
    | 'changelog';

/**
 * The sections of Settings, in the order of its column, each one's key following from its place; each one's `?tab=`, but the first, which has none. Updates and
 * Changelog are the desktop app's (`__DESKTOP__`): on the web they aren't, so nothing offers them and their `?tab=` is
 * not known.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
    'repositories',
    'projects',
    'display',
    'review',
    'sync',
    'account',
    ...(__DESKTOP__ ? (['updates', 'changelog'] as const) : []),
];

/** Sections about the settings' saving, or the app itself: the status bar doesn't say there where settings are saved. */
const SECTIONS_NOT_SAYING_WHERE_SAVED: readonly SettingsSection[] = ['sync', 'account', 'updates', 'changelog'];

/** The screens of Settings that aren't `/settings` itself: a tracked repository's and a tracked project's settings. */
const TRACKED_SETTINGS_ROUTES: readonly unknown[] = [
    'repository-settings',
    'project-org-settings',
    'project-user-settings',
];

/**
 * The section an address's `?tab=` names; none, or one not known (an old address's `tracking` or `saving` among
 * them), is the first.
 * @__NO_SIDE_EFFECTS__
 */
export function readSettingsSection(tab: LocationQuery[string] | undefined): SettingsSection {
    return SETTINGS_SECTIONS.find(section => section === tab) ?? 'repositories';
}

/**
 * Whether the screen at `route` is one of Settings whose status bar says where the settings are saved (githq D26).
 * @__NO_SIDE_EFFECTS__
 */
export function saysWhereSettingsAreSaved(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'query'>) {
    return route.name === 'settings'
        ? !SECTIONS_NOT_SAYING_WHERE_SAVED.includes(readSettingsSection(route.query.tab))
        : TRACKED_SETTINGS_ROUTES.includes(route.name);
}

/**
 * The address of a section of Settings, the first being Settings' own, with `search` already in its search field.
 * @__NO_SIDE_EFFECTS__
 */
export function getSettingsPath(section: SettingsSection, search?: string) {
    const query = new URLSearchParams();
    if (section !== 'repositories') {
        query.set('tab', section);
    }

    if (search) {
        query.set('q', search);
    }

    const params = query.toString();
    return params ? `${SETTINGS_PATH}?${params}` : SETTINGS_PATH;
}
