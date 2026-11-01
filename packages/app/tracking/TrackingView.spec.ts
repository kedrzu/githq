import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { sampleCandidateRepository, SAMPLE_CANDIDATES } from '@/testing/sampleTracking.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';

import type { TrackedRow } from './TrackingView.vue';
import * as stories from './TrackingView.stories.js';

const { Projects, Repositories } = composeStories(stories);

const TRACKED = {
    repositories: [trackedRow('kedrzu/keynote'), trackedRow('kedrzu/note'), trackedRow('kedrzu/Żółty-theme')],
    projects: [],
};

test('typed text ranks what is tracked, best first', async () => {
    await Repositories.run({ args: { ...Repositories.args, tracked: TRACKED } });

    await find('note');
    await expect.poll(trackedNames).toEqual(['kedrzu/note', 'kedrzu/keynote']);
});

test('words in another order and a name without its diacritics find the same row; scattered letters do not', async () => {
    await Repositories.run({ args: { ...Repositories.args, tracked: TRACKED } });

    await find('zolty');
    await expect.poll(trackedNames).toEqual(['kedrzu/Żółty-theme']);

    await find('theme zolty');
    await expect.poll(trackedNames).toEqual(['kedrzu/Żółty-theme']);

    // Its letters in order, but none of its words.
    await find('ztm');
    await expect.poll(trackedNames).toEqual([]);
});

test('what is not tracked is ranked before it is cut to the first twenty', async () => {
    const repositories = [
        ...Array.from({ length: 24 }, (_, index) =>
            sampleCandidateRepository(`skyline-labs/keynote-${index}`, { ago: 0, open: 0 }),
        ),
        sampleCandidateRepository('skyline-labs/note', { ago: 0, open: 0 }),
    ];
    await Repositories.run({
        args: {
            ...Repositories.args,
            candidates: {
                ...SAMPLE_CANDIDATES,
                repositories: { repositories, totalCount: repositories.length, nextCursor: null },
                organizations: [],
            },
        },
    });

    await find('note');
    await expect.poll(() => notTracked().length).toBe(20);
    expect(notTracked()[0]).toMatch(/^skyline-labs\/note/u);
});

test('words in another order find a project to track; with nothing typed they stay in their order', async () => {
    await Projects.run();

    await expect
        .poll(notTracked)
        .toEqual([
            expect.stringMatching(/^Platform Q4/u),
            expect.stringMatching(/^Bug triage/u),
            expect.stringMatching(/^Docs revamp/u),
            expect.stringMatching(/^Mobile 2\.0/u),
        ]);

    await find('q4 platform');
    await expect.poll(notTracked).toEqual([expect.stringMatching(/^Platform Q4/u)]);
});

/** Types into the page's filter, in place of what was there. */
async function find(text: string) {
    const field = page.getByRole('textbox', { name: 'Find something to track' });
    await userEvent.clear(field);
    await userEvent.type(field, text);
}

function trackedNames() {
    return page
        .getByRole('region', { name: 'Tracked', exact: true })
        .getByRole('listitem')
        .elements()
        .map(row => row.querySelector('a')?.textContent);
}

/** The rows of "Not tracked" (or the suggested projects under it), each its whole text: the name comes first. */
function notTracked() {
    return page
        .getByRole('region', { name: 'Not tracked', exact: true })
        .getByRole('listitem')
        .elements()
        .map(row => row.textContent);
}

function trackedRow(name: string): TrackedRow {
    return {
        target: { kind: 'repository', nameWithOwner: name },
        name,
        to: `/${name}`,
        isPrivate: false,
        items: 1,
        state: { kind: 'read', at: SAMPLE_NOW, fresh: true, slower: false },
    };
}
