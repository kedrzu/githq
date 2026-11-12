import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { GitHubApiError } from '../GitHubApiError.js';
import { getRepositoryRestPath } from '../utils/getRepositoryRestPath.js';
import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** How `head` stands to `base`. */
export type CommitComparisonStatus = 'ahead' | 'behind' | 'diverged' | 'identical';

/** A commit `head` has that `base` does not. */
export interface ComparedCommit {
    readonly oid: string;
    /** The first line of its message. */
    readonly subject: string;
    /** The author's login; their git name when GitHub ties the commit to no account; `null` when it has neither. */
    readonly author: string | null;
}

/** A file that differs between `base` and `head`. */
export interface ComparedFile {
    readonly path: string;
    /** Where a renamed or copied file came from. */
    readonly previousPath: string | null;
    /** `added`, `removed`, `modified`, `renamed`, `copied`, `changed`, `unchanged`. */
    readonly status: string;
    readonly additions: number;
    readonly deletions: number;
}

/** What lies between two commits. */
export interface CommitComparison {
    readonly status: CommitComparisonStatus;
    readonly aheadBy: number;
    readonly behindBy: number;
    /** Of all commits `head` has that `base` does not, which can be more than {@link commits} holds. */
    readonly totalCommits: number;
    /** Oldest first, at most 250. Empty when `head` is behind. */
    readonly commits: readonly ComparedCommit[];
    /** At most 300. */
    readonly files: readonly ComparedFile[];
}

/** Which two commits to compare. */
export interface CompareCommitsParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly base: string;
    readonly head: string;
}

/**
 * Compares two commits, `GET /repos/{o}/{r}/compare/{base}...{head}`: its first page only, which holds up to 250
 * commits and 300 files. The file patches it carries are dropped.
 *
 * Throws {@link GitHubApiError} when GitHub refuses or the answer is malformed.
 */
export async function compareCommits(
    rest: GitHubRestRequester,
    { nameWithOwner, base, head }: CompareCommitsParams,
): Promise<CommitComparison> {
    const { status, payload } = await rest({
        url: `${getRepositoryRestPath(nameWithOwner)}/compare/${base}...${head}`,
    });
    if (
        !isPlainObject(payload) ||
        !isComparisonStatus(payload.status) ||
        typeof payload.ahead_by !== 'number' ||
        typeof payload.behind_by !== 'number' ||
        typeof payload.total_commits !== 'number' ||
        !Array.isArray(payload.commits) ||
        !(payload.files === undefined || Array.isArray(payload.files))
    ) {
        throw malformed(status);
    }

    return {
        status: payload.status,
        aheadBy: payload.ahead_by,
        behindBy: payload.behind_by,
        totalCommits: payload.total_commits,
        commits: readCommits(status, payload.commits),
        files: readFiles(status, payload.files ?? []),
    };
}

function readCommits(status: number, entries: readonly unknown[]) {
    const commits: ComparedCommit[] = [];
    for (const entry of entries) {
        if (
            !isPlainObject(entry) ||
            typeof entry.sha !== 'string' ||
            !isPlainObject(entry.commit) ||
            typeof entry.commit.message !== 'string'
        ) {
            throw malformed(status);
        }

        const account = entry.author;
        const gitAuthor = entry.commit.author;
        const login = isPlainObject(account) && typeof account.login === 'string' ? account.login : null;
        const name = isPlainObject(gitAuthor) && typeof gitAuthor.name === 'string' ? gitAuthor.name : null;
        commits.push({ oid: entry.sha, subject: entry.commit.message.split('\n', 1).join(''), author: login ?? name });
    }

    return commits;
}

function readFiles(status: number, entries: readonly unknown[]) {
    const files: ComparedFile[] = [];
    for (const entry of entries) {
        if (
            !isPlainObject(entry) ||
            typeof entry.filename !== 'string' ||
            !(entry.previous_filename === undefined || typeof entry.previous_filename === 'string') ||
            typeof entry.status !== 'string' ||
            typeof entry.additions !== 'number' ||
            typeof entry.deletions !== 'number'
        ) {
            throw malformed(status);
        }

        files.push({
            path: entry.filename,
            previousPath: entry.previous_filename ?? null,
            status: entry.status,
            additions: entry.additions,
            deletions: entry.deletions,
        });
    }

    return files;
}

function isComparisonStatus(value: unknown): value is CommitComparisonStatus {
    return value === 'ahead' || value === 'behind' || value === 'diverged' || value === 'identical';
}

function malformed(status: number) {
    return new GitHubApiError({ status, message: 'GitHub compare answer is malformed' });
}
