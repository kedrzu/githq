import { computeFileDiff } from '@githq/app/review/diff/computeFileDiff.js';
import type { FileViewedState, PatchStatus } from '@githq/github/generated.gen.js';
import { assert } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { GitHubMock } from '../github/GitHubMock.js';

/** A file of a pull request as {@link answerReview} answers it. */
export interface SampleReviewFile {
    readonly path: string;
    /** `null` where the file does not exist. */
    readonly before: string | null;
    readonly after: string | null;
    readonly changeType?: PatchStatus;
    readonly previousPath?: string;
    readonly viewed?: FileViewedState;
    /** How many lines it adds, when it is to look larger than it is. */
    readonly additions?: number;
    readonly binary?: boolean;
    /** Its size in bytes, when it is to look larger than it is. */
    readonly byteSize?: number;
}

/** A review thread as {@link answerReview} answers it; left out, what most threads are. */
export interface SampleReviewThread {
    readonly id: string;
    readonly path: string;
    readonly line?: number | null;
    readonly diffSide?: 'LEFT' | 'RIGHT';
    readonly isOutdated?: boolean;
    readonly isResolved?: boolean;
    /** Who resolved it, when resolved: `mlaine` when not given. */
    readonly resolvedBy?: string;
    readonly subjectType?: 'LINE' | 'FILE';
    /** Empty on a `FILE` thread. */
    readonly diffHunk?: string;
    /** `bodyHTML` of each comment. */
    readonly comments: readonly string[];
    /** The review its first comment came in; none by default. */
    readonly reviewId?: string;
    /** Its comments are in a draft review: the viewer's when {@link author} is the viewer. */
    readonly pending?: boolean;
    /** Who wrote its comments; sofiab by default. */
    readonly author?: string;
}

export interface AnswerReviewParams {
    /** `owner/name`. */
    readonly repository: string;
    readonly number: number;
    /** Its node id, when the test's world holds it; made of its number if not. */
    readonly id?: string;
    readonly files: readonly SampleReviewFile[];
    /** Read anew at each read, so a test can add to them. */
    readonly threads?: readonly SampleReviewThread[];
}

/** What a test can do to the review answered. */
export interface AnsweredReview {
    /** GitHub fails this file's content until {@link heal}. */
    fail(path: string, message: string): void;
    heal(path: string): void;
    /** This file's content waits until the returned function is called. */
    hold(path: string): () => void;
    /**
     * What these files' blobs are waits until the returned function is called, with every other file asked in the same
     * request: of them, nothing but the list and the patches is known until then.
     */
    holdBlobs(paths: readonly string[]): () => void;
    /** The review threads' read waits until the returned function is called. */
    holdThreads(): () => void;
    /** GitHub refuses marks until {@link allowMarks}. */
    refuseMarks(message: string): void;
    allowMarks(): void;
    /** The expressions (`<commit>:<path>`) asked of GitHub: what collapsing keeps from being fetched isn't among them. */
    readonly asked: readonly string[];
    /** The paths whose viewed mark changed, in the order they did. */
    readonly marked: readonly string[];
    /** How many requests set marks. */
    readonly markRequests: () => number;
    /** Runs `act` once, the next time the list is read, before its answer goes out. */
    beforeNextList(act: () => void): void;
    /** The head moves on to `oid`, the files' contents the same: the list says so the next time it is read. */
    push(oid: string): void;
}

/** Unchanged lines a patch shows around a change, as git does by default. */
const PATCH_CONTEXT = 3;
const HEAD_OID = 'head0000';
const BASE_OID = 'base0000';
const MERGE_BASE_OID = 'fork0000';

/**
 * Answers what a review reads, as GitHub does: the list (`PullRequestReviewFiles`), its review threads, the merge base (the compare request),
 * where renamed files came from, and the blobs (`ReviewBlobOids`, `ReviewBlobTexts`), an oid being made of its commit and
 * path. A file's failure is on its text alone, the query's other objects answered.
 */
