import { expect, test } from 'bun:test';

import { countListRows } from '@/lists/countListRows.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { SAMPLE_PROJECT, SAMPLE_PROJECT_FIELDS, SAMPLE_TODAY } from '@/testing/sampleProject.js';
import { sampleStack } from '@/testing/sampleStacks.js';

import type { ProjectListTexts } from './buildProjectList.js';
import { buildProjectList } from './buildProjectList.js';
import { foldProjectGroups } from './foldProjectGroups.js';
import type { ProjectGrouping } from './projectViewOptions.js';
import { MANUAL_SORT } from './projectViewOptions.js';
import type { ProjectEntry } from './ProjectTypes.js';

const TEXTS: ProjectListTexts = {
    all: 'All items',
    noValue: field => `No ${field}`,
    unassigned: 'Unassigned',
    noMilestone: 'No milestone',
    drafts: 'Drafts',
    iterationDetail: iteration => iteration.startDate,
};

const STACK = sampleStack({ id: 'S_1', number: 11, members: [{}, {}, {}] });
const ISSUE = sampleIssue('I_1');
const ENTRIES = [...STACK, ISSUE].map(toEntry);

test('a stack of three matched pull requests is one entry, grouped as the view shown is or not grouped as one counted', () => {
    expect(countListRows(fold('field:F_status'))).toBe(2);
    expect(countListRows(fold('none'))).toBe(2);
});

function fold(grouping: ProjectGrouping) {
    const items = new Map<string, Item>([...STACK, ISSUE].map(item => [item.id, item]));
    return foldProjectGroups({
        matched: ENTRIES,
        entries: ENTRIES,
        build: shown =>
            buildProjectList({
                project: SAMPLE_PROJECT,
                entries: shown,
                grouping,
                sort: MANUAL_SORT,
                texts: TEXTS,
                today: SAMPLE_TODAY,
            }),
        stacks: groupStacks(items.values()),
        describe: stack => describeStack({ stack, viewerLogin: 'kedrzu', getItem: id => items.get(id) }),
    });
}

function toEntry(content: Item): ProjectEntry {
    const [todo] = SAMPLE_PROJECT_FIELDS.status.options;
    return {
        item: {
            itemId: `PVTI_${content.id}`,
            projectId: SAMPLE_PROJECT.id,
            contentId: content.id,
            draft: null,
            values: { F_status: { kind: 'singleSelect', optionId: todo.id, name: todo.name, color: todo.color } },
            updatedAt: content.updatedAt,
            isArchived: false,
        },
        content,
    };
}
