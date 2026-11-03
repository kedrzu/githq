import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './WorkflowRunView.stories.js';

const {
    Failed,
    InvalidFile,
    JobCancelled,
    JobSkipped,
    JobsFailed,
    JobsLoading,
    LogFailed,
    LogGone,
    LogLoading,
    LogNoAnswer,
    NoJobYet,
    NothingKnown,
    OtherJob,
    Passed,
    RunFailed,
    RunGone,
    Running,
    SecondAttempt,
} = composeStories(stories);

const jobs = () => page.getByTestId('workflow-job').elements();
const jobNames = () => jobs().map(job => job.querySelector('span')?.textContent);
const selectedJob = () => jobs().find(job => job.getAttribute('aria-current') === 'true');
const steps = () => page.getByTestId('workflow-step').elements();
/** Part of a text, with any space where it has one: the translations keep short words with the next one. */
const matchPart = (text: string) => new RegExp(matchText(text).source.slice(1, -1));

test('W4a: failed jobs first, the failed job selected with its steps, its failed step marked; the rest in GitHub’s order', async () => {
    await Failed.run();

    await expect.element(page.getByRole('heading', { name: 'Deploy #4821', level: 1 })).toBeVisible();
    expect(jobNames()).toEqual(['build', 'lint', 'deploy', 'typecheck']);
    expect(selectedJob()?.textContent).toContain('build');
    await expect.element(page.getByText(matchText('1 failed · 1 skipped · 2 passed'))).toBeVisible();
    expect(steps().map(step => [step.textContent?.includes('Run bun run build'), step.dataset.mark])).toContainEqual([
        true,
        'failed',
    ]);
    await expect.element(page.getByText('Failed step:')).toBeInTheDocument();
});

test('W4a: the summary says what the run is, at once', async () => {
    await Failed.run();

    const summary = page.getByTestId('workflow-run-summary');
    await expect.element(summary).toHaveTextContent('Failed');
    await expect.element(summary).toHaveTextContent('main');
    await expect.element(summary).toHaveTextContent('push');
    await expect.element(summary).toHaveTextContent('4f1c9e2');
    await expect.element(summary).toHaveTextContent('Move design tokens into the ui package');
    await expect.element(summary).toHaveTextContent(/14m ago · took 3m 12s/u);
});

test('W4j: past the first attempt the summary says which', async () => {
    await SecondAttempt.run();
    // With the event, as the pen draws it, not at the end of the row.
    await expect.element(page.getByTestId('workflow-run-summary')).toHaveTextContent(/push · attempt 2\s*4f1c9e2/u);

    await Failed.run();
    await expect.element(page.getByTestId('workflow-run-summary')).not.toHaveTextContent('attempt');
});

test('the log’s lines show as text, never as markup', async () => {
    await Failed.run();

    await expect.element(page.getByText('<b>building</b> the bundle')).toBeVisible();
    expect(page.getByTestId('workflow-job-log').element().querySelector('b')).toBeNull();
});

test('⌥J/⌥K move between the jobs, stopping at the ends; a click selects', async () => {
    const selectJob = vi.fn();
    await Failed.run({ args: { ...Failed.args, onSelectJob: selectJob } });

    await userEvent.keyboard('{Alt>}k{/Alt}');
    expect(selectJob).not.toHaveBeenCalled();
    await userEvent.keyboard('{Alt>}j{/Alt}');
    expect(selectJob.mock.lastCall?.[0]).toMatchObject({ name: 'lint' });

    await userEvent.click(page.getByRole('button', { name: /typecheck/u }));
    expect(selectJob.mock.lastCall?.[0]).toMatchObject({ name: 'typecheck' });
});

test('the job the address names shows its steps, the others none', async () => {
    await OtherJob.run();

    expect(selectedJob()?.textContent).toContain('typecheck');
    expect(steps().map(step => step.textContent)).toEqual([expect.stringContaining('Set up job')]);
});

