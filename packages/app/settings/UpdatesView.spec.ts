import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './UpdatesView.stories.js';

const {
    StableVersion,
    DevelopmentBuild,
    NoCommit,
    NothingCheckedYet,
    Checking,
    UpToDate,
    Downloading,
    DownloadingNoLength,
    Ready,
    FailedOffline,
    FailedUnreachable,
    NoStableYet,
    NoDevelopmentBuildYet,
    Windows,
    ConfirmSwitch,
    ToStableDownloading,
    ToStableReady,
    DevelopmentReadyOnStable,
    ToStableOffline,
    ToStableUnreachable,
    ToStableNoRelease,
    ToDevelopmentNothingNewer,
    Installing,
    InstallFailed,
} = composeStories(stories);

const STILL_STABLE = "It's older than the build you're on, as expected.";

for (const [name, story, line] of [
    ['a Stable version', StableVersion, 'Stable version, following Stable'],
    ['a Development build', DevelopmentBuild, 'Development build from commit 632d28b, following Development'],
    ['a local build, with no commit', NoCommit, 'Development build, following Development'],
    ['a Stable version on Development', ToDevelopmentNothingNewer, 'Stable version, following Development'],
    ['Windows, with nothing else to follow', Windows, 'Stable version'],
] as const) {
    test(`the line under the version says what is running and what it follows: ${name}`, async () => {
        await story.run();

        await expect.element(page.getByText(matchText(line))).toBeVisible();
    });
}

for (const [name, story, title, detail] of [
    ['U3: up to date', StableVersion, "You're on the newest version", 'Checked 2 hours ago.'],
    ['U4: up to date on a build', DevelopmentBuild, "You're on the newest build", 'Checked 6 minutes ago.'],
    ['U6: just checked', UpToDate, "You're on the newest version", 'Checked just now.'],
    ['U8: ready', Ready, 'githq 0.2.1 is ready', 'Restart to start using it.'],
    ['U9: offline', FailedOffline, "Couldn't check for updates", "You're offline. githq tries again by itself."],
    [
        'U10: unreachable',
        FailedUnreachable,
        "Couldn't check for updates",
        "GitHub can't be reached right now. githq tries again by itself.",
    ],
    [
        'U11: no Stable, at a later check',
        NoStableYet,
        'No Stable version yet',
        "The first one will be 0.1.0. githq gets it by itself once it's out.",
    ],
    [
        'no Development build',
        NoDevelopmentBuildYet,
        'No Development build yet',
        "githq gets it by itself once it's out.",
    ],
    [
        'U15: ready, to an older Stable',
        ToStableReady,
        'githq 0.2.0 is ready',
        `${STILL_STABLE} Your GitHub data is fetched again after the restart.`,
    ],
    [
        'a Development build still ready after the switch',
        DevelopmentReadyOnStable,
        'githq 0.3.0-dev.215 is ready',
        'Restart to start using it.',
    ],
    [
        'U16: to Stable, offline',
        ToStableOffline,
        "Couldn't get Stable yet",
        "You're offline. You stay on this build until githq can reach GitHub, then the newest Stable installs.",
    ],
    [
        'to Stable, unreachable',
        ToStableUnreachable,
        "Couldn't get Stable yet",
        "GitHub can't be reached right now. You stay on this build until githq can reach GitHub, then the newest Stable installs.",
    ],
    [
        'U17: to Stable, none yet',
        ToStableNoRelease,
        'No Stable version yet, so nothing was installed',
        'You stay on this build and get no more updates until 0.1.0 is out, or until you go back to Development.',
    ],
    [
        'U18: to Development, nothing newer',
        ToDevelopmentNothingNewer,
        'Nothing newer than 0.2.0 yet',
        'You stay on this version. The next Development build downloads by itself.',
    ],
    ['a failed install', InstallFailed, "githq 0.2.1 couldn't be installed", "You're still on 0.2.0. Nothing is lost."],
] as const) {
    test(`the status line, ${name}`, async () => {
        await story.run();

        const status = page.getByRole('status');
        await expect.element(status.getByText(matchText(title))).toBeVisible();
        await expect.element(status.getByText(matchText(detail))).toBeVisible();
    });
}

for (const [name, story, title, value] of [
    ['U7: downloading', Downloading, 'Found githq 0.2.1. Downloading, 38%', '38'],
    ['U14: to Stable', ToStableDownloading, 'Found githq 0.2.0, the newest Stable. Downloading, 62%', '62'],
] as const) {
    test(`${name} says how far it is, and the bar says the same`, async () => {
        await story.run();

        await expect.element(page.getByText(matchText(title))).toBeVisible();
        await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', value);
    });
}

