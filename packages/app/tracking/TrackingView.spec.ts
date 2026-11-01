import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { SAMPLE_CANDIDATES, sampleCandidateProject, sampleCandidateRepository } from '@/testing/sampleTracking.js';

import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';
import * as stories from './TrackingView.stories.js';

const { NoOrganisations, Projects, ReadingOrganisations, Repositories, Searching, SomeoneElses } =
    composeStories(stories);

const search = () => page.getByRole('textbox', { name: 'Find something to track' });
const tracked = () => page.getByRole('region', { name: 'Tracked', exact: true });
const notTracked = () => page.getByRole('region', { name: 'Not tracked' });

type Found = CandidateProject | CandidateRepository | null;

async function sleep(ms: number) {
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function focusRow(name: string) {
    page.getByRole('link', { name, exact: true }).element().closest('li')?.querySelector('a')?.focus();
}

test('G8: tracked rows with tag, items and activity, the size only in the heading, a download in place', async () => {
    await Repositories.run();

    await expect
        .element(tracked().getByText('7 repositories · 3,692 items · 48 MB in this browser'))
        .toBeInTheDocument();
    const portal = page.getByRole('listitem').filter({ hasText: 'sigma-clinic/portal' }).first();
    await expect.element(portal).toHaveTextContent('private');
    await expect.element(portal).toHaveTextContent('1,420');
    await expect.element(portal).toHaveTextContent('active 12m ago');
    await expect.element(portal).toHaveTextContent('14s ago');

    const blog = page.getByRole('listitem').filter({ hasText: 'kedrzu/blog' }).first();
    await expect.element(blog).toHaveTextContent('Downloading · 412 of 1,180');
    await expect.element(blog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35');
});

test('G8: suggested as drawn, then how many more there are, net of what is tracked and suggested', async () => {
    await Repositories.run();

    const suggested = page.getByRole('region', { name: 'Suggested' });
    await expect.element(suggested).toHaveTextContent('not tracked, and your work lives here');
    await expect.element(suggested).toHaveTextContent('1 item in My work · active 1h ago');
    // 12 + 312 + 3, less 6 tracked of theirs (the seventh is someone else's) and 2 suggested.
    await expect
        .element(page.getByText('319 more repositories you can track. Search to find them.'))
        .toBeInTheDocument();
});

test('the Track button and T track; Untrack and ⌫ untrack', async () => {
    const onTrackSuggested = vi.fn();
    const onUntrack = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onTrackSuggested, onUntrack } });

    const row = page.getByRole('region', { name: 'Suggested' }).getByRole('listitem').first();
    await userEvent.click(row.getByRole('button', { name: /^Track/ }));
    expect(onTrackSuggested).toHaveBeenCalledWith('sigma-clinic/mobile');

    row.getByRole('button', { name: /^Track/ })
        .element()
        .focus();
    await expect.element(row.getByRole('button', { name: /^Track/ })).toHaveTextContent('T');
    await userEvent.keyboard('t');
    expect(onTrackSuggested).toHaveBeenCalledTimes(2);

    focusRow('kedrzu/skills');
    await userEvent.keyboard('{Backspace}');
    expect(onUntrack).toHaveBeenCalledWith({ kind: 'repository', nameWithOwner: 'kedrzu/skills' });

    const dotfiles = page.getByRole('listitem').filter({ hasText: 'kedrzu/dotfiles' });
    await userEvent.hover(dotfiles);
    await userEvent.click(dotfiles.getByRole('button', { name: /^Untrack/ }));
    expect(onUntrack).toHaveBeenCalledWith({ kind: 'repository', nameWithOwner: 'kedrzu/dotfiles' });
});