export function answerReview(github: GitHubMock, params: AnswerReviewParams): AnsweredReview {
    const failures = new Map<string, string>();
    const held = new Map<string, Promise<void>>();
    let threadsHeld: Promise<void> | null = null;
    let blobsHeld: { paths: readonly string[]; until: Promise<void> } | null = null;
    const marked: string[] = [];
    let markRequests = 0;
    const asked: string[] = [];
    let marksRefused: string | null = null;
    let beforeNextList: (() => void) | null = null;
    let headOid = HEAD_OID;
    const repositoryPath = `/repos/${params.repository}`;
    const blobs = new Map<string, { file: SampleReviewFile; text: string }>();
    for (const file of params.files) {
        if (file.before !== null) {
            blobs.set(oidOf(MERGE_BASE_OID, file.previousPath ?? file.path), { file, text: file.before });
        }

        if (file.after !== null) {
            blobs.set(oidOf(HEAD_OID, file.path), { file, text: file.after });
        }
    }

    github.graphql('PullRequestReviewFiles', () => {
        const act = beforeNextList;
        beforeNextList = null;
        act?.();
        return {
            repository: {
                pullRequest: {
                    id: params.id ?? `PR_${params.number}`,
                    headRefOid: headOid,
                    baseRefOid: BASE_OID,
                    changedFiles: params.files.length,
                    files: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: params.files.map(file => ({
                            path: file.path,
                            changeType: file.changeType ?? 'MODIFIED',
                            additions: file.additions ?? countLines(file.after),
                            deletions: countLines(file.before),
                            viewerViewedState: file.viewed ?? 'UNVIEWED',
                        })),
                    },
                },
            },
        };
    });
    github.graphql('PullRequestReviewThreads', async () => {
        await threadsHeld;
        return {
            repository: {
                pullRequest: {
                    reviewThreads: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: (params.threads ?? []).map(toThreadNode),
                    },
                },
            },
        };
    });
    answerCompare(HEAD_OID);
    // Of any pull request of the repository, as the list is.
    const filesPath = new RegExp(`^${repositoryPath.replaceAll('.', '\\.')}/pulls/\\d+/files$`, 'u');
    github.restMatching('GET', filesPath, () => ({
        status: 200,
        json: params.files.map(file => ({
            filename: file.path,
            previous_filename: file.previousPath,
            status: toRestStatus(file.changeType ?? 'MODIFIED'),
            ...(file.binary ? { additions: 0, deletions: 0 } : toPatch(file.before, file.after)),
        })),
    }));
    github.graphqlDocument('ReviewBlobOids', async ({ variables }) => {
        const holding = blobsHeld;
        const asksHeld = Object.values(variables).some(
            expression =>
                typeof expression === 'string' && holding?.paths.some(path => expression.endsWith(`:${path}`)) === true,
        );
        if (holding && asksHeld) {
            await holding.until;
        }

        const repository: Record<string, unknown> = {};
        for (const [name, expression] of Object.entries(variables)) {
            if (/^e\d+$/u.test(name) && typeof expression === 'string') {
                asked.push(expression);
                const separator = expression.indexOf(':');
                const oid = oidOf(expression.slice(0, separator), expression.slice(separator + 1));
                const blob = blobs.get(oid);
                repository[`b${name.slice(1)}`] = blob
                    ? {
                          oid,
                          byteSize: blob.file.byteSize ?? blob.text.length,
                          isBinary: blob.file.binary === true,
                      }
                    : null;
            }
        }

        return { data: { repository } };
    });
    github.graphqlDocument('ReviewBlobTexts', async ({ variables }) => {
        const repository: Record<string, unknown> = {};
        const errors: { message: string; path: string[] }[] = [];
        const wanted = Object.entries(variables).filter(([name]) => /^o\d+$/u.test(name));
        for (const [name, oid] of wanted) {
            const blob = typeof oid === 'string' ? blobs.get(oid) : undefined;
            await held.get(blob?.file.path ?? '');
            const failure = failures.get(blob?.file.path ?? '');
            const alias = `b${name.slice(1)}`;
            if (failure !== undefined) {
                repository[alias] = null;
                errors.push({ message: failure, path: ['repository', alias] });
            } else {
                repository[alias] = blob && {
                    oid,
                    text: blob.text,
                    isTruncated: false,
                    isBinary: blob.file.binary === true,
                    byteSize: blob.text.length,
                };
            }
        }

        return errors.length > 0 ? { data: { repository }, errors } : { data: { repository } };
    });

    github.graphqlDocument('MarkFilesViewed', ({ variables }) => {
        markRequests++;
        if (marksRefused !== null) {
            return { data: null, errors: [{ message: marksRefused }] };
        }

        for (const [name, path] of Object.entries(variables)) {
            if (/^p\d+$/u.test(name) && typeof path === 'string') {
                marked.push(path);
            }
        }

        return { data: {} };
    });

    return {
        asked,
        marked,
        markRequests: () => markRequests,
        beforeNextList: act => {
            beforeNextList = act;
        },
        push: oid => {
            headOid = oid;
            answerCompare(oid);
            for (const file of params.files) {
                if (file.after !== null) {
                    blobs.set(oidOf(oid, file.path), { file, text: file.after });
                }
            }
        },
        refuseMarks: message => {
            marksRefused = message;
        },
        allowMarks: () => {
            marksRefused = null;
        },
        fail: (path, message) => failures.set(path, message),
        heal: path => failures.delete(path),
        holdBlobs(paths) {
            const { promise, resolve } = Promise.withResolvers<void>();
            blobsHeld = { paths, until: promise };
            return () => {
                blobsHeld = null;
                resolve();
            };
        },
        holdThreads() {
            const { promise, resolve } = Promise.withResolvers<void>();
            threadsHeld = promise;
            return () => {
                threadsHeld = null;
                resolve();
            };
        },
        hold(path) {
            let release = () => {};
            held.set(
                path,
                new Promise<void>(resolve => {
                    release = resolve;
                }),
            );
            return () => {
                held.delete(path);
                release();
            };
        },
    };

    function answerCompare(oid: string) {
        github.rest('GET', `${repositoryPath}/compare/${BASE_OID}...${oid}`, () => ({
            status: 200,
            json: { merge_base_commit: { sha: MERGE_BASE_OID } },
        }));
    }
}

