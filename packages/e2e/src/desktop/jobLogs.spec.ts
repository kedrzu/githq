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

test('what the native side answers is told as on the web: a refusal with its status, nothing read with no status, a log past its retention as gone', async ({
    page,
    github,
    native,
}) => {
    const { path, jobId } = await openFailedRun({ page, github, native });
    const screen = new WorkflowRunScreenHarness(page);

    native.jobLogs.set(jobId, { status: 502, headers: {}, text: '' });
    await page.goto(path);
    await expect(screen.message("The log of build didn't load")).toBeVisible();
    await expect(screen.root).toContainText(`GET …/jobs/${jobId}/logs → 502`);

    // Out of reach: the native side fails with a code, and the page has no status to tell.
    native.jobLogs.delete(jobId);
    await page.reload();
    await expect(screen.root).toContainText(`GET …/jobs/${jobId}/logs → no answer`);

    // Past the limit: not GitHub's doing, and nothing to try again.
    native.jobLogFailures.set(jobId, 'tooLarge');
    await page.reload();
    await expect(screen.message('The log of build is too big to open here')).toBeVisible();
    await expect(screen.root).not.toContainText("didn't answer");
    await expect(screen.root.getByRole('button', { name: /Try again/u })).toHaveCount(0);
    const reads = native.jobLogRequests.length;
    await page.keyboard.press('Enter');
    await expect(screen.message('The log of build is too big to open here')).toBeVisible();
    expect(native.jobLogRequests).toHaveLength(reads);

    // Turned down for another reason: the app says it did, and it can be tried again.
    native.jobLogFailures.set(jobId, 'refused');
    await page.reload();
    await expect(screen.root).toContainText('githq refused this log');
    await expect(screen.root.getByRole('button', { name: /Try again/u })).toBeVisible();
    native.jobLogFailures.delete(jobId);

    native.jobLogs.set(jobId, { status: 410, headers: {}, text: '' });
    await page.reload();
    await expect(screen.message('This log was garbage-collected')).toBeVisible();
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
