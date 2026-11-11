/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { PullRequestMergeOptionsQuery } from '@githq/github/generated.gen.js';

import { toPullRequestStatus } from '@/store/toItem.js';
import { samplePullRequestNode } from '@/testing/sampleRowNodes.js';

import type { MergeOptions } from './MergeTypes.js';
import { toMergeOptions } from './toMergeOptions.js';

type MergeNode = Exclude<NonNullable<PullRequestMergeOptionsQuery['node']>, Record<PropertyKey, never>>;
type BaseRef = NonNullable<MergeNode['baseRef']>;
type Rule = NonNullable<NonNullable<NonNullable<BaseRef['rules']>['nodes']>[number]>;

test('reads the status, the proposed texts, what the viewer may do and the checks with which are required', () => {
    const node: MergeNode = {
        ...mergeNode(),
        statusCheckRollup: {
            state: 'PENDING',
            contexts: { checkRunCountsByState: [], statusContextCountsByState: [] },
            contextPage: {
                nodes: [
                    {
                        __typename: 'CheckRun',
                        id: 'CR_1',
                        name: 'test',
                        status: 'IN_PROGRESS',
                        conclusion: null,
                        detailsUrl: 'https://github.com/acme/web/actions/runs/77/job/1',
                        startedAt: '2026-11-02T10:00:00Z',
                        completedAt: null,
                        isRequired: true,
                        checkSuite: {
                            app: { slug: 'github-actions' },
                            workflowRun: { databaseId: 77, workflow: { name: 'CI' } },
                        },
                    },
                    null,
                    {
                        __typename: 'StatusContext',
                        id: 'SC_1',
                        context: 'deploy/preview',
                        state: 'SUCCESS',
                        targetUrl: null,
                        createdAt: '2026-11-02T09:00:00Z',
                        isRequired: false,
                    },
                ],
            },
        },
    };

    const expected: MergeOptions = {
        status: toPullRequestStatus(node),
        proposedTexts: {
            MERGE: { title: 'Merge pull request #5 from acme/feature', body: 'Fix the login loop' },
            SQUASH: { title: 'Fix the login loop (#5)', body: '* Fix it\n\n* Test it' },
        },
        allowedMergeMethods: null,
        requiresLinearHistory: false,
        viewerCanMergeAsAdmin: true,
        viewerCanEnableAutoMerge: false,
        autoMergeBody: null,
        mergeQueueMethod: null,
        checks: [
            {
                id: 'CR_1',
                kind: 'checkRun',
                name: 'test',
                workflow: 'CI',
                state: 'pending',
                cancelled: false,
                url: 'https://github.com/acme/web/actions/runs/77/job/1',
                startedAt: '2026-11-02T10:00:00Z',
                completedAt: null,
                isRequired: true,
                appSlug: 'github-actions',
                workflowRunId: 77,
            },
            {
                id: 'SC_1',
                kind: 'status',
                name: 'deploy/preview',
                workflow: null,
                state: 'passing',
                cancelled: false,
                url: null,
                startedAt: '2026-11-02T09:00:00Z',
                completedAt: null,
                isRequired: false,
                appSlug: null,
                workflowRunId: null,
            },
        ],
        headCommit: { oid: 'head-oid', headline: 'Handle an empty billing answer', author: 'dkim' },
    };
    expect(toMergeOptions(node)).toEqual(expected);
});

test('PM11: the message auto-merge was given is read with the options, none when it is off', () => {
    const node = mergeNode();
    expect(toMergeOptions({ ...node, autoMergeBody: { commitBody: 'The message.' } })?.autoMergeBody).toBe(
        'The message.',
    );
    expect(toMergeOptions({ ...node, autoMergeBody: null })?.autoMergeBody).toBeNull();
});

test('the head commit names its author by login, else by the name in the commit; none read, none named', () => {
    const commit = { oid: 'head-oid', messageHeadline: 'Handle an empty billing answer' };
    const byName: MergeNode = {
        ...mergeNode(),
        headCommit: { nodes: [{ commit: { ...commit, author: { name: 'Dana Kim', user: null } } }] },
    };
    expect(toMergeOptions(byName)?.headCommit).toEqual({
        oid: 'head-oid',
        headline: 'Handle an empty billing answer',
        author: 'Dana Kim',
    });
    expect(toMergeOptions({ ...mergeNode(), headCommit: { nodes: [] } })?.headCommit).toBeNull();
});

