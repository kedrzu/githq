import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { WorkflowItemHarness } from '../harnesses/WorkflowItem.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// Running a workflow by hand from ⌘K (actions W36, W37, W39, W46–W48): its form built from the workflow's file at the
// ref entered, the dispatch GitHub receives, the toast naming the run and the run on top of the workflow's runs.

const LIST = `/${SAMPLE_REPOSITORY}/actions`;
/** A second repository of the viewer's, tracked with the sample: one without a workflow to run by hand. */
const DOCS_REPOSITORY = `${SAMPLE_VIEWER.viewer.login}/docs`;

/** The toast of the run Deploy started on main: #2, after its run #1. */
const STARTED_ON_MAIN = /Deploy\sstarted\son\smain\s·\s#2/u;

/** Deploy's file at the default branch: run on push or by hand with three inputs, each with its default. */
const DEPLOY_FILE = [
    'name: Deploy',
    'on:',
    '  push:',
    '  workflow_dispatch:',
    '    inputs:',
    '      environment:',
    '        type: choice',
    '        options: [staging, production]',
    '        default: staging',
    '      version:',
    '        type: string',
    "        default: '2.13.0'",
    '      dry_run:',
    '        type: boolean',
    '        default: false',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: echo deploy',
    '',
].join('\n');

/** Deploy's file on the tag `v1`: an older one, without `dry_run`. */
const DEPLOY_FILE_V1 = DEPLOY_FILE.replace(/ {6}dry_run:\n.*\n.*\n/u, '');

/** A world whose repository has Deploy, run once 30 minutes ago (#1), with {@link DEPLOY_FILE}. */
function createDeployWorld() {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        file: DEPLOY_FILE,
        fileByRef: { v1: DEPLOY_FILE_V1 },
        runs: [{ conclusion: 'success', minutesAgo: 30 }],
    });
    return world;
}

