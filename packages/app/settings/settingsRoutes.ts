import type { LocationQuery } from 'vue-router';

/** Settings (D15), at GitHub's own settings address, so no owner's address (`/owner`) is ever taken for it. */
export const SETTINGS_PATH = '/settings';

/** The sections of Settings, in the order of its tabs; each one's `?tab=`. */
export const SETTINGS_SECTIONS = ['repositories', 'projects', 'saving', 'account'] as const;

/** A section of Settings. */
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * The section an address's `?tab=` names; none, or one not known, is the first.
 * @__NO_SIDE_EFFECTS__
 */
export function readSettingsSection(tab: LocationQuery[string] | undefined): SettingsSection {
    return SETTINGS_SECTIONS.find(section => section === tab) ?? 'repositories';
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
