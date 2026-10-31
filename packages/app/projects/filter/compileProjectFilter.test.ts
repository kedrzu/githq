import { describe, expect, test } from 'bun:test';

import { SAMPLE_PROJECT, SAMPLE_PROJECT_ENTRIES, SAMPLE_TODAY } from '@/testing/sampleProject.js';

import type { ProjectEntry } from '../ProjectTypes.js';
import { compileProjectFilter } from './compileProjectFilter.js';

// The sample project's items (`testing/sampleProject.ts`), by their content's id; today is 2026-10-30, Sprint 14.
const LISTED = SAMPLE_PROJECT_ENTRIES.filter(entry => !entry.item.isArchived);
const WITHOUT_DRAFTS = LISTED.filter(entry => entry.content !== null);
const ALL_IDS = WITHOUT_DRAFTS.map(getId);

describe('evaluated locally, as GitHub does', () => {
    test.each<[string, readonly string[]]>([
        ['', ALL_IDS],
        ['   ', ALL_IDS],
        // A single select by option name, case-insensitive; a comma ORs, terms AND.
        ['status:Todo', ['I_91', 'I_455', 'I_1210']],
        ['STATUS:TODO', ['I_91', 'I_455', 'I_1210']],
        ['status:todo,done', ['I_91', 'I_455', 'I_1210', 'I_1150']],
        ['status:"In progress"', ['I_1187', 'PR_1203', 'I_470']],
        ["status:'in progress'", ['I_1187', 'PR_1203', 'I_470']],
        ['-status:Todo', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_1150', 'I_1220']],
        ['priority:Urgent,High', ['I_1187', 'I_470', 'PR_477', 'I_91']],
        ['-priority:urgent,high', ['PR_1203', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        ['status:Todo label:bug', ['I_91']],
        ['status:Nothing', []],
        // no: / has: / -no:
        ['no:status', ['I_1220']],
        ['has:status', ALL_IDS.filter(id => id !== 'I_1220')],
        ['-no:status', ALL_IDS.filter(id => id !== 'I_1220')],
        ['no:assignee', ['I_91', 'I_455', 'I_1210', 'I_1220']],
        ['has:assignee', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_1150']],
        ['no:label', ['PR_1203', 'I_470', 'PR_477', 'I_1150']],
        ['has:label', ['I_1187', 'I_91', 'I_455', 'I_1210', 'I_1220']],
        ['no:milestone', ALL_IDS],
        ['no:type', ['PR_1203', 'I_470', 'PR_477', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        ['no:iteration', ['I_1220']],
        ['no:story-points', ['I_1220']],
        // is:
        ['is:open', ALL_IDS.filter(id => id !== 'I_1150')],
        ['is:closed', ['I_1150']],
        ['-is:closed', ALL_IDS.filter(id => id !== 'I_1150')],
        ['is:pr', ['PR_1203', 'PR_477']],
        ['is:issue', ['I_1187', 'I_470', 'I_91', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        ['is:issue is:open', ['I_1187', 'I_470', 'I_91', 'I_455', 'I_1210', 'I_1220']],
        ['is:issue,pr', ALL_IDS],
        ['is:merged', []],
        ['is:draft', []],
        // People, labels, milestones, repositories, types, titles.
        ['assignee:@me', ['I_1187', 'PR_1203', 'PR_477']],
        ['assignee:olam,pnowak', ['I_470', 'I_1150']],
        ['assignee:KEDRZU', ['I_1187', 'PR_1203', 'PR_477']],
        ['assignee:kedrzu assignee:olam', []],
        ['-assignee:@me', ['I_470', 'I_91', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        ['label:bug', ['I_1187', 'I_91']],
        ['label:bug,docs', ['I_1187', 'I_91', 'I_455']],
        ['label:*oc*', ['I_455', 'I_1220']],
        ['label:*ed', ['I_1220']],
        ['-label:bug', ['PR_1203', 'I_470', 'PR_477', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        ['milestone:"v4.2"', []],
        ['repo:sigma-clinic/api', ['I_470', 'PR_477', 'I_455']],
        ['repo:SIGMA-CLINIC/API,sigma-clinic/mobile', ['I_470', 'PR_477', 'I_91', 'I_455']],
        ['type:bug', ['I_1187', 'I_91']],
        ['type:"Bug"', ['I_1187', 'I_91']],
        ['title:"Document webhook retry policy"', ['I_455']],
        ['title:"document webhook"', []],
        ['title:Document*', ['I_455']],
        ['title:*timezone*', ['I_1187']],
        // Iterations: by title, keywords, order.
        ['iteration:@current', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_91']],
        ['iteration:@next', ['I_455', 'I_1210']],
        ['iteration:@previous', ['I_1150']],
        ['iteration:@current+1', ['I_455', 'I_1210']],
        ['iteration:@current-1', ['I_1150']],
        ['iteration:"Sprint 15"', ['I_455', 'I_1210']],
        ['iteration:"sprint 13",@next', ['I_455', 'I_1210', 'I_1150']],
        ['iteration:<@current', ['I_1150']],
        ['iteration:>=@current', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_91', 'I_455', 'I_1210']],
        ['iteration:@current..@current+1', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_91', 'I_455', 'I_1210']],
        ['iteration:"Sprint 13..Sprint 14"', ['I_1187', 'PR_1203', 'I_470', 'PR_477', 'I_91', 'I_1150']],
        ['-iteration:@current', ['I_455', 'I_1210', 'I_1150', 'I_1220']],
        // Numbers: a field named with a space, written with `-`.
        ['story-points:<=2', ['PR_477', 'I_91', 'I_455', 'I_1210', 'I_1150']],
        ['story-points:3', ['I_1187', 'I_470']],
        ['story-points:>2', ['I_1187', 'PR_1203', 'I_470']],
        ['Story-Points:>=5', ['PR_1203']],
        ['story-points:2..3', ['I_1187', 'I_470', 'PR_477', 'I_91', 'I_1210']],
        ['story-points:*..1', ['I_455', 'I_1150']],
        ['story-points:4..*', ['PR_1203']],
        ['story-points:1,5', ['PR_1203', 'I_455', 'I_1150']],
        // Dates: ISO days and @today with an offset.
        ['due:@today', ['I_91']],
        ['due:2026-11-02', ['I_1187']],
        ['due:>@today', ['I_1187']],
        ['due:>=@today-1d', ['I_1187', 'I_91']],
        ['due:<@today+1w', ['I_1187', 'I_91']],
        ['due:<@today+2', ['I_91']],
        ['due:2026-10-01..2026-10-31', ['I_91']],
        ['due:@today..@today+7d', ['I_1187', 'I_91']],
        ['no:due', ['PR_1203', 'I_470', 'PR_477', 'I_455', 'I_1210', 'I_1150', 'I_1220']],
        // Text fields: exactly, case-insensitive, or with wildcards.
        ['note:"needs API review"', ['I_470']],
        ['note:"needs api"', []],
        ['note:needs*', ['I_470']],
    ])('%p', (filter, expected) => {
        expect(evaluate(filter, WITHOUT_DRAFTS)).toEqual(expected.toSorted());
    });
});

describe('with draft issues in the project', () => {
    test.each<[string, readonly string[]]>([
        ['is:pr', ['PR_1203', 'PR_477']],
        ['is:draft', ['PVTI_draft_1']],
        ['-is:draft', ALL_IDS],
        ['status:"In progress"', ['I_1187', 'PR_1203', 'I_470', 'PVTI_draft_1']],
        ['title:"decide on retention policy for audit logs"', ['PVTI_draft_1']],
        ['label:bug', ['I_1187', 'I_91']],
        ['no:label', ['PR_1203', 'I_470', 'PR_477', 'I_1150', 'PVTI_draft_1']],
        ['-repo:sigma-clinic/api', ['I_1187', 'PR_1203', 'I_91', 'I_1210', 'I_1150', 'I_1220', 'PVTI_draft_1']],
        ['no:assignee', ['I_91', 'I_455', 'I_1210', 'I_1220', 'PVTI_draft_1']],
    ])('%p', (filter, expected) => {
        expect(evaluate(filter, LISTED, true)).toEqual(expected.toSorted());
    });

    // Whether a draft issue counts as open, closed or an issue is not documented: GitHub answers these.
    test.each(['is:open', 'is:closed', 'is:issue', '-is:open', 'is:pr,issue'])('%p is left to GitHub', filter => {
        expect(compile(filter, true)).toEqual({ kind: 'github', term: filter });
    });
});

describe('left to GitHub, never guessed', () => {
    test.each<[string, string]>([
        ['reviewers:octocat', 'reviewers:octocat'],
        ['status:Todo reviewers:@me', 'reviewers:@me'],
        ['updated:>@today-7d', 'updated:>@today-7d'],
        ['last-updated:5days', 'last-updated:5days'],
        ['no:linked-pull-requests', 'no:linked-pull-requests'],
        ['no:reviewers', 'no:reviewers'],
        ['no:repo', 'no:repo'],
        ['no:label,assignee', 'no:label,assignee'],
        ['parent-issue:acme/web#4', 'parent-issue:acme/web#4'],
        ['reason:completed', 'reason:completed'],
        ['api', 'api'],
        ['webhook is:pr', 'webhook'],
        ['"story points":<=2', '"story points":<=2'],
        ['is:archived', 'is:archived'],
        ['is:blocked', 'is:blocked'],
        ['-api', '-api'],
        ['"two words"', '"two words"'],
        ['full-text', 'full-text'],
        ['api*', 'api*'],
        ['status:>Todo', 'status:>Todo'],
        ['status:Todo..Done', 'status:Todo..Done'],
        ['status:*do', 'status:*do'],
        ['assignee:*ked*', 'assignee:*ked*'],
        ['assignee:@team', 'assignee:@team'],
        ['label:>bug', 'label:>bug'],
        ['milestone:v4*', 'milestone:v4*'],
        ['iteration:"Sprint 99"', 'iteration:"Sprint 99"'],
        ['iteration:@later', 'iteration:@later'],
        ['story-points:abc', 'story-points:abc'],
        ['story-points:>@today', 'story-points:>@today'],
        ['due:@yesterday', 'due:@yesterday'],
        ['due:@today-1m', 'due:@today-1m'],
        ['due:31.10.2026', 'due:31.10.2026'],
        ['unknown:x', 'unknown:x'],
        ['status:', 'status:'],
        ['story-points:1..', 'story-points:1..'],
        ['status:"Todo', 'status:"Todo'],
    ])('%p', (filter, term) => {
        expect(compile(filter)).toEqual({ kind: 'github', term });
    });

    test('an iteration keyword when no iteration runs today', () => {
        expect(compile('iteration:@current', false, '2027-06-01')).toEqual({
            kind: 'github',
            term: 'iteration:@current',
        });
    });

    test('is:draft in a project holding draft pull requests', () => {
        expect(compile('is:draft', false, SAMPLE_TODAY, true)).toEqual({ kind: 'github', term: 'is:draft' });
    });

    test('a qualifier that is also the name of a project field', () => {
        const fields = [...SAMPLE_PROJECT.fields, { kind: 'text', id: 'F_type', name: 'Type' } as const];
        const compiled = compileProjectFilter({
            filter: 'type:Bug',
            fields,
            viewerLogin: 'kedrzu',
            today: SAMPLE_TODAY,
            hasDrafts: false,
            hasDraftPullRequests: false,
        });
        expect(compiled).toEqual({ kind: 'github', term: 'type:Bug' });
    });

    // GitHub reads these as its own qualifiers, whatever the project's fields are called.
    test.each<[string, string]>([
        ['reason:done', 'Reason'],
        ['reviewers:kedrzu', 'Reviewers'],
        ['updated:2026-10-30', 'Updated'],
        ['last-updated:2026-10-30', 'Last updated'],
        ['parent-issue:x', 'Parent issue'],
        ['linked-pull-requests:x', 'Linked pull requests'],
        ['has:reviewers', 'Reviewers'],
        ['no:reason', 'Reason'],
    ])('%p with a project field named %p', (filter, name) => {
        const fields = [...SAMPLE_PROJECT.fields, { kind: 'text', id: 'F_reserved', name } as const];
        const compiled = compileProjectFilter({
            filter,
            fields,
            viewerLogin: 'kedrzu',
            today: SAMPLE_TODAY,
            hasDrafts: false,
            hasDraftPullRequests: false,
        });
        expect(compiled).toEqual({ kind: 'github', term: filter });
    });

    test('a field name two fields answer to', () => {
        const fields = [...SAMPLE_PROJECT.fields, { kind: 'text', id: 'F_status_text', name: 'status' } as const];
        const compiled = compileProjectFilter({
            filter: 'status:Todo',
            fields,
            viewerLogin: 'kedrzu',
            today: SAMPLE_TODAY,
            hasDrafts: false,
            hasDraftPullRequests: false,
        });
        expect(compiled).toEqual({ kind: 'github', term: 'status:Todo' });
    });
});

function evaluate(filter: string, entries: readonly ProjectEntry[], hasDrafts = false) {
    const compiled = compile(filter, hasDrafts);
    if (compiled.kind !== 'local') {
        throw new Error(`"${filter}" was left to GitHub: ${compiled.term}`);
    }

    return entries
        .filter(entry => compiled.matches(entry))
        .map(getId)
        .toSorted();
}

function compile(filter: string, hasDrafts = false, today = SAMPLE_TODAY, hasDraftPullRequests = false) {
    return compileProjectFilter({
        filter,
        fields: SAMPLE_PROJECT.fields,
        viewerLogin: 'kedrzu',
        today,
        hasDrafts,
        hasDraftPullRequests,
    });
}

function getId(entry: ProjectEntry) {
    return entry.content?.id ?? entry.item.itemId;
}
