import type { GitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { SETTINGS_REPOSITORY_NAME } from './getSettingsRepository.js';

/**
 * Creates the user's private, empty settings repository (`POST /user/repos`); the first write of the file
 * initialises it. Throws `GitHubApiError` when GitHub refuses — a 422 when one of that name exists.
 */
export async function createSettingsRepository(rest: GitHubRestRequester): Promise<void> {
    await rest({
        method: 'POST',
        url: '/user/repos',
        body: {
            name: SETTINGS_REPOSITORY_NAME,
            private: true,
            auto_init: false,
            description: 'Settings of githq (https://githq.dev), kept here at your request. Safe to delete.',
        },
    });
}
