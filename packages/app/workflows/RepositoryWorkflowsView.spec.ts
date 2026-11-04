import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { trackTabFocus } from '@/testing/trackTabFocus.js';

import * as stories from './RepositoryWorkflowsView.stories.js';

const {
    ActionsOff,
    AlertsOff,
    Default,
    NoWorkflows,
    NotKnownYet,
    Refused,
    Unfolded,
    UnfoldedNotRead,
    UnfoldedOnRef,
    UnfoldedReadFailed,
    WithPatterns,
} = composeStories(stories);

const group = (name: string) => page.getByRole('region', { name, exact: true });
const bar = () => page.getByTestId('workflow-alerts-bar');
/** The groups' headings, top to bottom, with plain spaces: the translations keep short words with the next one. */
const groupNames = () =>
    [...document.querySelectorAll('section')].map(section =>
        section.getAttribute('aria-label')?.replaceAll(/\s/gu, ' '),
    );
/** A pattern with any space where `pattern` has one. */
const like = (pattern: string) => new RegExp(pattern.replaceAll(' ', '\\s'), 'u');
/** The name of the selected row's workflow; `null` with none. */
const selected = () => document.querySelector('button[aria-current="true"]')?.firstElementChild?.textContent ?? null;
/** The selected line's text, spaces collapsed; `null` with none. */
const selectedText = () =>
    document.querySelector('[aria-current="true"]')?.textContent?.replaceAll(/\s+/gu, ' ').trim() ?? null;
const runs = () => page.getByRole('group', { name: 'Runs of Probe' });

test('W13: every workflow is a row, in Broken, Pull requests only, No alerts, Passing and Disabled; the bar shows the default branch', async () => {
    await Default.run();

    expect(groupNames()).toEqual(['Broken', 'Pull requests only', 'No alerts', 'Passing', 'Disabled']);
    await expect.element(group('Broken')).toHaveTextContent(like('Deploy.*main.*Broken for 3h'));
    await expect
        .element(group('Pull requests only'))
        .toHaveTextContent(like('never counts.*CLA.*pull requests.*1 of the last 3 failed'));
    await expect
        .element(group('No alerts'))
        .toHaveTextContent(like('failing only on branches and tags without alerts · P to change that'));
    await expect
        .element(group('No alerts'))
        .toHaveTextContent(like('Release.*v0\\.1\\.0-rc\\.3.*Failed on v0\\.1\\.0-rc\\.3, a tag without alerts'));
    await expect
        .element(group('No alerts'))
        .toHaveTextContent(like('Nightly e2e.*staging.*Failing on a branch without alerts'));
    // A workflow GitHub generates is a plain row.
    await expect.element(group('Passing')).toHaveTextContent(like('Dependabot Updates\\s*by GitHub'));
    await expect.element(group('Disabled')).toHaveTextContent(like('Nightly backup.*Disabled on GitHub'));

    await expect.element(bar()).toHaveTextContent(like('^Alerts on\\s*main\\s*Alert settings'));
});

test('W3a: patterns show as outlines after the default branch; a workflow broken on one is under Broken', async () => {
    await WithPatterns.run();

    await expect.element(bar()).toHaveTextContent(like('Alerts on\\s*main\\s*v\\*\\s*release\\/\\*'));
    expect(groupNames()[0]).toBe('Broken');
    await expect.element(group('Broken')).toHaveTextContent(like('Release.*v\\*'));
});

test('W14: with alerts off the bar says so and every failure is under No alerts', async () => {
    await AlertsOff.run();

    await expect
        .element(bar())
        .toHaveTextContent(like('Nothing\\. Failures here never mark this repository broken\\.'));
    expect(groupNames()).toEqual(['No alerts', 'Pull requests only', 'Passing', 'Disabled']);
    await expect.element(group('No alerts')).toHaveTextContent(like('workflow alerts are off for this repository'));
    await expect.element(group('No alerts')).toHaveTextContent(like('Deploy.*Failing, alerts are off'));
});

