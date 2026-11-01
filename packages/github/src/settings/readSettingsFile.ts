import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import type { GitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { SETTINGS_REPOSITORY_NAME } from './getSettingsRepository.js';

/** The path of the settings file in the settings repository (settings-sync D13). */
export const SETTINGS_FILE_PATH = 'settings.json';

/** Which user's settings file to read, and the ETag of the copy held. */
export interface ReadSettingsFileParams {
    /** The user's login: the repository's owner. */
    readonly owner: string;
    /** The ETag of the last 200: GitHub answers 304, free of quota, while the file did not change. */
    readonly etag: string | null;
}

/**
 * The file did not change since the ETag, there is none (or no repository), the file as it is now, or an answer that
 * is not a file githq can read — a directory of that name, or a file too large for GitHub to send (`encoding: none`).
 */
export type ReadSettingsFileResult =
    | { readonly status: 304 }
    | { readonly status: 404 }
    | { readonly status: 'unreadable' }
    | {
          readonly status: 200;
          readonly text: string;
          /** The blob's sha: a write replacing this version names it. */
          readonly sha: string;
          readonly etag: string | null;
      };

/**
 * Reads `settings.json` of the user's settings repository (`GET /repos/{owner}/githq-settings/contents/settings.json`)
 * with `If-None-Match`. Throws `GitHubApiError` on any refusal but a 404.
 */
export async function readSettingsFile(
    rest: GitHubRestRequester,
    params: ReadSettingsFileParams,
): Promise<ReadSettingsFileResult> {
    let answer;
    try {
        answer = await rest({ url: getSettingsFileUrl(params.owner), etag: params.etag ?? undefined });
    } catch (error) {
        if (error instanceof GitHubApiError && error.status === 404) {
            return { status: 404 };
        }

        throw error;
    }

    if (answer.status === 304) {
        return { status: 304 };
    }

    const { payload } = answer;
    if (
        !isPlainObject(payload) ||
        payload.encoding !== 'base64' ||
        typeof payload.content !== 'string' ||
        typeof payload.sha !== 'string'
    ) {
        return { status: 'unreadable' };
    }

    return {
        status: 200,
        text: decodeBase64Text(payload.content),
        sha: payload.sha,
        etag: answer.headers.get('etag'),
    };
}

/**
 * The REST URL of the user's settings file.
 * @__NO_SIDE_EFFECTS__
 */
export function getSettingsFileUrl(owner: string) {
    return `/repos/${encodeURIComponent(owner)}/${SETTINGS_REPOSITORY_NAME}/contents/${SETTINGS_FILE_PATH}`;
}

/** UTF-8 text from base64 broken into lines, as GitHub sends a file's content. */
function decodeBase64Text(content: string) {
    const binary = atob(content.replaceAll(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, char => char.codePointAt(0) ?? 0));
}
