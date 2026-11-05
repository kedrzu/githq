import { SAMPLE_TOKEN } from '../github/sampleViewer.js';
import { WorkflowRunScreenHarness } from '../harnesses/WorkflowRunScreen.harness.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

import { expect, test } from './desktopFixtures.js';
import { signInOnDesktop } from './desktopSession.js';
import type { SignInOnDesktopParams } from './desktopSession.js';

const BUILD = {
    name: 'build',
    conclusion: 'failure',
    steps: [{ name: 'Run bun run build', conclusion: 'failure' }],
};

test('a job’s log is read through the native side, with the token, and never by the window', async ({
    page,
    github,
    native,
}) => {
    const { path, jobId } = await openFailedRun({ page, github, native });
    native.jobLogs.set(jobId, {
        status: 200,
        headers: {},
        text: '2026-11-02T11:46:02.0000000Z building the bundle\n',
    });

    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.logLines.filter({ hasText: 'building the bundle' })).toBeVisible();
    const [owner, name] = SAMPLE_REPOSITORY.split('/');
    expect(native.jobLogRequests).toEqual([{ owner, name, jobId, token: SAMPLE_TOKEN }]);
    expect(github.restCalls.filter(call => call.url.pathname.endsWith('/logs'))).toEqual([]);
});

test('a log too big for the native side is told as on the web: not GitHub’s doing, and nothing to try again', async ({
    page,
    github,
    native,
}) => {
    const { path, jobId } = await openFailedRun({ page, github, native });
    native.jobLogFailures.set(jobId, 'tooLarge');
    await page.goto(path);

    const screen = new WorkflowRunScreenHarness(page);
    await expect(screen.message('The log of build is too big to open here')).toBeVisible();
    await expect(screen.root).not.toContainText("didn't answer");
    await expect(screen.root.getByRole('button', { name: /Try again/u })).toHaveCount(0);
    const reads = native.jobLogRequests.length;
    await page.keyboard.press('Enter');
    await expect(screen.message('The log of build is too big to open here')).toBeVisible();
    expect(native.jobLogRequests).toHaveLength(reads);
});

/** Signs in on the desktop, tracking a repository with a failed run of `Deploy`: where its page is, and its one job. */
async function openFailedRun(session: Omit<SignInOnDesktopParams, 'world' | 'track'>) {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'Deploy', runs: [] });
    const runId = world.workflowRun(SAMPLE_REPOSITORY, 'Deploy', { conclusion: 'failure', minutesAgo: 30 });
    const [jobId = 0] = world.runJobs(SAMPLE_REPOSITORY, runId, [BUILD]);
    await signInOnDesktop({ ...session, world, track: true });
    return { path: `/${SAMPLE_REPOSITORY}/actions/runs/${runId}`, jobId };
}