test('W3c: rows not read yet have no verdict and no green, and what is known is "so far"', async () => {
    await NotKnownYet.run();

    await expect.element(group('Broken')).toHaveTextContent(like('^Broken\\s*1\\s*so far'));
    await expect.element(group('Passing')).toHaveTextContent(like('^Passing\\s*1\\s*so far'));
    await expect.element(group('Not known yet')).toHaveTextContent(like('CLA.*Reading…'));
    const reading = group('Not known yet').getByTestId('run-strip').first().element();
    expect([...reading.querySelectorAll('[data-kind]')].map(tick => tick.getAttribute('data-kind'))).toEqual(
        Array.from({ length: 5 }, () => 'unknown'),
    );
});

test('J/K move from the first row; Enter and a click open a broken workflow’s failed run and unfold any other, → too; "Alert settings" and P ask for the settings — on the add field from a row without alerts', async () => {
    const openRun = vi.fn();
    const unfold = vi.fn();
    const settings = vi.fn();
    await Default.run({ args: { ...Default.args, onOpenRun: openRun, onUnfold: unfold, onSettings: settings } });

    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('{Enter}');
    expect(openRun.mock.calls[0]?.[0]).toMatchObject({
        htmlUrl: 'https://github.com/fitloop/webapp/actions/runs/1005',
    });
    await userEvent.keyboard('{ArrowRight}');
    expect(unfold).toHaveBeenLastCalledWith('1');
    await userEvent.keyboard('jj');
    expect(selected()).toBe('Release');
    await userEvent.keyboard('{Enter}');
    expect(unfold).toHaveBeenLastCalledWith('3');
    await userEvent.keyboard('k');
    expect(selected()).toBe('CLA');

    await userEvent.click(page.getByRole('button', { name: 'Probe', exact: true }));
    expect(selected()).toBe('Probe');
    expect(unfold).toHaveBeenLastCalledWith('5');
    expect(openRun).toHaveBeenCalledTimes(1);

    await userEvent.click(bar().getByRole('button', { name: /Alert settings/ }));
    expect(settings).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard('p');
    expect(settings).toHaveBeenLastCalledWith(false);

    // Release fails only on a tag without alerts (W13).
    await userEvent.click(page.getByRole('button', { name: 'Release', exact: true }));
    await userEvent.keyboard('p');
    expect(settings).toHaveBeenLastCalledWith(true);
});

test('after a click, J/K take the keys back: Enter acts on the selected row, not on the button clicked', async () => {
    const openRun = vi.fn();
    const unfold = vi.fn();
    await Default.run({ args: { ...Default.args, onOpenRun: openRun, onUnfold: unfold } });

    await userEvent.click(page.getByRole('button', { name: 'Probe', exact: true }));
    expect(unfold).toHaveBeenLastCalledWith('5');
    unfold.mockClear();

    await userEvent.keyboard('k');
    const moved = selected();
    expect(moved).not.toBe('Probe');
    await userEvent.keyboard('{Enter}');

    expect(selected()).toBe(moved);
    expect(unfold).not.toHaveBeenCalledWith('5');
    expect(unfold.mock.calls.length + openRun.mock.calls.length).toBe(1);
});

test("a control Tab reached above the rows holds the keys and the commands on the rows; Enter presses it, one Escape gives them back; a row's own button holds nothing", async () => {
    trackTabFocus();
    const openRun = vi.fn();
    const unfold = vi.fn();
    const settings = vi.fn();
    await Default.run({ args: { ...Default.args, onOpenRun: openRun, onUnfold: unfold, onSettings: settings } });
    const control = bar()
        .getByRole('button', { name: /Alert settings/ })
        .element();

    await tabTo(control);
    expect(control.hasAttribute('data-tab-focus')).toBe(true);

    await userEvent.keyboard('j{ArrowDown}k');
    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('{ArrowRight}p');
    expect(unfold).not.toHaveBeenCalled();
    expect(settings).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(settings).toHaveBeenCalledTimes(1);
    expect(openRun).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ArrowRight}');
    expect(unfold).toHaveBeenLastCalledWith('1');

    const rowButton = page.getByRole('button', { name: 'Deploy', exact: true }).element();
    await tabTo(rowButton);
    expect(rowButton.hasAttribute('data-tab-focus')).toBe(false);
    await userEvent.keyboard('j');
    expect(selected()).not.toBe('Deploy');
});