test('typing in the search never fires T or ⌫ on a row', async () => {
    const onTrack = vi.fn();
    const onTrackSuggested = vi.fn();
    const onUntrack = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onTrack, onTrackSuggested, onUntrack } });

    await userEvent.keyboard('/');
    await expect.element(search()).toHaveFocus();
    await userEvent.keyboard('tt{Backspace}');

    await expect.element(search()).toHaveValue('t');
    expect(onTrack).not.toHaveBeenCalled();
    expect(onTrackSuggested).not.toHaveBeenCalled();
    expect(onUntrack).not.toHaveBeenCalled();
});

test('↓ from the search goes to the rows, ↑ back; Esc clears it', async () => {
    await Repositories.run();

    await userEvent.click(search());
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('link', { name: 'sigma-clinic/portal', exact: true })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(search()).toHaveFocus();

    await userEvent.keyboard('x{Escape}');
    await expect.element(search()).toHaveValue('');
});

test('T1: a search narrows both lists by recent activity, Suggested gone, and reads on only for that', async () => {
    const onLoadMore = vi.fn();
    await Searching.run({ args: { ...Searching.args, onLoadMore } });

    await expect.element(page.getByRole('region', { name: 'Suggested' })).not.toBeInTheDocument();
    await expect.element(tracked()).not.toBeInTheDocument();
    await expect.element(notTracked()).toHaveTextContent('7 of 321');
    const rows = notTracked().getByRole('listitem');
    await expect.element(rows.nth(0)).toHaveTextContent('sigma-clinic/payments');
    await expect.element(rows.nth(0)).toHaveTextContent('private');
    await expect.element(rows.nth(0)).toHaveTextContent('41 open');
    await expect.element(rows.nth(0)).toHaveTextContent('active 1h ago');
    await expect.element(rows.nth(6)).toHaveTextContent('sigma-clinic/pay-portal-legacy');

    expect(onLoadMore).toHaveBeenCalledWith('sigma-clinic');

    onLoadMore.mockClear();
    await userEvent.clear(search());
    await expect.element(page.getByRole('region', { name: 'Suggested' })).toBeInTheDocument();
    expect(onLoadMore).not.toHaveBeenCalled();
});

test('the owner filter narrows both lists and reads only that owner, as long as it is on', async () => {
    const onLoadMore = vi.fn();
    const candidates: TrackingCandidates = {
        ...SAMPLE_CANDIDATES,
        repositories: { ...SAMPLE_CANDIDATES.repositories, nextCursor: 'mine' },
    };
    await Repositories.run({ args: { ...Repositories.args, candidates, onLoadMore } });
    expect(onLoadMore).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Owner: All owners' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'sigma-clinic' }));

    await expect.element(tracked()).toHaveTextContent('2 matches');
    await expect.element(notTracked()).toHaveTextContent('310 in sigma-clinic');
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(onLoadMore).toHaveBeenCalledWith('sigma-clinic');
});

test('a search looks across owners one at a time, the first that has pages left', async () => {
    const onLoadMore = vi.fn();
    const candidates: TrackingCandidates = {
        ...SAMPLE_CANDIDATES,
        repositories: { ...SAMPLE_CANDIDATES.repositories, nextCursor: 'mine' },
    };
    await Searching.run({ args: { ...Searching.args, candidates, onLoadMore } });

    expect(onLoadMore.mock.calls).toEqual([['kedrzu']]);
});

test("`?q=`: someone else's repository is offered once GitHub answered, and tracking it hands it on", async () => {
    const onTrack = vi.fn();
    await SomeoneElses.run({ args: { ...SomeoneElses.args, onTrack } });

    const row = notTracked().getByRole('listitem');
    await expect.element(row).toHaveTextContent('vitejs/vite');
    await expect.element(row).toHaveTextContent('88 open');
    await userEvent.click(row.getByRole('button', { name: /^Track/ }));
    expect(onTrack).toHaveBeenCalledWith(sampleCandidateRepository('vitejs/vite', { ago: 7_200_000, open: 88 }));
});

