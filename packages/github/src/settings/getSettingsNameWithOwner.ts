import { SETTINGS_REPOSITORY_NAME } from './getSettingsRepository.js';

/**
 * `<login>/githq-settings`: how the user's settings repository is named to them, on GitHub and in a line of text.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getSettingsNameWithOwner(login: string) {
    return `${login}/${SETTINGS_REPOSITORY_NAME}`;
}
