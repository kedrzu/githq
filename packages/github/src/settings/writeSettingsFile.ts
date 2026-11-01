import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { getSettingsFileUrl } from './readSettingsFile.js';

/** What to write to the user's settings file, over which version. */
export interface WriteSettingsFileParams {
    /** The user's login: the repository's owner. */
    readonly owner: string;
    readonly text: string;
    /** The sha of the version replaced; `null` to create the file. */
    readonly sha: string | null;
}

/** Written, with the new version's sha — or refused because the file is not the version named any more. */
export type WriteSettingsFileResult =
    | { readonly kind: 'written'; readonly sha: string }
    | { readonly kind: 'conflict' };

/**
 * Writes `settings.json` of the user's settings repository as one commit (`PUT …/contents/settings.json`). GitHub
 * refuses a write over another version than `sha` — 409 for a stale sha, 422 for none while the file exists, 409
 * too while a new repository is not ready — which comes back as a conflict: read again, merge, write. Throws
 * `GitHubApiError` on any other refusal.
 */
export async function writeSettingsFile(
    rest: GitHubRestRequester,
    params: WriteSettingsFileParams,
): Promise<WriteSettingsFileResult> {
    let answer;
    try {
        answer = await rest({
            method: 'PUT',
            url: getSettingsFileUrl(params.owner),
            body: {
                message: 'Save githq settings',
                content: encodeBase64Text(params.text),
                ...(params.sha === null ? {} : { sha: params.sha }),
            },
        });
    } catch (error) {
        if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
            return { kind: 'conflict' };
        }

        throw error;
    }

    const { payload } = answer;
    const content = isPlainObject(payload) ? payload.content : undefined;
    if (!isPlainObject(content) || typeof content.sha !== 'string') {
        throw new GitHubApiError({ status: answer.status, message: 'GitHub file write answer is malformed' });
    }

    return { kind: 'written', sha: content.sha };
}

function encodeBase64Text(text: string) {
    return btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCodePoint(byte)).join(''));
}