test('W3b: an unfolded workflow lists its runs under its row — kept ones, then older ones read — and J/K walk into them and back out', async () => {
    const openRun = vi.fn();
    const unfold = vi.fn();
    await Unfolded.run({ args: { ...Unfolded.args, onOpenRun: openRun, onUnfold: unfold } });

    await expect
        .element(page.getByRole('button', { name: 'Probe', exact: true }))
        .toHaveAttribute('aria-expanded', 'true');
    const lines = [...runs().element().querySelectorAll('button[data-mark]')].map(line =>
        [...line.children]
            .map(cell => cell.textContent)
            .filter(Boolean)
            .join(' '),
    );
    expect(lines).toEqual([
        '#204 main push Show the waiting list on the class page in progress 1m ago',
        '#203 main push Bump vite to 7.1.7 3m 12s 14m ago',
        '#202 sofiab/tokens pull_request Move design tokens into the ui package 4m 02s 1h ago',
        '#201 chore/probe-target workflow_dispatch Try a second probe target cancelled 2h ago',
        '#200 main push Fix the timezone on recurring classes 4m 11s 3h ago',
        '#199 sofiab/tokens pull_request Move design tokens into the ui package 1m 04s Nov 1',
        '#198 v0.1.0 push Release v0.1.0 3m 25s Oct 31',
        '#197 main push Add a stale-while-revalidate cache to the API client 2m 58s Oct 30',
    ]);
    await expect.element(runs()).toHaveTextContent(like('Reading older runs…'));
    // The filter offers the refs seen, the most recent first.
    await expect
        .element(runs())
        .toHaveTextContent(like('^Ref\\s*All refs\\s*main\\s*sofiab/tokens\\s*chore/probe-target\\s*v0\\.1\\.0'));

    // A click would leave the focus on the row's button, whose Enter is its own: the keys go there.
    await userEvent.keyboard('jjjj');
    expect(selected()).toBe('Probe');
    await userEvent.keyboard('j');
    expect(selectedText()).toMatch(/^#204/u);
    await userEvent.keyboard('jj{Enter}');
    expect(openRun).toHaveBeenLastCalledWith(expect.objectContaining({ runNumber: 202, event: 'pull_request' }));
    await userEvent.keyboard('kkk');
    expect(selected()).toBe('Probe');

    // ← folds from a run, its workflow selected; so does Esc with no ref filtered.
    await userEvent.keyboard('jj{ArrowLeft}');
    expect(unfold).toHaveBeenLastCalledWith(null);
    expect(selected()).toBe('Probe');
    await userEvent.keyboard('{Escape}');
    expect(unfold).toHaveBeenCalledTimes(2);
    expect(unfold).toHaveBeenLastCalledWith(null);

    // Its number, at the line's start: the story's frame is narrower than the tab.
    await userEvent.click(runs().getByText('#198', { exact: true }));
    expect(openRun).toHaveBeenLastCalledWith(expect.objectContaining({ runNumber: 198 }));
});

test('W3b: F types a ref — the first seen one holding it, or the ref typed —, a chip picks one, and Esc shows every ref again', async () => {
    const filter = vi.fn();
    await Unfolded.run({ args: { ...Unfolded.args, onFilter: filter } });

    await userEvent.keyboard('f');
    await expect.element(runs().getByRole('textbox', { name: 'Filter by ref' })).toHaveFocus();
    await userEvent.keyboard('tok{Enter}');
    expect(filter).toHaveBeenLastCalledWith('sofiab/tokens');
    await userEvent.keyboard('f');
    await userEvent.keyboard('release/2{Enter}');
    expect(filter).toHaveBeenLastCalledWith('release/2');
    await userEvent.keyboard('f');
    await userEvent.keyboard('main{Escape}');
    expect(filter).toHaveBeenCalledTimes(2);
    await expect.element(runs().getByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(runs().getByRole('button', { name: 'v0.1.0', exact: true }));
    expect(filter).toHaveBeenLastCalledWith('v0.1.0');

    const unfold = vi.fn();
    await UnfoldedOnRef.run({ args: { ...UnfoldedOnRef.args, onFilter: filter, onUnfold: unfold } });
    await expect
        .element(runs().getByRole('button', { name: 'sofiab/tokens', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    expect(runs().element().querySelectorAll('button[data-mark]')).toHaveLength(2);
    await userEvent.keyboard('{Escape}');
    expect(filter).toHaveBeenLastCalledWith(null);
    expect(unfold).not.toHaveBeenCalled();
});

test('W3b: a failed read says so under the runs, and Enter on it asks again; the end in view asks for older runs', async () => {
    const readMore = vi.fn();
    await UnfoldedReadFailed.run({ args: { ...UnfoldedReadFailed.args, onReadMore: readMore } });

    await expect.element(runs()).toHaveTextContent(like("Couldn't read older runs from GitHub\\s*Retry"));
    expect(readMore).not.toHaveBeenCalled();
    await userEvent.keyboard('jjjjjjjjjj');
    expect(selectedText()).toMatch(/^Couldn't read older runs/u);
    await userEvent.keyboard('{Enter}');
    expect(readMore).toHaveBeenCalledTimes(1);

    const asked = vi.fn();
    await UnfoldedNotRead.run({ args: { ...UnfoldedNotRead.args, onReadMore: asked } });
    await vi.waitFor(() => expect(asked).toHaveBeenCalled());
});

test('W3d: no workflows — a neutral empty state, no bar, and a way to GitHub', async () => {
    const openOnGitHub = vi.fn();
    await NoWorkflows.run({ args: { ...NoWorkflows.args, onOpenOnGitHub: openOnGitHub } });

    await expect.element(page.getByRole('heading', { name: 'No workflows here, yet' })).toBeVisible();
    await expect.element(page.getByText('ls .github/workflows/ → empty')).toBeVisible();
    await expect.element(bar()).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: /Open on GitHub/ }));
    expect(openOnGitHub).toHaveBeenCalledWith('https://github.com/mlaine/tasklet/actions');
});

test('W3e: Actions off says so and leads to its settings on GitHub; refused names the status and keeps the rows read before', async () => {
    const openOnGitHub = vi.fn();
    await ActionsOff.run({ args: { ...ActionsOff.args, onOpenOnGitHub: openOnGitHub } });
    await expect.element(page.getByRole('heading', { name: 'Actions is switched off here' })).toBeVisible();
    await expect.element(page.getByText('actions: disabled')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: /Open Actions settings on GitHub/ }));
    expect(openOnGitHub).toHaveBeenCalledWith('https://github.com/fitloop/api/settings/actions');

    await Refused.run();
    await expect
        .element(page.getByRole('heading', { name: 'GitHub refused to list its workflows (403)' }))
        .toBeVisible();
    await expect.element(page.getByText('GET …/actions/workflows → 403')).toBeVisible();
    await expect.element(group('Broken')).toHaveTextContent(like('Deploy'));
    await expect.element(bar()).not.toBeInTheDocument();
});

async function tabTo(element: Element) {
    for (let tabs = 0; tabs < 40 && document.activeElement !== element; tabs++) {
        await userEvent.tab();
    }

    expect(document.activeElement).toBe(element);
}
