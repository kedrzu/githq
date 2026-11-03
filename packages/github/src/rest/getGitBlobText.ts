import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** Which blob to read. */
export interface GetGitBlobTextParams {
    /** `owner/name`. */
    nameWithOwner: string;
    oid: string;
}

/**
 * A blob's whole text, from `GET /repos/{o}/{r}/git/blobs/{oid}`: for what GraphQL's `Blob.text` cuts off, near
 * 512 KB. Read in the JSON form, base64, as the requester gives only parsed JSON.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or the answer holds no base64 content.
 */
export async function getGitBlobText(rest: GitHubRestRequester, params: GetGitBlobTextParams): Promise<string> {
    const { status, payload } = await rest({
        url: `${getRepositoryRestPath(params.nameWithOwner)}/git/blobs/${params.oid}`,
    });

    if (!isPlainObject(payload) || typeof payload.content !== 'string' || payload.encoding !== 'base64') {
        throw new GitHubApiError({ status, message: 'GitHub blob answer is malformed' });
    }

    // GitHub wraps the base64 in lines. `atob` gives one character per byte, which must then be read as UTF-8.
    const binary = atob(payload.content.replaceAll('\n', ''));
    const bytes = Uint8Array.from(binary, character => character.codePointAt(0) ?? 0);
    // A BOM stays, as in GraphQL's `Blob.text`: the other side of a diff may come from there.
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}
