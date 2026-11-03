import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './WorkflowRerunToast.stories.js';

const { AlreadyRunning, NoPermission, OrganizationRestricted, ServerError, TooOld, Unreachable } =
    composeStories(stories);

/** The toast's words, with plain spaces: the translations keep short words with the next one. */
const toastText = () => document.querySelector('[role="region"]')?.textContent?.replaceAll(/\s+/gu, ' ');
const link = (name: string) => page.getByRole('link', { name });

test('W4l: no permission names the repository, says nothing started, leads to GitHub', async () => {
    await NoPermission.run();

    await expect.element(page.getByText(matchText("Deploy #4821 wasn't re-run: no permission"))).toBeVisible();
    expect(toastText()).toContain(
        "GitHub refused it: your role in fitloop/webapp can't run workflows. Nothing was started, and the run is still failed.",
    );
    await expect
        .element(link('Open on GitHub'))
        .toHaveAttribute('href', 'https://github.com/fitloop/webapp/actions/runs/4821');
});

test('W4l: too old says for how long, and how to run it anew', async () => {
    await TooOld.run();

    await expect.element(page.getByText(matchText("Deploy #4821 wasn't re-run: the run is too old"))).toBeVisible();
    expect(toastText()).toContain(
        'GitHub refused it: a run can be re-run for about a month after it ran. Nothing was started. A new commit or a manual run on GitHub starts a new one.',
    );
    await expect.element(link('Open on GitHub')).toBeVisible();
});

test('W4l: already running has nothing to open: the page follows that run', async () => {
    await AlreadyRunning.run();

    await expect.element(page.getByText(matchText("Deploy #4821 wasn't re-run: it's already running"))).toBeVisible();
    expect(toastText()).toContain(
        'GitHub refused it: someone else re-ran it a moment ago. This page now follows that run.',
    );
    await expect.element(link('Open on GitHub')).not.toBeInTheDocument();
});

test('no answer and a failure on GitHub’s side say so, as no refusal', async () => {
    await Unreachable.run();
    await expect
        .element(page.getByText(matchText("Deploy #4821 wasn't re-run: GitHub couldn't be reached")))
        .toBeVisible();
    expect(document.body.textContent).not.toContain('refused');

    await ServerError.run();
    await expect.element(page.getByText(matchText("Deploy #4821 wasn't re-run: GitHub failed"))).toBeVisible();
    expect(toastText()).toContain('GitHub answered 502, a failure on its side rather than a refusal.');
});

test('G5: an organisation that has not approved githq leads to requesting that', async () => {
    await OrganizationRestricted.run();

    await expect.element(link('Request access on GitHub')).toBeVisible();
});
