import { expect, test } from 'bun:test';

import { SAMPLE_PROJECT } from '@/testing/sampleProject.js';

import { describeProjectFilter } from './describeProjectFilter.js';

test.each<[string, string[]]>([
    // ES19's own sentence: a field by the project's name for it, GitHub's qualifiers by theirs.
    [
        'iteration:"Sprint 15" is:open repo:fitloop/mobile',
        ['Iteration is Sprint 15', 'State is open', 'Repository is fitloop/mobile'],
    ],
    ['status:todo,done -label:bug', ['Status is todo or done', 'Label is not bug']],
    ['story-points:>3 due:*..@today', ['Story points is > 3', 'Due is ≤ @today']],
    ['no:assignee,milestone -no:status', ['Assignee is empty', 'Milestone is empty', 'Status is set']],
    ['api -crash last-updated:7days', ['Text contains “api”', "Text doesn't contain “crash”", 'Last updated is 7days']],
    ['status:"Done', ['status:"Done']],
])('%s', (filter, expected) => {
    const phrases = describeProjectFilter({ filter, fields: SAMPLE_PROJECT.fields, lang: 'en' });
    // The words are glued to the next with a no-break space, which is not this test's concern.
    expect(phrases.map(phrase => phrase.replaceAll('\u00a0', ' '))).toEqual(expected);
});