function toThreadNode(thread: SampleReviewThread) {
    const line = thread.line ?? null;
    return {
        id: thread.id,
        path: thread.path,
        line,
        startLine: null,
        originalLine: line,
        originalStartLine: null,
        diffSide: thread.diffSide ?? 'RIGHT',
        startDiffSide: null,
        isOutdated: thread.isOutdated ?? false,
        isResolved: thread.isResolved ?? false,
        subjectType: thread.subjectType ?? 'LINE',
        viewerCanReply: true,
        viewerCanResolve: true,
        viewerCanUnresolve: true,
        resolvedBy: thread.isResolved ? { login: thread.resolvedBy ?? 'mlaine' } : null,
        comments: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: thread.comments.map((bodyHTML, index) => ({
                id: `${thread.id}_${index}`,
                author: { login: thread.author ?? 'sofiab', avatarUrl: '' },
                bodyHTML,
                createdAt: '2026-01-01T00:00:00Z',
                url: `https://github.com/acme/web/pull/15#discussion_${thread.id}_${index}`,
                diffHunk: thread.diffHunk ?? '',
                outdated: thread.isOutdated ?? false,
                state: thread.pending ? ('PENDING' as const) : ('SUBMITTED' as const),
                originalCommit: { oid: 'a91d03b00000', abbreviatedOid: 'a91d03b' },
                pullRequestReview: index === 0 && thread.reviewId !== undefined ? { id: thread.reviewId } : null,
            })),
        },
    };
}

/** How `…/pulls/{n}/files` names a change type. */
function toRestStatus(changeType: PatchStatus) {
    switch (changeType) {
        case 'ADDED':
            return 'added';
        case 'DELETED':
            return 'removed';
        case 'MODIFIED':
            return 'modified';
        case 'RENAMED':
            return 'renamed';
        case 'COPIED':
            return 'copied';
        case 'CHANGED':
            return 'changed';
        default:
            return assertNever(changeType);
    }
}

/**
 * A file's patch as GitHub gives it, a unified diff with its changes' context, and its line counts; no patch where
 * nothing changed, as for a pure rename.
 */
function toPatch(before: string | null, after: string | null) {
    const diff = computeFileDiff({ before, after, ignoreWhitespace: false });
    const hunks: string[] = [];
    let additions = 0;
    let deletions = 0;
    let index = 0;
    while (index < diff.blocks.length) {
        // Blocks closer than twice the context share a hunk.
        let last = index;
        while (
            last + 1 < diff.blocks.length &&
            (diff.blocks[last + 1]?.beforeStart ?? 0) - (diff.blocks[last]?.beforeEnd ?? 0) <= 2 * PATCH_CONTEXT
        ) {
            last++;
        }

        const first = diff.blocks[index];
        const end = diff.blocks[last];
        assert(first && end);
        const beforeStart = Math.max(0, first.beforeStart - PATCH_CONTEXT);
        const afterStart = Math.max(0, first.afterStart - PATCH_CONTEXT);
        const beforeEnd = Math.min(diff.before.length, end.beforeEnd + PATCH_CONTEXT);
        const afterEnd = Math.min(diff.after.length, end.afterEnd + PATCH_CONTEXT);
        const lines: string[] = [];
        let beforeLine = beforeStart;
        let afterLine = afterStart;
        for (const block of diff.blocks.slice(index, last + 1)) {
            for (; beforeLine < block.beforeStart; beforeLine++, afterLine++) {
                lines.push(` ${diff.before[beforeLine]}`);
            }

            for (; beforeLine < block.beforeEnd; beforeLine++) {
                lines.push(`-${diff.before[beforeLine]}`);
                deletions++;
            }

            for (; afterLine < block.afterEnd; afterLine++) {
                lines.push(`+${diff.after[afterLine]}`);
                additions++;
            }
        }

        for (; beforeLine < beforeEnd && afterLine < afterEnd; beforeLine++, afterLine++) {
            lines.push(` ${diff.before[beforeLine]}`);
        }

        const beforeCount = beforeEnd - beforeStart;
        const afterCount = afterEnd - afterStart;
        // An empty side starts at the line before it, 0 at the top.
        const header = `@@ -${beforeCount === 0 ? beforeStart : beforeStart + 1},${beforeCount} +${afterCount === 0 ? afterStart : afterStart + 1},${afterCount} @@`;
        hunks.push([header, ...lines].join('\n'));
        index = last + 1;
    }

    return hunks.length === 0 ? { additions, deletions } : { additions, deletions, patch: hunks.join('\n') };
}

function oidOf(commit: string, path: string) {
    return `${commit}${encodeURIComponent(path)}`;
}

function countLines(text: string | null) {
    return text === null ? 0 : text.split('\n').length - 1;
}
