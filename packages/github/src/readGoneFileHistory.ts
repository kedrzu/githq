import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { GitHubGraphQLCallOptions } from './createGitHubRequester.js';
import type { Requester } from './generated.gen.js';
import type { GitHubGraphQLErrorEntry } from './GitHubApiError.js';
import type { ReviewBlobRepository } from './readReviewBlobs.js';

/** How a file came and went: the commits, abbreviated. */
export interface GoneFileHistory {
    readonly added: string;
    readonly deleted: string;
}

export interface ReadGoneFileHistoryParams {
    readonly requester: Requester<GitHubGraphQLCallOptions>;
    readonly repository: ReviewBlobRepository;
    /** The commit the history is read from. */
    readonly head: string;
    readonly paths: readonly string[];
}

/** One file's history walks this far back, which reaches the pull request's own commits. */
const HISTORY_LENGTH = 20;

/**
 * How files that are in neither a pull request's base nor its head came and went, in one query
 * (`ReviewGoneFileHistory`): those added and then deleted again. A file its commits don't say that of, changed and put
 * back or force-pushed away, is left out, as is one GitHub failed to answer for. Rejects only when the query fails as a whole.
 */
export async function readGoneFileHistory({
    requester,
    repository,
    head,
    paths,
}: ReadGoneFileHistoryParams): Promise<Map<string, GoneFileHistory>> {
    const variables: Record<string, string> = { owner: repository.owner, name: repository.name, head };
    for (const [index, path] of paths.entries()) {
        variables[`p${index}`] = path;
    }

    const errors: GitHubGraphQLErrorEntry[] = [];
    const data = await requester<unknown, Record<string, string>>(buildQuery(paths), variables, {
        onPartialErrors: found => errors.push(...found),
    });

    const answered = isPlainObject(data) && isPlainObject(data.repository) ? data.repository.object : null;
    const histories = new Map<string, GoneFileHistory>();
    if (!isPlainObject(answered)) {
        return histories;
    }

    for (const [index, path] of paths.entries()) {
        const alias = `h${index}`;
        // A path missing from a commit answers `NOT_FOUND`, which is what's being asked. Anything else says nothing of it.
        const failed = errors.some(error => error.type !== 'NOT_FOUND' && error.path?.includes(alias));
        const history = failed ? null : readHistory(answered[alias]);
        if (history) {
            histories.set(path, history);
        }
    }

    return histories;
}

/** Newest first: the newest commit took the file out, and the nearest before it that brought it in added it. */
function readHistory(answer: unknown): GoneFileHistory | null {
    const nodes = isPlainObject(answer) && Array.isArray(answer.nodes) ? answer.nodes : [];
    const [newest, ...older] = nodes.map(readCommit);
    if (!newest || newest.has || !newest.parentHas) {
        return null;
    }

    const adding = older.find(commit => commit.has && !commit.parentHas);
    return adding ? { added: adding.oid, deleted: newest.oid } : null;
}

function readCommit(node: unknown) {
    if (!isPlainObject(node)) {
        return { oid: '', has: false, parentHas: false };
    }

    const parents = isPlainObject(node.parents) && Array.isArray(node.parents.nodes) ? node.parents.nodes : [];
    const parent: unknown = parents[0];
    return {
        oid: typeof node.abbreviatedOid === 'string' ? node.abbreviatedOid : '',
        has: isPlainObject(node.file),
        parentHas: isPlainObject(parent) && isPlainObject(parent.file),
    };
}

/** By hand: its aliases vary in number, which codegen's static documents can't express. */
function buildQuery(paths: readonly string[]) {
    const declarations = ['$owner: String!', '$name: String!', '$head: GitObjectID!'];
    const fields: string[] = [];
    for (const index of paths.keys()) {
        const path = `$p${index}`;
        declarations.push(`${path}: String!`);
        fields.push(
            `h${index}: history(first: ${HISTORY_LENGTH}, path: ${path}) { nodes { abbreviatedOid file(path: ${path}) { oid } parents(first: 1) { nodes { file(path: ${path}) { oid } } } } }`,
        );
    }

    return `query ReviewGoneFileHistory(${declarations.join(', ')}) { repository(owner: $owner, name: $name) { object(oid: $head) { ... on Commit { ${fields.join(' ')} } } } }`;
}