test("a project's address is looked up and offered; one already listed is not looked up", async () => {
    const project = sampleCandidateProject('Roadmap', 'tauri-apps', 2, 9);
    const find = vi.fn(() => Promise.resolve(project));
    await Projects.run({
        args: { ...Projects.args, find, initialSearch: 'https://github.com/orgs/tauri-apps/projects/2/views/1' },
    });
    await expect.element(notTracked().getByText('Roadmap')).toBeInTheDocument();
    expect(find).toHaveBeenCalledWith({ kind: 'project', owner: 'tauri-apps', ownerKind: 'org', number: 2 });
    expect(find).toHaveBeenCalledTimes(1);

    const listed = vi.fn(() => Promise.resolve(null));
    await Projects.run({
        args: { ...Projects.args, find: listed, initialSearch: 'https://github.com/orgs/sigma-clinic/projects/3' },
    });
    await expect.element(notTracked().getByText('Bug triage')).toBeInTheDocument();
    await sleep(400);
    expect(listed).not.toHaveBeenCalled();
});

test('lookups cannot race: one per settled input, and a stale answer never replaces the current one', async () => {
    const answers = new Map<string, (found: Found) => void>();
    const find = vi.fn(
        (reference: TrackingReference) =>
            new Promise<Found>(resolve => {
                answers.set(reference.owner, resolve);
            }),
    );
    await Repositories.run({ args: { ...Repositories.args, find } });

    // Typed through: only what settled is asked for.
    await userEvent.click(search());
    await userEvent.keyboard('first/one');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    expect(find).toHaveBeenCalledWith({ kind: 'repository', owner: 'first', name: 'one' });

    await userEvent.clear(search());
    await userEvent.keyboard('second/two');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(2));

    answers.get('second')?.(sampleCandidateRepository('second/two', { ago: 60_000, open: 1 }));
    await expect.element(notTracked().getByText('second/two')).toBeInTheDocument();

    answers.get('first')?.(sampleCandidateRepository('first/one', { ago: 60_000, open: 1 }));
    await sleep(50);
    await expect.element(notTracked().getByText('second/two')).toBeInTheDocument();
    await expect.element(notTracked().getByText('first/one')).not.toBeInTheDocument();
});

test('not found: the line says nothing matches', async () => {
    await Repositories.run({ args: { ...Repositories.args, initialSearch: 'nobody/nothing' } });

    await expect.element(page.getByText('Nothing you can see matches “nobody/nothing”.')).toBeInTheDocument();
});

test('T2: tracked projects, those you can see, and what tracking one means', async () => {
    const onTrack = vi.fn();
    await Projects.run({ args: { ...Projects.args, onTrack } });

    await expect.element(tracked()).toHaveTextContent('2 projects · 154 items');
    await expect.element(tracked().getByText('34 items')).toBeInTheDocument();
    await expect.element(notTracked()).toHaveTextContent('4 projects you can see');
    await expect
        .element(page.getByText("A tracked project brings its items with it, even from repositories you don't track."))
        .toBeInTheDocument();

    notTracked()
        .getByRole('button', { name: /^Track/ })
        .first()
        .element()
        .focus();
    await userEvent.keyboard('t');
    expect(onTrack).toHaveBeenCalledTimes(1);
});

test('the hidden organisation explains itself on both sections, the others say one thing', async () => {
    for (const story of [Repositories, Projects]) {
        await story.run();

        const panel = page.getByRole('complementary', { name: 'Organisations' });
        await expect.element(panel).toHaveTextContent('Private data hidden');
        await expect
            .element(panel)
            .toHaveTextContent('Until an owner approves it, only its 3 public repositories can be tracked.');
        await expect.element(panel.getByRole('link', { name: 'Request approval on GitHub' })).toBeInTheDocument();
        await expect.element(panel).toHaveTextContent('Private data visible');
    }
});

test('with no organisations the panel is gone; while reading it says so', async () => {
    await NoOrganisations.run();
    await expect.element(page.getByRole('complementary', { name: 'Organisations' })).not.toBeInTheDocument();

    await ReadingOrganisations.run();
    await expect.element(page.getByText('Reading your organisations…')).toBeInTheDocument();
});