test('W4e: the jobs and the log load in place, and Esc and O work meanwhile', async () => {
    const close = vi.fn();
    const openOnGitHub = vi.fn();
    await JobsLoading.run({ args: { ...JobsLoading.args, onClose: close, onOpenOnGitHub: openOnGitHub } });

    await expect.element(page.getByTestId('workflow-run-summary')).toHaveTextContent('4f1c9e2');
    await expect.element(page.getByTestId('workflow-jobs-placeholder')).toBeInTheDocument();
    await expect.element(page.getByTestId('workflow-log-placeholder')).toBeInTheDocument();
    await expect.element(page.getByTestId('workflow-log-size')).toHaveTextContent('Reading…');
    await userEvent.keyboard('o');
    expect(openOnGitHub).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledTimes(1);

    await LogLoading.run();
    expect(jobNames()).toContain('build');
    await expect.element(page.getByTestId('workflow-log-placeholder')).toBeInTheDocument();
});

test('with nothing known of the run, the page still stands, naming it by its id', async () => {
    await NothingKnown.run();

    await expect.element(page.getByRole('heading', { name: 'Run 4821', level: 1 })).toBeVisible();
    await expect.element(page.getByTestId('workflow-jobs-placeholder')).toBeInTheDocument();
});

test('W4f: an invalid workflow file is a page of its own, the way on is GitHub', async () => {
    const openOnGitHub = vi.fn();
    await InvalidFile.run({ args: { ...InvalidFile.args, onOpenOnGitHub: openOnGitHub } });

    await expect.element(page.getByRole('heading', { name: 'Failed before the first job' })).toBeVisible();
    await expect
        .element(page.getByText(matchPart('.github/workflows/deploy.yml, so the run never got a runner')))
        .toBeVisible();
    await expect.element(page.getByText('deploy.yml · invalid workflow file')).toBeVisible();
    expect(jobs()).toEqual([]);
    await userEvent.click(page.getByRole('button', { name: /See the error on GitHub/u }));
    expect(openOnGitHub).toHaveBeenCalledTimes(1);
});

test('W4g: a log past retention says so, naming the failed step, with the jobs and steps still there', async () => {
    await LogGone.run();

    await expect.element(page.getByRole('heading', { name: 'This log was garbage-collected' })).toBeVisible();
    await expect.element(page.getByText(matchPart('It failed at Run bun run build.'))).toBeVisible();
    await expect.element(page.getByText(matchPart('this run is 98 days old'))).toBeVisible();
    await expect.element(page.getByText('retention 90d · run age 98d')).toBeVisible();
    expect(jobNames()).toContain('build');
    expect(steps().length).toBeGreaterThan(0);
    await expect.element(page.getByTestId('workflow-log-size')).toHaveTextContent('log deleted');
});

test('W4i: one job’s log failing says GitHub’s real status and stays in the pane; Enter tries again, no letter does', async () => {
    const retry = vi.fn();
    const selectJob = vi.fn();
    await LogFailed.run({ args: { ...LogFailed.args, onRetry: retry, onSelectJob: selectJob } });

    await expect.element(page.getByRole('heading', { name: "The log of build didn't load" })).toBeVisible();
    await expect.element(page.getByText('GET …/jobs/103/logs → 502')).toBeVisible();
    await userEvent.keyboard('r');
    expect(retry).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledTimes(1);
    // The rest of the page goes on.
    await userEvent.keyboard('{Alt>}j{/Alt}');
    expect(selectJob).toHaveBeenCalledTimes(1);
});

test('W4i: after a job is clicked, Enter still tries again rather than pressing the job', async () => {
    const retry = vi.fn();
    await LogFailed.run({ args: { ...LogFailed.args, onRetry: retry } });

    await userEvent.click(page.getByRole('button', { name: /lint/u }));
    await userEvent.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledTimes(1);
});

test('W4i with no answer says that', async () => {
    await LogNoAnswer.run();

    await expect.element(page.getByText('GET …/jobs/103/logs → no answer')).toBeVisible();
});

test('Enter does nothing with nothing to try again', async () => {
    const retry = vi.fn();
    await Failed.run({ args: { ...Failed.args, onRetry: retry } });

    await userEvent.keyboard('{Enter}');
    expect(retry).not.toHaveBeenCalled();
});

