import { expect, test } from 'bun:test';

import type { ListGroup } from '@/lists/ListTypes.js';
import { SAMPLE_PROJECT, SAMPLE_PROJECT_ENTRIES, SAMPLE_TODAY } from '@/testing/sampleProject.js';

import type { ProjectListTexts } from './buildProjectList.js';
import { buildProjectList } from './buildProjectList.js';
import type { ProjectGrouping, ProjectSort } from './projectViewOptions.js';
import { MANUAL_SORT } from './projectViewOptions.js';
import type { ProjectEntry } from './ProjectTypes.js';

const TEXTS: ProjectListTexts = {
    all: 'All items',
    noValue: field => `No ${field}`,
    unassigned: 'Unassigned',
    noMilestone: 'No milestone',
    drafts: 'Drafts',
    iterationDetail: (iteration, current) => (current ? `${iteration.startDate} · current` : iteration.startDate),
};

const SHOWN = SAMPLE_PROJECT_ENTRIES.filter(entry => !entry.item.isArchived);

test('by a single select: every option in the project’s order, empty ones too, movable; no value last', () => {
    const groups = build('field:F_status', MANUAL_SORT);
    expect(summary(groups)).toEqual([
        ['Todo', ['I_91', 'I_455', 'I_1210']],
        ['In progress', ['I_1187', 'PR_1203', 'I_470', 'PVTI_draft_1']],
        ['In review', ['PR_477']],
        ['Done', ['I_1150']],
        ['No Status', ['I_1220']],
    ]);
    expect(groups.every(group => group.droppable)).toBe(true);
    expect(groups[0]?.marker).toEqual({ kind: 'color', color: '9198a1' });
});

test('sorted by the view’s order — options in their order, without a value last — ties in GitHub’s order', () => {
    expect(summary(build('none', 'field:F_priority:asc'))).toEqual([
        [
            'All items',
            ['I_470', 'I_91', 'I_1187', 'PR_477', 'PR_1203', 'I_455', 'I_1210', 'I_1150', 'I_1220', 'PVTI_draft_1'],
        ],
    ]);
    expect(summary(build('none', 'field:F_estimate:desc,title:asc'))[0]?.[1].slice(0, 4)).toEqual([
        'PR_1203',
        'I_1187',
        'I_470',
        'I_1210',
    ]);
});

test('by iteration: the current and coming ones first, in order; a completed one met after them', () => {
    const groups = build('field:F_iteration', MANUAL_SORT);
    expect(groups.map(group => [group.label, group.detail])).toEqual([
        ['Sprint 14', '2026-10-20 · current'],
        ['Sprint 15', '2026-11-03'],
        ['Sprint 13', '2026-10-06'],
        ['No Iteration', null],
    ]);
});

test('by repository, drafts apart; by assignee, an item under each of its people; neither movable', () => {
    const byRepository = build('repository', MANUAL_SORT);
    expect(byRepository.map(group => group.label)).toEqual([
        'skyline-labs/api',
        'skyline-labs/mobile',
        'skyline-labs/portal',
        'Drafts',
    ]);
    expect(byRepository.some(group => group.droppable)).toBe(false);
    expect(build('assignees', MANUAL_SORT).map(group => group.label)).toEqual([
        'kedrzu',
        'olam',
        'pnowak',
        'Unassigned',
    ]);
});

test('by a number field: its values in order', () => {
    expect(build('field:F_estimate', MANUAL_SORT).map(group => group.label)).toEqual([
        '1',
        '2',
        '3',
        '5',
        'No Story points',
    ]);
});

function build(grouping: ProjectGrouping, sort: ProjectSort) {
    return buildProjectList({
        project: SAMPLE_PROJECT,
        entries: SHOWN,
        grouping,
        sort,
        texts: TEXTS,
        today: SAMPLE_TODAY,
    });
}

function summary(groups: readonly ListGroup<ProjectEntry>[]) {
    return groups.map(group => [group.label, group.rows.map(row => row.id)] as const);
}
