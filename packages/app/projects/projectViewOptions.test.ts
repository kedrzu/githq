import { describe, expect, test } from 'bun:test';

import {
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_WITHOUT_SELECT,
    SAMPLE_VIEW_BOARD,
    SAMPLE_VIEW_DOCS,
    SAMPLE_VIEW_ROADMAP,
    SAMPLE_VIEW_SPRINT,
} from '@/testing/sampleProject.js';

import type { ProjectView } from './ProjectTypes.js';
import {
    getColumnGrouping,
    getProjectViewChoices,
    getProjectViewDefaults,
    isColumnGrouping,
    MANUAL_SORT,
    parseProjectSort,
} from './projectViewOptions.js';

describe('a saved view as the view options', () => {
    test('a table: grouped by its group-by field, sorted by its order, with the fields it shows and its filter', () => {
        expect(getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT)).toEqual({
            options: {
                layout: 'list',
                grouping: 'field:F_status',
                sort: 'field:F_priority:asc',
                properties: ['status', 'people', 'field:F_status', 'field:F_priority', 'labels', 'field:F_estimate'],
                filter: 'iteration:@current',
            },
            roadmap: false,
        });
    });

    test('a board: its column field groups it; no order is GitHub’s manual one', () => {
        expect(getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_BOARD).options).toMatchObject({
            layout: 'board',
            grouping: 'field:F_status',
            sort: MANUAL_SORT,
        });
    });

    test('a roadmap is a list, and says so', () => {
        expect(getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_ROADMAP)).toMatchObject({
            options: { layout: 'list', grouping: 'none' },
            roadmap: true,
        });
    });

    test('a board without a single select or iteration to make columns of is a list (K7)', () => {
        const view: ProjectView = { ...SAMPLE_VIEW_DOCS, layout: 'BOARD_LAYOUT' };
        expect(getProjectViewDefaults(SAMPLE_PROJECT_WITHOUT_SELECT, view).options.layout).toBe('list');
        expect(getColumnGrouping(SAMPLE_PROJECT_WITHOUT_SELECT, view)).toBeNull();
    });

    test('GitHub’s own fields: grouping by repository, milestone or assignees; sorting by title; several sort keys', () => {
        const view: ProjectView = {
            ...SAMPLE_VIEW_SPRINT,
            groupBy: [{ id: 'F_repo', name: 'Repository' }],
            sortBy: [
                { field: { id: 'F_status', name: 'Status' }, direction: 'DESC' },
                { field: { id: 'F_title', name: 'Title' }, direction: 'ASC' },
                { field: { id: 'F_linked', name: 'Linked pull requests' }, direction: 'ASC' },
            ],
            fields: [
                { id: 'F_milestone', name: 'Milestone' },
                { id: 'F_reviewers', name: 'Reviewers' },
            ],
        };
        expect(getProjectViewDefaults(SAMPLE_PROJECT, view).options).toEqual({
            layout: 'list',
            grouping: 'repository',
            sort: 'field:F_status:desc,title:asc',
            properties: ['status', 'milestone'],
            filter: 'iteration:@current',
        });
    });

    test('a board’s column field that can’t make columns falls back to the Status field', () => {
        const view: ProjectView = {
            ...SAMPLE_VIEW_BOARD,
            verticalGroupBy: [{ id: 'F_estimate', name: 'Story points' }],
        };
        expect(getColumnGrouping(SAMPLE_PROJECT, view)).toBe('field:F_status');
        expect(isColumnGrouping(SAMPLE_PROJECT, 'field:F_iteration')).toBe(true);
        expect(isColumnGrouping(SAMPLE_PROJECT, 'field:F_due')).toBe(false);
        expect(isColumnGrouping(SAMPLE_PROJECT, 'repository')).toBe(false);
    });
});

test('the choices: every field to group and sort by both ways, the view’s own order, and the properties', () => {
    const defaults = getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT).options;
    const choices = getProjectViewChoices(SAMPLE_PROJECT, defaults);
    expect(choices.groupings).toEqual([
        'none',
        'repository',
        'milestone',
        'assignees',
        'field:F_status',
        'field:F_priority',
        'field:F_iteration',
        'field:F_estimate',
        'field:F_due',
        'field:F_note',
    ]);
    expect(choices.sorts).toContain(MANUAL_SORT);
    expect(choices.sorts).toContain('field:F_priority:asc');
    expect(choices.sorts).toContain('title:desc');
    expect(choices.properties).toEqual([
        'status',
        'labels',
        'milestone',
        'people',
        'updated',
        'field:F_status',
        'field:F_priority',
        'field:F_iteration',
        'field:F_estimate',
        'field:F_due',
        'field:F_note',
    ]);
});

test('an order as written, a key the project no longer has left out', () => {
    expect(parseProjectSort(SAMPLE_PROJECT, 'field:F_priority:desc,title:asc,field:F_gone:asc')).toEqual([
        { key: 'field:F_priority', direction: 'desc' },
        { key: 'title', direction: 'asc' },
    ]);
    expect(parseProjectSort(SAMPLE_PROJECT, MANUAL_SORT)).toEqual([]);
});
