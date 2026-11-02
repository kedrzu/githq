import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './RepositoryWorkflowsView.stories.js';

const { ActionsOff, AlertsOff, Default, NoWorkflows, NotKnownYet, Refused, WithPatterns } = composeStories(stories);

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
    expect(groupNames()).toEqual(['Pull requests only', 'No alerts', 'Passing', 'Disabled']);
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

test('J/K move from the first row; Enter and a click open the selected workflow; "Alert settings" asks for the settings', async () => {
    const open = vi.fn();
    const settings = vi.fn();
    await Default.run({ args: { ...Default.args, onOpen: open, onSettings: settings } });

    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('jj');
    expect(selected()).toBe('Release');
    await userEvent.keyboard('{Enter}');
    expect(open.mock.calls[0]?.[0]).toMatchObject({ workflow: { workflow: { name: 'Release' } } });
    await userEvent.keyboard('k');
    expect(selected()).toBe('CLA');

    await userEvent.click(page.getByRole('button', { name: 'Probe' }));
    expect(selected()).toBe('Probe');
    expect(open).toHaveBeenCalledTimes(2);

    await userEvent.click(bar().getByRole('button', { name: /Alert settings/ }));
    expect(settings).toHaveBeenCalledTimes(1);
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
