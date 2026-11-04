import type { GitHubGraphQLCallOptions } from './createGitHubRequester.js';
import type { Requester } from './generated.gen.js';

/** A file to mark viewed, or to unmark. */
export interface FileViewedMark {
    readonly path: string;
    readonly viewed: boolean;
}

export interface MarkFilesViewedParams {
    readonly requester: Requester<GitHubGraphQLCallOptions>;
    readonly pullRequestId: string;
    readonly marks: readonly FileViewedMark[];
}

/**
 * Sets GitHub's own viewed marks of many files in one request (`MarkFilesViewed`, code review's D10). Rejects when GitHub
 * reports any error, which says nothing of the other marks in the request: only reading the list again does.
 */
export async function markFilesViewed({ requester, pullRequestId, marks }: MarkFilesViewedParams): Promise<void> {
    const variables: Record<string, string> = { pullRequestId };
    for (const [index, { path }] of marks.entries()) {
        variables[`p${index}`] = path;
    }

    await requester<unknown, Record<string, string>>(buildMutation(marks), variables);
}

/** The mutation's text: its aliases vary in number, which codegen's static documents can't express. Paths travel only as variables. */
function buildMutation(marks: readonly FileViewedMark[]) {
    const declarations = ['$pullRequestId: ID!'];
    const fields: string[] = [];
    for (const [index, { viewed }] of marks.entries()) {
        const mutation = viewed ? 'markFileAsViewed' : 'unmarkFileAsViewed';
        declarations.push(`$p${index}: String!`);
        fields.push(
            `m${index}: ${mutation}(input: { pullRequestId: $pullRequestId, path: $p${index} }) { clientMutationId }`,
        );
    }

    return `mutation MarkFilesViewed(${declarations.join(', ')}) { ${fields.join(' ')} }`;
}
