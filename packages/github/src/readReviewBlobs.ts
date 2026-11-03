import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { GitHubGraphQLCallOptions } from './createGitHubRequester.js';
import type { Requester } from './generated.gen.js';
import { GitHubApiError } from './GitHubApiError.js';
import type { GitHubGraphQLErrorEntry } from './GitHubApiError.js';

/** The repository whose blobs are read. */
export interface ReviewBlobRepository {
    readonly owner: string;
    readonly name: string;
}

/** What an expression (`<commit oid>:<path>`) resolves to. */
export type ReviewBlobOidAnswer =
    | {
          readonly kind: 'blob';
          readonly oid: string;
          readonly byteSize: number;
          /** `true` only when GitHub is sure: `Blob.isBinary` is `null` when it can't tell. */
          readonly isBinary: boolean;
      }
    /** Nothing GitHub will name at that path: there is nothing there, or a submodule, which it answers the same for. */
    | { readonly kind: 'missing' }
    /** Something else at that path: a directory. */
    | { readonly kind: 'notBlob' }
    /** GitHub could not answer this one; the rest of the answer stands. */
    | { readonly kind: 'failed'; readonly error: GitHubApiError };

/** What a blob oid reads as. */
export type ReviewBlobTextAnswer =
    | { readonly kind: 'text'; readonly text: string }
    /** GitHub cut the text off, so it is not given: read it whole over REST. */
    | { readonly kind: 'truncated' }
    | { readonly kind: 'binary' }
    /** GitHub could not answer this one; the rest of the answer stands. */
    | { readonly kind: 'failed'; readonly error: GitHubApiError };

/** Where blobs are read from, with which requester. */
interface ReviewBlobSource {
    readonly requester: Requester<GitHubGraphQLCallOptions>;
    readonly repository: ReviewBlobRepository;
}

export interface ReadReviewBlobOidsParams extends ReviewBlobSource {
    readonly expressions: readonly string[];
}

export interface ReadReviewBlobTextsParams extends ReviewBlobSource {
    readonly oids: readonly string[];
}

/**
 * Resolves many `<commit oid>:<path>` expressions in one query (`ReviewBlobOids`), which costs one point. Answers by
 * expression. Rejects only when the query fails as a whole.
 */
export async function readReviewBlobOids({
    expressions,
    ...source
}: ReadReviewBlobOidsParams): Promise<Map<string, ReviewBlobOidAnswer>> {
    const objects = await readAliasedObjects(source, {
        operation: 'ReviewBlobOids',
        argument: 'expression',
        variablePrefix: 'e',
        variableType: 'String!',
        selection: 'oid byteSize isBinary',
        values: expressions,
    });

    const answers = new Map<string, ReviewBlobOidAnswer>();
    for (const [expression, object] of objects) {
        answers.set(expression, readOidAnswer(object));
    }

    return answers;
}

/** Reads many blobs by oid in one query (`ReviewBlobTexts`). Answers by oid. Rejects only when the query fails as a whole. */
export async function readReviewBlobTexts({
    oids,
    ...source
}: ReadReviewBlobTextsParams): Promise<Map<string, ReviewBlobTextAnswer>> {
    const objects = await readAliasedObjects(source, {
        operation: 'ReviewBlobTexts',
        argument: 'oid',
        variablePrefix: 'o',
        variableType: 'GitObjectID!',
        selection: 'oid text isTruncated isBinary byteSize',
        values: oids,
    });

    const answers = new Map<string, ReviewBlobTextAnswer>();
    for (const [oid, object] of objects) {
        answers.set(oid, readTextAnswer(object));
    }

    return answers;
}

function readOidAnswer({ node, error }: AliasedObject): ReviewBlobOidAnswer {
    if (error) {
        return { kind: 'failed', error };
    }

    if (node === null) {
        return { kind: 'missing' };
    }

    if (!isPlainObject(node)) {
        return { kind: 'failed', error: malformed() };
    }

    // Any other kind of object matches no fragment and answers `{}`.
    if (node.oid === undefined) {
        return { kind: 'notBlob' };
    }

    if (typeof node.oid !== 'string' || typeof node.byteSize !== 'number') {
        return { kind: 'failed', error: malformed() };
    }

    return { kind: 'blob', oid: node.oid, byteSize: node.byteSize, isBinary: node.isBinary === true };
}

function readTextAnswer({ node, error }: AliasedObject): ReviewBlobTextAnswer {
    if (error) {
        return { kind: 'failed', error };
    }

    if (!isPlainObject(node)) {
        return { kind: 'failed', error: malformed() };
    }

    if (node.isBinary === true) {
        return { kind: 'binary' };
    }

    if (node.isTruncated === true) {
        return { kind: 'truncated' };
    }

    // `text` is "null if the Blob is binary", also when `isBinary` couldn't tell.
    return typeof node.text === 'string' ? { kind: 'text', text: node.text } : { kind: 'binary' };
}

interface AliasedQuery {
    readonly operation: string;
    readonly argument: string;
    readonly variablePrefix: string;
    readonly variableType: string;
    readonly selection: string;
    readonly values: readonly string[];
}

interface AliasedObject {
    readonly node: unknown;
    readonly error: GitHubApiError | undefined;
}

async function readAliasedObjects(
    { requester, repository }: ReviewBlobSource,
    query: AliasedQuery,
): Promise<Map<string, AliasedObject>> {
    const variables: Record<string, string> = { owner: repository.owner, name: repository.name };
    for (const [index, value] of query.values.entries()) {
        variables[`${query.variablePrefix}${index}`] = value;
    }

    const errors: GitHubGraphQLErrorEntry[] = [];
    const data = await requester<unknown, Record<string, string>>(buildAliasedQuery(query), variables, {
        onPartialErrors: found => errors.push(...found),
    });

    const answered = isPlainObject(data) ? data.repository : null;
    if (!isPlainObject(answered)) {
        throw new GitHubApiError({ status: 200, message: 'GitHub blob answer has no repository', errors });
    }

    const objects = new Map<string, AliasedObject>();
    for (const [index, value] of query.values.entries()) {
        const alias = `b${index}`;
        const failure = errors.filter(error => error.path?.[1] === alias);
        objects.set(value, {
            node: answered[alias],
            error:
                failure.length > 0
                    ? new GitHubApiError({
                          status: 200,
                          message: `GitHub GraphQL error: ${failure.map(error => error.message).join('; ')}`,
                          errors: failure,
                      })
                    : undefined,
        });
    }

    return objects;
}

/**
 * The query text: its aliases vary in number, which codegen's static documents can't express. The values travel only
 * as variables, so a path can hold anything.
 */
function buildAliasedQuery({ operation, argument, variablePrefix, variableType, selection, values }: AliasedQuery) {
    const declarations = ['$owner: String!', '$name: String!'];
    const fields: string[] = [];
    for (const index of values.keys()) {
        declarations.push(`$${variablePrefix}${index}: ${variableType}`);
        fields.push(`b${index}: object(${argument}: $${variablePrefix}${index}) { ... on Blob { ${selection} } }`);
    }

    return `query ${operation}(${declarations.join(', ')}) { repository(owner: $owner, name: $name) { ${fields.join(' ')} } }`;
}

function malformed() {
    return new GitHubApiError({ status: 200, message: 'GitHub blob answer is malformed' });
}