test('W4j: a running job says so with the way to GitHub, steps showing their status, and the run’s state follows', async () => {
    await Running.run();

    await expect.element(page.getByRole('heading', { name: 'build is still running' })).toBeVisible();
    await expect.element(page.getByText(/^status: in_progress · 14m 00s$/u)).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Watch on GitHub/u })).toBeVisible();
    await expect.element(page.getByTestId('workflow-log-size')).toHaveTextContent('still running');
    const summary = page.getByTestId('workflow-run-summary');
    await expect.element(summary).toHaveTextContent('Running');
    await expect.element(summary).toHaveTextContent(/started 14m ago · Deploy is still broken/u);
    expect(steps().map(step => step.dataset.mark)).toEqual(['passed', 'running']);
    expect(jobNames()).toEqual(['build', 'deploy', 'lint']);
    // Waiting, as the head counts it, whatever GitHub's status for that is.
    const deploy = jobs().find(job => job.textContent?.includes('deploy'));
    expect(deploy?.textContent).toContain('waiting');
    expect(deploy?.textContent).not.toContain('queued');
    await expect.element(page.getByText(matchPart('1 running · 1 waiting · 1 passed'))).toBeVisible();
});

test('a passed run works too: its first job selected, its log there, no error', async () => {
    await Passed.run();

    expect(selectedJob()?.textContent).toContain('lint');
    await expect.element(page.getByTestId('workflow-run-summary')).toHaveTextContent('Passed');
    await expect.element(page.getByText('All good')).toBeVisible();
});

test('a skipped job says it never ran, not that its log is gone', async () => {
    await JobSkipped.run();

    await expect.element(page.getByRole('heading', { name: 'deploy never ran' })).toBeVisible();
    await expect.element(page.getByText('conclusion: skipped')).toBeVisible();
    await expect.element(page.getByTestId('workflow-log-size')).toHaveTextContent('skipped');
});

test('a job cancelled before starting says it never ran, with its real conclusion, and no way to mistake it for a log gone', async () => {
    await JobCancelled.run();

    await expect.element(page.getByRole('heading', { name: 'test (macos) never ran' })).toBeVisible();
    await expect.element(page.getByText('conclusion: cancelled')).toBeVisible();
    await expect.element(page.getByTestId('workflow-log-size')).toHaveTextContent('cancelled');
    await expect.element(page.getByRole('heading', { name: 'This log was garbage-collected' })).not.toBeInTheDocument();
});

test('a run GitHub won’t show says so, with a way to GitHub', async () => {
    const openOnGitHub = vi.fn();
    await RunGone.run({ args: { ...RunGone.args, onOpenOnGitHub: openOnGitHub } });

    await expect.element(page.getByRole('heading', { name: 'GitHub shows no such run' })).toBeVisible();
    await userEvent.keyboard('o');
    expect(openOnGitHub).toHaveBeenCalledTimes(1);
});

test('a read of the run or its jobs that failed says GitHub’s status; Enter asks again', async () => {
    const retry = vi.fn();
    await RunFailed.run({ args: { ...RunFailed.args, onRetry: retry } });
    await expect.element(page.getByText('GET …/runs/4821 → 500')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledTimes(1);

    await JobsFailed.run();
    await expect.element(page.getByRole('heading', { name: "This run's jobs didn't load" })).toBeVisible();
    await expect.element(page.getByText('GET …/runs/4821/jobs → 503')).toBeVisible();
});

test('a run not started yet says it waits for a runner', async () => {
    await NoJobYet.run();

    await expect.element(page.getByRole('heading', { name: 'No job has started yet' })).toBeVisible();
});

test('the toolbar’s GitHub link opens the selected job in a new tab, the run with no job selected', async () => {
    await Failed.run();

    const link = page.getByRole('link', { name: 'Open on GitHub' }).element();
    expect(link.getAttribute('href')).toBe('https://github.com/fitloop/webapp/actions/runs/4821/job/103');
    expect(link.getAttribute('target')).toBe('_blank');

    await OtherJob.run();
    expect(page.getByRole('link', { name: 'Open on GitHub' }).element().getAttribute('href')).toBe(
        'https://github.com/fitloop/webapp/actions/runs/4821/job/104',
    );

    await InvalidFile.run();
    expect(page.getByRole('link', { name: 'Open on GitHub' }).element().getAttribute('href')).toBe(
        'https://github.com/fitloop/webapp/actions/runs/4821',
    );
});