test.each<[string, (Rule | null)[] | null, MergeOptions['allowedMergeMethods']]>([
    ['no rules', null, null],
    ['only rules of other types', [{ type: 'DELETION', parameters: null }], null],
    ['a pull request rule naming no methods', [pullRequestRule(null)], null],
    ['one pull request rule', [pullRequestRule(['SQUASH', 'REBASE'])], ['SQUASH', 'REBASE']],
    [
        'several pull request rules: only the methods every one allows',
        [
            pullRequestRule(['MERGE', 'SQUASH']),
            null,
            { type: 'REQUIRED_SIGNATURES', parameters: {} },
            pullRequestRule(null),
            pullRequestRule(['SQUASH', 'REBASE']),
        ],
        ['SQUASH'],
    ],
    ['pull request rules allowing nothing in common', [pullRequestRule(['MERGE']), pullRequestRule(['REBASE'])], []],
])('with %s, the rulesets allow %j', (_, rules, allowed) => {
    const node: MergeNode = { ...mergeNode(), baseRef: baseRef({ rules }) };

    expect(toMergeOptions(node)?.allowedMergeMethods).toEqual(allowed);
});

test.each<[string, Partial<BaseRefParams>, boolean]>([
    ['a ruleset requiring linear history', { rules: [{ type: 'REQUIRED_LINEAR_HISTORY', parameters: null }] }, true],
    ['classic branch protection requiring it', { requiresLinearHistory: true }, true],
    ['classic branch protection not requiring it', { requiresLinearHistory: false }, false],
    // `branchProtectionRule` reads `null` for a viewer who may not read it.
    ['neither, or protection the viewer cannot read', {}, false],
])('linear history: %s → %p', (_, params, required) => {
    const node: MergeNode = { ...mergeNode(), baseRef: baseRef(params) };

    expect(toMergeOptions(node)?.requiresLinearHistory).toBe(required);
});

test.each<[string, (Rule | null)[] | null, MergeOptions['mergeQueueMethod']]>([
    [
        'a merge queue ruleset names the method',
        [{ type: 'MERGE_QUEUE', parameters: { mergeMethod: 'SQUASH' } }],
        'SQUASH',
    ],
    ['other rules name none', [pullRequestRule(['MERGE'])], null],
    ['no rules read', null, null],
])("the merge queue's method: %s", (_, rules, expected) => {
    expect(toMergeOptions({ ...mergeNode(), baseRef: baseRef({ rules }) })?.mergeQueueMethod).toBe(expected);
});

test('a node that is no pull request, or none, has no merge options', () => {
    expect(toMergeOptions({})).toBeNull();
    expect(toMergeOptions(null)).toBeNull();
});

function mergeNode(): MergeNode {
    return {
        ...samplePullRequestNode('PR_5', { repository: 'acme/web', number: 5, updatedAt: '2026-11-02T10:00:00Z' }),
        mergeHeadline: 'Merge pull request #5 from acme/feature',
        mergeBody: 'Fix the login loop',
        squashHeadline: 'Fix the login loop (#5)',
        squashBody: '* Fix it\n\n* Test it',
        viewerCanMergeAsAdmin: true,
        viewerCanEnableAutoMerge: false,
        autoMergeBody: null,
        headCommit: {
            nodes: [
                {
                    commit: {
                        oid: 'head-oid',
                        messageHeadline: 'Handle an empty billing answer',
                        author: { name: 'Dana Kim', user: { login: 'dkim' } },
                    },
                },
            ],
        },
        baseRef: baseRef({}),
        statusCheckRollup: null,
    };
}

interface BaseRefParams {
    readonly rules: (Rule | null)[] | null;
    /** `undefined` for no protection the viewer can read. */
    readonly requiresLinearHistory: boolean | undefined;
}

function baseRef(params: Partial<BaseRefParams>): BaseRef {
    const { rules = null, requiresLinearHistory } = params;
    return {
        target: { oid: 'base-oid' },
        rules: rules && { nodes: rules },
        branchProtectionRule: requiresLinearHistory === undefined ? null : { requiresLinearHistory },
    };
}

function pullRequestRule(allowedMergeMethods: ('MERGE' | 'SQUASH' | 'REBASE')[] | null): Rule {
    return { type: 'PULL_REQUEST', parameters: { allowedMergeMethods } };
}
