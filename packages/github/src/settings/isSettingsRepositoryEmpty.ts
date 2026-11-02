import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { SETTINGS_REPOSITORY_NAME } from './getSettingsRepository.js';

/**
 * Whether the user's settings repository holds no commit (`GET /repos/{owner}/githq-settings/commits`, which GitHub
 * answers with a 409 for an empty repository) — one githq created and never wrote its file to, which is still
 * githq's to use. Throws `GitHubApiError` on any other refusal, a 404 for no repository too.
 */
export async function isSettingsRepositoryEmpty(rest: GitHubRestRequester, owner: string): Promise<boolean> {
    try {
        await rest({
            url: `/repos/${encodeURIComponent(owner)}/${SETTINGS_REPOSITORY_NAME}/commits`,
            query: { per_page: '1' },
        });
        return false;
    } catch (error) {
        if (error instanceof GitHubApiError && error.status === 409) {
            return true;
        }

        throw error;
    }
}
