import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './UpdateSegment.stories.js';

const {
    Ready,
    Checking,
    UpToDate,
    Downloading,
    DownloadingNoPercent,
    FailedOffline,
    FailedUnreachable,
    NoRelease,
    NoDevelopmentBuild,
    Installing,
    InstallFailed,
} = composeStories(stories);

test('U50: the quiet trace of a dismissed toast waits for the user — Restart restarts, nothing happens on its own', async () => {
    await Ready.run();

    await expect.element(page.getByText(/^githq 1\.4\.0 ready$/)).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Later' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(Ready.args.onRestart).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Restart' }));
    expect(Ready.args.onRestart).toHaveBeenCalledOnce();
});

for (const [name, story, text] of [
    ['U21: checking', Checking, 'Checking for updates…'],
    ['U22: up to date', UpToDate, 'githq 1.3.0 is the newest version'],
    ['U22: downloading', Downloading, 'Downloading githq 1.4.0, 38%'],
    ['downloading with no length', DownloadingNoPercent, /^Downloading githq 1\.4\.0$/],
    ['U22: no release', NoRelease, 'No Stable version yet'],
    ['no release on Development', NoDevelopmentBuild, 'No Development build yet'],
    ['U40: installing', Installing, 'Installing githq 1.4.0…'],
] as const) {
    test(`${name} says so and offers nothing`, async () => {
        await story.run();

        await expect.element(page.getByText(text)).toBeVisible();
        await expect.element(page.getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
        await expect.element(page.getByRole('button', { name: 'Later' })).not.toBeInTheDocument();
        await expect.element(page.getByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
        await expect.element(page.getByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });
}

for (const [name, story, text] of [
    ['offline', FailedOffline, "Couldn't check for updates: you're offline"],
    ['GitHub out of reach', FailedUnreachable, "Couldn't check for updates: GitHub can't be reached"],
] as const) {
    test(`U22: a failed check, ${name}, offers Try again, which checks, and Dismiss`, async () => {
        await story.run();

        await expect.element(page.getByText(text)).toBeVisible();
        await userEvent.click(page.getByRole('button', { name: 'Try again' }));
        expect(story.args.onCheck).toHaveBeenCalledOnce();
        expect(story.args.onRestart).not.toHaveBeenCalled();

        await userEvent.click(page.getByRole('button', { name: 'Dismiss' }));
        expect(story.args.onDismiss).toHaveBeenCalledOnce();
    });
}

test('U51: a failed install, its toast dismissed, keeps Try again, which restarts', async () => {
    await InstallFailed.run();

    await expect.element(page.getByText("githq 1.4.0 couldn't be installed")).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Later' })).not.toBeInTheDocument();
    expect(InstallFailed.args.onRestart).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    expect(InstallFailed.args.onRestart).toHaveBeenCalledOnce();
    expect(InstallFailed.args.onCheck).not.toHaveBeenCalled();
});
