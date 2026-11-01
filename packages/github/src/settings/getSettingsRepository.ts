import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequester } from '../rest/createGitHubRestRequester.js';

/** The name of the repository githq keeps the user's settings in, in their account (settings-sync D6). */
export const SETTINGS_REPOSITORY_NAME = 'githq-settings';

/** The user's settings repository, if there is one. */
export type GetSettingsRepositoryResult =
    | { readonly exists: false }
    | {
          readonly exists: true;
          readonly private: boolean;
          /** Its node id. */
          readonly id: string | undefined;
      };

/**
 * Looks up `<owner>/githq-settings` (`GET /repos/{owner}/githq-settings`); one GitHub does not show — none, or
 * deleted — does not exist. Throws {@link GitHubApiError} on any other refusal.
 */
export async function getSettingsRepository(
    rest: GitHubRestRequester,
    owner: string,
): Promise<GetSettingsRepositoryResult> {
    try {
        const { payload } = await rest({
            url: `/repos/${encodeURIComponent(owner)}/${SETTINGS_REPOSITORY_NAME}`,
        });
        if (!isPlainObject(payload) || typeof payload.private !== 'boolean') {
            throw new GitHubApiError({ status: 200, message: 'GitHub repository answer is malformed' });
        }

        return {
            exists: true,
            private: payload.private,
            id: typeof payload.node_id === 'string' ? payload.node_id : undefined,
        };
    } catch (error) {
        if (error instanceof GitHubApiError && error.status === 404) {
            return { exists: false };
        }

        throw error;
    }
}
