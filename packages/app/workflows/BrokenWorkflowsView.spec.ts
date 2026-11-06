import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './BrokenWorkflowsView.stories.js';

const { Everything, NotKnownYet, NothingBroken, NothingBrokenOneRefused, NothingTracked, PartlyKnown } =
    composeStories(stories);

const group = (name: string) => page.getByRole('region', { name, exact: true });
/** The workflows' names, in the order the rows show them. */
const rowNames = () =>
    page
        .getByRole('button')
        .elements()
        .map(button => button.firstElementChild?.textContent);
/** The name of the selected row's workflow; `null` with none. */
const selected = () => document.querySelector('button[aria-current="true"]')?.firstElementChild?.textContent ?? null;

test('W2: broken workflows grouped by how new the break is, newest first, each naming its repository', async () => {
    await Everything.run();

    await expect.element(page.getByRole('heading', { name: 'Broken workflows', level: 1 })).toBeVisible();
    await expect.element(page.getByText(matchText('5 in 3 repositories'))).toBeVisible();
    await expect.element(group('New')).toHaveTextContent(/^New\s*2\s*broke in the last 24 hours/u);
    await expect.element(group('Ongoing')).toHaveTextContent(/^Ongoing\s*3/u);
    expect(rowNames()).toEqual(['CI', 'Deploy', 'Nightly', 'Release', 'Dependabot Updates']);
    await expect.element(group('New').getByText('fitloop/webapp')).toBeVisible();
    // Passing workflows are not listed, nor a repository with nothing broken.
    await expect.element(page.getByText('Probe')).not.toBeInTheDocument();
    await expect.element(page.getByText('mlaine/tasklet')).not.toBeInTheDocument();
});

test('J/K and the arrows move the selection, from the first row; Enter opens the selected workflow', async () => {
    const open = vi.fn();
    await Everything.run({ args: { ...Everything.args, onOpen: open } });

    expect(selected()).toBe('CI');
    await userEvent.keyboard('j');
    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(selected()).toBe('Release');
    await userEvent.keyboard('k');
    expect(selected()).toBe('Nightly');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(selected()).toBe('CI');
    await userEvent.keyboard('jjjjjjj');
    expect(selected()).toBe('Dependabot Updates');

    await userEvent.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toMatchObject({
        nameWithOwner: 'fitloop/api',
        workflow: { latestFailedRun: { htmlUrl: 'https://github.com/fitloop/api/actions/runs/5002' } },
    });
});

test('a click on a row selects it and opens it', async () => {
    const open = vi.fn();
    await Everything.run({ args: { ...Everything.args, onOpen: open } });

    await userEvent.click(page.getByRole('button', { name: 'Nightly' }));
    expect(selected()).toBe('Nightly');
    expect(open.mock.calls[0]?.[0]).toMatchObject({ nameWithOwner: 'mlaine/mdlint' });
});

test('after a click, J/K take the keys back: Enter opens the selected row, not the one clicked', async () => {
    const open = vi.fn();
    await Everything.run({ args: { ...Everything.args, onOpen: open } });

    await userEvent.click(page.getByRole('button', { name: /^CI/u }).first());
    expect(open).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('j');
    expect(selected()).toBe('Deploy');
    await userEvent.keyboard('{Enter}');

    expect(selected()).toBe('Deploy');
    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1]?.[0]).toMatchObject({ workflow: { workflow: { name: 'Deploy' } } });
});

test('W2c: while some repositories are unread the total is "so far" and nothing claims them healthy', async () => {
    await PartlyKnown.run();

    await expect.element(page.getByText(matchText('1 so far · reading 2 repositories'))).toBeVisible();
    await expect.element(page.getByText('Still arriving from GitHub')).toBeInTheDocument();
    await expect.element(page.getByText('All green, exit code 0')).not.toBeInTheDocument();
});

test("W2c: a repository GitHub shows nothing of is under Can't tell, at the bottom and out of the total", async () => {
    await PartlyKnown.run();

    const cantTell = group("Can't tell");
    await expect.element(cantTell).toHaveTextContent(/^Can't tell\s*1\s*not in the total/u);
    await expect.element(cantTell).toHaveTextContent(/Actions turned off\s*fitloop\/api/u);
    await expect.element(cantTell).toHaveTextContent(/GitHub says Actions is disabled for this repository/u);
    const regions = page.getByRole('region').elements();
    expect(regions.at(-1)?.getAttribute('aria-label')).toBe("Can't tell");
});

test('first run and loading ES28: nothing read yet — ghost rows, no zero and no green', async () => {
    await NotKnownYet.run();

    await expect.element(page.getByText(matchText('reading 2 repositories'))).toBeVisible();
    await expect.element(page.getByText('Still arriving from GitHub')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { level: 2 })).not.toBeInTheDocument();
    await expect.element(page.getByText(/^none\s/u)).not.toBeInTheDocument();
    await expect.element(page.getByText('All green, exit code 0')).not.toBeInTheDocument();
});

test('W2b: everything read and nothing broken — all green, with how many repositories were read and when', async () => {
    await NothingBroken.run();

    await expect.element(page.getByText(matchText('none in 4 repositories'))).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'All green, exit code 0' })).toBeVisible();
    await expect
        .element(page.getByText(/^Every\sworkflow\sthat\scounts\spasses\sin\sall\s4\stracked\srepositories\./u))
        .toBeVisible();
    await expect.element(page.getByText(matchText('4/4 repositories · 0 broken · read 40s ago'))).toBeVisible();
    // Nothing to open: Enter does nothing, and no hint offers it.
    await expect.element(page.getByText('Open failed run')).not.toBeInTheDocument();
});

test("W2b: a repository GitHub refused stays out of the green, which says what it covers, and under Can't tell", async () => {
    await NothingBrokenOneRefused.run();

    await expect
        .element(page.getByText(/^Every\sworkflow\sthat\scounts\spasses\sin\s1\sof\s2\stracked\srepositories;/u))
        .toBeVisible();
    await expect.element(page.getByText(matchText('1/2 repositories · 0 broken · read 40s ago'))).toBeVisible();
    await expect
        .element(group("Can't tell"))
        .toHaveTextContent(
            /GitHub refused\s*fitloop\/api.*GitHub refused to show this repository's workflows \(403\)/u,
        );
});

test('with no repository tracked it says so', async () => {
    await NothingTracked.run();

    await expect.element(page.getByRole('heading', { name: 'No repositories tracked' })).toBeVisible();
});
