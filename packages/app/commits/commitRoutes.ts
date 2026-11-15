import { defineOpenedItemKind } from '@/item/defineOpenedItemKind.js';
import type { RepositoryName } from '@/utils/parseRepositoryName.js';

/** A commit as an address names it: its repository and its sha, full or short, as the address wrote it. */
export interface CommitReference extends RepositoryName {
    readonly oid: string;
}

/**
 * The route path of a commit on a page of its own, at GitHub's address of it (`/owner/name/commit/<sha>`): a sha of 7
 * to 40 hex digits, short as GitHub takes one too. In any repository the user can see, tracked or not (git-client D11).
 */
export const COMMIT_PAGE_PATH = '/:owner/:name/commit/:oid([0-9a-fA-F]{7,40})';

/** What separates the owner, the name and the sha in the pane's `commit` parameter. */
const COMMIT_SEPARATOR = '|';

/** A sha as an address may carry it. */
const SHA_PATTERN = /^[0-9a-f]{7,40}$/iu;

/**
 * A commit opened as an item: on its page (`/owner/name/commit/<sha>`), or in the panel beside the repository's Commits
 * section (`?pane=commit&commit=owner|name|<sha>`), as GitHub's project pane writes an issue.
 */
export const CommitRoutes = defineOpenedItemKind<CommitReference>({
    kind: 'commit',
    formatPaneValue(reference) {
        return [reference.owner, reference.name, reference.oid].join(COMMIT_SEPARATOR);
    },
    parsePaneValue(value) {
        const [owner, name, oid, ...rest] = value.split(COMMIT_SEPARATOR);
        return rest.length === 0 ? toReference(owner, name, oid) : null;
    },
    parsePageParams(params) {
        return toReference(params.owner, params.name, params.oid);
    },
    getPagePath(reference) {
        return `/${reference.owner}/${reference.name}/commit/${reference.oid}`;
    },
    formatKey(reference) {
        return `${reference.owner}/${reference.name}/${reference.oid}`;
    },
});

/**
 * The commit a key names, as `CommitRoutes.formatKey` writes it (`owner/name/<sha>`) — what a list of commits steps
 * through (`ItemNavigation.list`); `null` when it names none.
 * @__NO_SIDE_EFFECTS__
 */
export function parseCommitKey(key: string): CommitReference | null {
    const [owner, name, oid, ...rest] = key.split('/');
    return rest.length === 0 ? toReference(owner, name, oid) : null;
}

function toReference(owner: unknown, name: unknown, oid: unknown): CommitReference | null {
    return typeof owner === 'string' &&
        typeof name === 'string' &&
        typeof oid === 'string' &&
        owner !== '' &&
        name !== '' &&
        SHA_PATTERN.test(oid)
        ? { owner, name, oid }
        : null;
}