test('a download of no known length leaves the percent out and the bar empty', async () => {
    await DownloadingNoLength.run();

    await expect.element(page.getByText(matchText('Found githq 0.2.1. Downloading'))).toBeVisible();
    await expect.element(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
});

test('before anything was checked there is no status line to say the app is up to date', async () => {
    await NothingCheckedYet.run();

    await expect.element(page.getByRole('status')).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Check for updates' })).toBeEnabled();
});

test('Check for updates, by button and by `U`, checks', async () => {
    const onCheck = vi.fn();
    await StableVersion.run({ args: { ...StableVersion.args, onCheck } });

    await userEvent.click(page.getByRole('button', { name: 'Check for updates' }));
    expect(onCheck).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('u');
    expect(onCheck).toHaveBeenCalledTimes(2);
});

for (const [name, story] of [
    ['U5: checking', Checking],
    ['U7: downloading', Downloading],
    ['installing', Installing],
] as const) {
    test(`Check for updates rests while the updater is at it, the key too: ${name}`, async () => {
        const onCheck = vi.fn();
        await story.run({ args: { ...story.args, onCheck } });

        await expect.element(page.getByRole('button', { name: 'Check for updates' })).toBeDisabled();
        await userEvent.keyboard('u');
        expect(onCheck).not.toHaveBeenCalled();
    });
}

for (const [name, story, action] of [
    ['U8: Restart', Ready, 'Restart'],
    ['a failed install: Try again', InstallFailed, 'Try again'],
] as const) {
    test(`${name}, by button and by \`R\`, restarts`, async () => {
        const onRestart = vi.fn();
        await story.run({ args: { ...story.args, onRestart } });

        await userEvent.click(page.getByRole('button', { name: action }));
        expect(onRestart).toHaveBeenCalledTimes(1);

        await userEvent.keyboard('r');
        expect(onRestart).toHaveBeenCalledTimes(2);
    });
}

test('with nothing to restart into there is no button and `R` does nothing', async () => {
    const onRestart = vi.fn();
    await Installing.run({ args: { ...Installing.args, onRestart } });

    await expect.element(page.getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    await expect.element(page.getByText(matchText('Installing githq 0.2.1…'))).toBeVisible();
    await userEvent.keyboard('r');
    expect(onRestart).not.toHaveBeenCalled();
});

test('U12: Windows offers no choice of stream', async () => {
    await Windows.run();

    await expect.element(page.getByRole('heading', { name: 'Update stream' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('radio')).not.toBeInTheDocument();
});

test('U13: choosing Stable on a Development build asks first; Escape leaves the stream as it was', async () => {
    const onSetStream = vi.fn();
    await DevelopmentBuild.run({ args: { ...DevelopmentBuild.args, onSetStream } });

    await userEvent.click(page.getByRole('radio', { name: 'Stable' }));

    const dialog = page.getByRole('dialog', { name: 'Switch to Stable?' });
    await expect.element(dialog).toBeVisible();
    await expect
        .element(
            dialog.getByText(
                matchText(
                    "githq installs the newest Stable version right away. It can be older than 0.3.0-dev.214, the build you're on.",
                ),
            ),
        )
        .toBeVisible();
    // Behind the dialog, so out of the accessibility tree.
    await expect.element(page.getByRole('radio', { name: 'Development', includeHidden: true })).toBeChecked();

    await userEvent.keyboard('{Escape}');

    await expect.element(dialog).not.toBeInTheDocument();
    expect(onSetStream).not.toHaveBeenCalled();
    await expect.element(page.getByRole('radio', { name: 'Development' })).toBeChecked();
});

test('U13: Cancel asks nothing more, and the focus coming back to the radio does not ask again', async () => {
    const onSetStream = vi.fn();
    await DevelopmentBuild.run({ args: { ...DevelopmentBuild.args, onSetStream } });

    await userEvent.click(page.getByRole('radio', { name: 'Stable' }));
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(onSetStream).not.toHaveBeenCalled();
});

test('U13: the arrow key asks too, and Enter on what the dialog focuses switches, once', async () => {
    const onSetStream = vi.fn();
    await DevelopmentBuild.run({ args: { ...DevelopmentBuild.args, onSetStream } });

    await userEvent.tab();
    await userEvent.tab();
    await expect.element(page.getByRole('radio', { name: 'Development' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(page.getByRole('dialog', { name: 'Switch to Stable?' })).toBeVisible();
    expect(onSetStream).not.toHaveBeenCalled();

    await expect.element(page.getByRole('button', { name: 'Switch to Stable' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(onSetStream).toHaveBeenCalledExactlyOnceWith('stable');
});

test('opened from outside, by the model, it says the same and its button switches', async () => {
    const onSetStream = vi.fn();
    await ConfirmSwitch.run({ args: { ...ConfirmSwitch.args, onSetStream } });

    await userEvent.click(page.getByRole('button', { name: 'Switch to Stable' }));

    expect(onSetStream).toHaveBeenCalledExactlyOnceWith('stable');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

test('U18: to Development from a Stable version switches at once, with no dialog', async () => {
    const onSetStream = vi.fn();
    await StableVersion.run({ args: { ...StableVersion.args, onSetStream } });

    await userEvent.click(page.getByRole('radio', { name: 'Development' }));

    expect(onSetStream).toHaveBeenCalledExactlyOnceWith('development');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

test('a Stable version following Development goes back to Stable with no dialog', async () => {
    const onSetStream = vi.fn();
    await ToDevelopmentNothingNewer.run({ args: { ...ToDevelopmentNothingNewer.args, onSetStream } });

    await userEvent.click(page.getByRole('radio', { name: 'Stable' }));

    expect(onSetStream).toHaveBeenCalledExactlyOnceWith('stable');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

test('a Development build already on Stable goes back to Development with no dialog', async () => {
    const onSetStream = vi.fn();
    await ToStableOffline.run({ args: { ...ToStableOffline.args, onSetStream } });

    await userEvent.click(page.getByRole('radio', { name: 'Development' }));

    expect(onSetStream).toHaveBeenCalledExactlyOnceWith('development');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});
