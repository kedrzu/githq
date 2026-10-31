import { expect, test } from 'bun:test';

import { SAMPLE_PROJECT, SAMPLE_PROJECT_ENTRIES, SAMPLE_TODAY } from '@/testing/sampleProject.js';

import { getProjectEntryId } from './buildProjectList.js';
import { compileProjectFilter } from './filter/compileProjectFilter.js';
import { selectProjectEntries } from './selectProjectEntries.js';

test('archived items are never shown (D13)', () => {
    const shown = selectProjectEntries({ entries: SAMPLE_PROJECT_ENTRIES, filter: compile(null), answered: null });
    expect(shown?.map(getProjectEntryId)).not.toContain('I_1001');
    expect(shown).toHaveLength(SAMPLE_PROJECT_ENTRIES.length - 1);
});

test('a filter evaluated here shows what it matches', () => {
    const shown = selectProjectEntries({
        entries: SAMPLE_PROJECT_ENTRIES,
        filter: compile('status:Done'),
        answered: null,
    });
    // The archived Done item stays hidden.
    expect(shown?.map(getProjectEntryId)).toEqual(['I_1150']);
});

test('a filter left to GitHub waits for its answer, never showing the unfiltered items (K6)', () => {
    const filter = compile('reviewers:octocat');
    expect(filter.kind).toBe('github');
    expect(selectProjectEntries({ entries: SAMPLE_PROJECT_ENTRIES, filter, answered: null })).toBeNull();

    const answered = new Set(['PVTI_PR_477', 'PVTI_I_1001']);
    const shown = selectProjectEntries({ entries: SAMPLE_PROJECT_ENTRIES, filter, answered });
    expect(shown?.map(getProjectEntryId)).toEqual(['PR_477']);
});

function compile(filter: string | null) {
    return compileProjectFilter({
        filter,
        fields: SAMPLE_PROJECT.fields,
        viewerLogin: 'kedrzu',
        today: SAMPLE_TODAY,
        hasDrafts: true,
        hasDraftPullRequests: false,
    });
}
