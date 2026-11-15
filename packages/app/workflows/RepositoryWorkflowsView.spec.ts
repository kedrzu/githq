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
    NotReadYet,
    Opened,
    Refused,
    RunOpened,
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

test('J/K move from the first row; Enter and a click open the workflow, ⇧Enter full screen, F its latest failure on any ref — nothing without one; "Alert settings" and P ask for the settings — on the add field from a row without alerts', async () => {
    const open = vi.fn();
    const fullScreen = vi.fn();
    const openRun = vi.fn();
    const settings = vi.fn();
    await Default.run({
        args: { ...Default.args, onOpen: open, onFullScreen: fullScreen, onOpenRun: openRun, onSettings: settings },
    });

    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('{Enter}');
    expect(open).toHaveBeenLastCalledWith('1');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(fullScreen).toHaveBeenLastCalledWith('1');
    await userEvent.keyboard('f');
    expect(openRun).toHaveBeenLastCalledWith(
        expect.objectContaining({ htmlUrl: 'https://github.com/fitloop/webapp/actions/runs/1005' }),
    );
    // CLA's failure was a pull request's: F opens it all the same.
    await userEvent.keyboard('j');
    expect(selected()).toBe('CLA');
    await userEvent.keyboard('f');
    expect(openRun).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'pull_request_target' }));
    expect(open).toHaveBeenCalledTimes(1);

    await userEvent.click(page.getByRole('button', { name: 'Probe', exact: true }));
    expect(selected()).toBe('Probe');
    expect(open).toHaveBeenLastCalledWith('5');
    // Probe never failed.
    await userEvent.keyboard('f');
    expect(openRun).toHaveBeenCalledTimes(2);

    await userEvent.click(bar().getByRole('button', { name: /Alert settings/ }));
    expect(settings).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard('p');
    expect(settings).toHaveBeenLastCalledWith(false);

    // Release fails only on a tag without alerts (W13).
    await userEvent.click(page.getByRole('button', { name: 'Release', exact: true }));
    await userEvent.keyboard('p');
    expect(settings).toHaveBeenLastCalledWith(true);
});

test('D15: with a workflow open in the panel its row is selected: Enter or a click on it expands it and ⇧Enter is the item’s; moving the selection or clicking another row opens that one in its place', async () => {
    const open = vi.fn();
    const expand = vi.fn();
    const fullScreen = vi.fn();
    await Opened.run({ args: { ...Opened.args, onOpen: open, onExpand: expand, onFullScreen: fullScreen } });

    expect(selected()).toBe('Probe');
    await userEvent.keyboard('{Enter}');
    expect(expand).toHaveBeenLastCalledWith('5');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(fullScreen).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();

    await userEvent.keyboard('j');
    await vi.waitFor(() => expect(open).toHaveBeenLastCalledWith('6'));
    await userEvent.click(page.getByRole('button', { name: 'Deploy', exact: true }));
    await vi.waitFor(() => expect(open).toHaveBeenLastCalledWith('1'));
    expect(open).toHaveBeenCalledTimes(2);
    expect(expand).toHaveBeenCalledTimes(1);
});

test('with a run open in the panel its workflow’s row is selected and stays: J/K, Enter, ⇧Enter and F are the run’s; a click on a row opens that workflow in the run’s place', async () => {
    const open = vi.fn();
    const expand = vi.fn();
    const fullScreen = vi.fn();
    const openRun = vi.fn();
    await RunOpened.run({
        args: { ...RunOpened.args, onOpen: open, onExpand: expand, onFullScreen: fullScreen, onOpenRun: openRun },
    });

    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('jj{ArrowDown}k');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await userEvent.keyboard('f');
    expect(selected()).toBe('Deploy');
    expect(open).not.toHaveBeenCalled();
    expect(expand).not.toHaveBeenCalled();
    expect(fullScreen).not.toHaveBeenCalled();
    expect(openRun).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Deploy', exact: true }));
    expect(open).toHaveBeenLastCalledWith('1');
    await userEvent.click(page.getByRole('button', { name: 'Probe', exact: true }));
    expect(open).toHaveBeenLastCalledWith('5');
    expect(open).toHaveBeenCalledTimes(2);
    expect(expand).not.toHaveBeenCalled();
});

test('after a click, J/K take the keys back: Enter acts on the selected row, not on the button clicked', async () => {
    const open = vi.fn();
    await Default.run({ args: { ...Default.args, onOpen: open } });

    await userEvent.click(page.getByRole('button', { name: 'Probe', exact: true }));
    expect(open).toHaveBeenLastCalledWith('5');
    open.mockClear();

    await userEvent.keyboard('k');
    const moved = selected();
    expect(moved).not.toBe('Probe');
    await userEvent.keyboard('{Enter}');

    expect(selected()).toBe(moved);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalledWith('5');
});

test("a control Tab reached above the rows holds the keys and the commands on the rows; Enter presses it, one Escape gives them back; a row's own button holds nothing", async () => {
    trackTabFocus();
    const open = vi.fn();
    const openRun = vi.fn();
    const settings = vi.fn();
    await Default.run({ args: { ...Default.args, onOpen: open, onOpenRun: openRun, onSettings: settings } });
    const control = bar()
        .getByRole('button', { name: /Alert settings/ })
        .element();

    await tabTo(control);
    expect(control.hasAttribute('data-tab-focus')).toBe(true);

    await userEvent.keyboard('j{ArrowDown}k');
    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('fp');
    expect(openRun).not.toHaveBeenCalled();
    expect(settings).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(settings).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('f');
    expect(openRun).toHaveBeenCalledTimes(1);

    const rowButton = page.getByRole('button', { name: 'Deploy', exact: true }).element();
    await tabTo(rowButton);
    expect(rowButton.hasAttribute('data-tab-focus')).toBe(false);
    await userEvent.keyboard('j');
    expect(selected()).not.toBe('Deploy');
});

test('first run and loading D17, ES27: before the first read, ghost workflow rows, read out as one line — no message, no bar', async () => {
    await NotReadYet.run();

    await expect.element(page.getByText('Still arriving from GitHub')).toBeInTheDocument();
    await expect.element(page.getByRole('heading')).not.toBeInTheDocument();
    await expect.element(bar()).not.toBeInTheDocument();
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