test('W37, W39: "Run workflow · Deploy" on the selected workflow: its form at main, only the inputs changed sent, the toast names the run, Open goes there, the run on top', async ({
    page,
    github,
}) => {
    const world = createDeployWorld();
    await openTrackedWork(page, github, world);
    await page.goto(LIST);
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.workflow('Deploy')).toHaveAttribute('aria-current', 'true');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Run workflow');
    await expect(menu.option(/Run workflow · Deploy/u)).toContainText('main · 3 inputs');
    await expect(menu.option(/Run workflow · Deploy/u).locator('kbd')).toHaveCount(0);
    // W47: the footer says where Enter goes from the highlighted line.
    await expect(menu.root.getByText(/Enter\sopens\sDeploy['’]s\sform/u)).toBeVisible();
    await menu.option(/Run workflow · Deploy/u).click();

    const form = menu.root.getByRole('group', { name: 'Run workflow · Deploy' });
    await expect(form.getByLabel('ref', { exact: true })).toHaveValue('main');
    await expect(form.getByLabel('environment', { exact: true })).toHaveValue('staging');
    await expect(form.getByLabel('version', { exact: true })).toHaveValue('2.13.0');
    await expect(form.getByRole('switch', { name: 'dry_run' })).not.toBeChecked();
    expect(dispatchBodies(github)).toEqual([]);

    await form.getByLabel('environment', { exact: true }).selectOption('production');
    await form.getByLabel('version', { exact: true }).fill('2.14.0');
    await page.keyboard.press('ControlOrMeta+Enter');

    // Run #2: the run GitHub started.
    const shell = new AppShellHarness(page);
    const toast = shell.toasts.filter({ hasText: STARTED_ON_MAIN });
    await expect(toast).toContainText(/environment\sproduction\s·\sversion\s2\.14\.0/u);
    await expect
        .poll(() => dispatchBodies(github))
        .toEqual([{ ref: 'main', inputs: { environment: 'production', version: '2.14.0' }, return_run_details: true }]);

    await page.keyboard.press('Enter');
    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.runRows.first()).toContainText('#2');
    await expect(deploy.runRows).toHaveCount(2);

    await page.keyboard.press('Alt+o');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/actions/runs/2`);
});

test('W46, W48: "Run workflow…" from My work: the repositories with what each can run, from one read of their files; then the workflow and its form', async ({
    page,
    github,
}) => {
    const world = createDeployWorld();
    world.repository(DOCS_REPOSITORY);
    world.workflow({ repository: DOCS_REPOSITORY, name: 'CI', runs: [{ conclusion: 'success', minutesAgo: 10 }] });
    await openTrackedWork(page, github, world);
    // Nothing of the workflow files is read until the command opens.
    expect(workflowFilesReads(github)).toEqual([]);

    const menu = new CommandMenuHarness(page);
    await menu.run('Run workflow');

    await expect(menu.option(SAMPLE_REPOSITORY)).toContainText('1 workflow you can run · Deploy');
    await expect(menu.option(DOCS_REPOSITORY)).toContainText('no workflow with workflow_dispatch');
    await expect(menu.option(DOCS_REPOSITORY)).toContainText(/can['’]t\srun/u);
    await expect(menu.group('Tracked repositories').getByRole('option')).toHaveText([new RegExp(SAMPLE_REPOSITORY)]);
    await expect(menu.group('Nothing to run').getByRole('option')).toHaveText([new RegExp(DOCS_REPOSITORY)]);
    await expect(menu.root.getByRole('textbox', { name: 'Pick a repository…' })).toBeFocused();
    await expect(menu.root.getByText('Run workflow · step 1 of 3')).toBeVisible();
    expect(workflowFilesReads(github).toSorted()).toEqual(
        [SAMPLE_REPOSITORY, DOCS_REPOSITORY].map(name => `${name} HEAD:.github/workflows`).toSorted(),
    );

    await page.keyboard.press('Enter');
    await expect(menu.option(/Deploy/u)).toContainText('main · 3 inputs');
    await expect(menu.group(`Workflows in ${SAMPLE_REPOSITORY} you can run`).getByRole('option')).toHaveText([
        /Deploy/u,
    ]);
    await expect(menu.root.getByRole('textbox', { name: 'Pick a workflow…' })).toBeFocused();
    await expect(menu.root.getByText('Only workflows with workflow_dispatch · 1 of 1')).toBeVisible();
    await page.keyboard.press('Enter');

    const form = menu.root.getByRole('group', { name: 'Deploy' });
    await expect(form.getByLabel('version', { exact: true })).toHaveValue('2.13.0');
    await page.keyboard.press('ControlOrMeta+Enter');

    // #3: CI's run in the other repository is #2.
    await expect(
        new AppShellHarness(page).toasts.filter({ hasText: /Deploy\sstarted\son\smain\s·\s#3/u }),
    ).toBeVisible();
    // Untouched, every input is left to GitHub's defaults.
    expect(dispatchBodies(github)).toEqual([{ ref: 'main', return_run_details: true }]);
});

test('W46: "Run workflow…" from My work marks a repository with read access and an archived one as unable to run, reading none of their files', async ({
    page,
    github,
}) => {
    const world = createDeployWorld();
    world.repository(SAMPLE_REPOSITORY, { viewerPermission: 'READ' });
    world.repository(DOCS_REPOSITORY, { isArchived: true });
    world.workflow({ repository: DOCS_REPOSITORY, name: 'Deploy', file: DEPLOY_FILE, runs: [] });
    await openTrackedWork(page, github, world);

    const menu = new CommandMenuHarness(page);
    await menu.run('Run workflow');

    await expect(menu.option(SAMPLE_REPOSITORY)).toContainText(/you\scan['’]t\srun\sworkflows\shere/u);
    await expect(menu.option(DOCS_REPOSITORY)).toContainText('archived, nothing runs');
    await expect(menu.option(DOCS_REPOSITORY)).toContainText(/can['’]t\srun/u);
    await page.keyboard.press('Enter');
    await expect(menu.option(/Deploy/u)).toHaveCount(0);
    expect(workflowFilesReads(github)).toEqual([]);
});

test('W36: a workflow without workflow_dispatch shows "Run workflow" it can\'t run, saying why', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    world.workflow({ repository: SAMPLE_REPOSITORY, name: 'CLA', runs: [{ conclusion: 'success', minutesAgo: 10 }] });
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/workflows/cla.yml`);
    await expect(new WorkflowItemHarness(page, 'CLA').runRows).toHaveCount(1);

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('Run workflow');
    const command = menu.option(/Run workflow · CLA/u);
    await expect(command).toContainText('CLA has no workflow_dispatch trigger');
    await expect(command).toContainText(/can['’]t\srun/u);
    // W48: the cursor skips it to "Run workflow…", and the footer says Enter picks another workflow there.
    await expect(menu.root.getByText('Enter picks another workflow')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(menu.root.getByRole('group', { name: 'Run workflow · CLA' })).toHaveCount(0);
    expect(dispatchBodies(github)).toEqual([]);
});

test('W39: a dispatch GitHub refuses is a toast in its words, and no run is added', async ({ page, github }) => {
    const world = createDeployWorld();
    world.refuseDispatch(SAMPLE_REPOSITORY, 422, "Workflow does not have 'workflow_dispatch' trigger.");
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/workflows/deploy.yml`);
    const deploy = new WorkflowItemHarness(page, 'Deploy');
    await expect(deploy.runRows).toHaveCount(1);

    await new CommandMenuHarness(page).run('Run workflow · Deploy');
    await expect(page.getByRole('group', { name: 'Run workflow · Deploy' })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Enter');

    const toast = new AppShellHarness(page).toasts.filter({ hasText: /Deploy\swasn['’]t\srun\son\smain/u });
    await expect(toast).toContainText(
        /GitHub\srefused\sit:\sWorkflow does not have 'workflow_dispatch' trigger\.\sNothing/u,
    );
    expect(dispatchBodies(github)).toHaveLength(1);
    await expect(deploy.runRows).toHaveCount(1);
});

test('W37: another ref rebuilds the form from its file, keeping what was entered in the inputs it still has', async ({
    page,
    github,
}) => {
    const world = createDeployWorld();
    await openTrackedWork(page, github, world);
    await page.goto(`/${SAMPLE_REPOSITORY}/actions/workflows/deploy.yml`);
    await expect(new WorkflowItemHarness(page, 'Deploy').runRows).toHaveCount(1);

    await new CommandMenuHarness(page).run('Run workflow · Deploy');
    const form = page.getByRole('group', { name: 'Run workflow · Deploy' });
    await form.getByLabel('version', { exact: true }).fill('2.14.0');
    await expect(form.getByRole('switch', { name: 'dry_run' })).toBeVisible();

    await form.getByLabel('ref', { exact: true }).fill('v1');

    await expect(form.getByRole('switch', { name: 'dry_run' })).toHaveCount(0);
    await expect(form.getByLabel('version', { exact: true })).toHaveValue('2.14.0');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(new AppShellHarness(page).toasts.filter({ hasText: /Deploy\sstarted\son\sv1\s·\s#2/u })).toBeVisible();
    expect(dispatchBodies(github)).toEqual([{ ref: 'v1', inputs: { version: '2.14.0' }, return_run_details: true }]);
});

/** The bodies of the dispatches GitHub received, oldest first. */
function dispatchBodies(github: GitHubMock) {
    return github.restCalls
        .filter(call => call.method === 'POST' && call.url.pathname.endsWith('/dispatches'))
        .map(call => call.body);
}

/** The reads of a repository's workflow files all at once, each `owner/name expression`. */
function workflowFilesReads(github: GitHubMock) {
    return github.graphqlCalls
        .filter(call => call.name === 'RepositoryWorkflowFiles')
        .map(
            call =>
                `${String(call.variables.owner)}/${String(call.variables.name)} ${String(call.variables.expression)}`,
        );
}
