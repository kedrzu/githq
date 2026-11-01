import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { NewIssueHarness } from '../harnesses/NewIssue.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';

const BUG_FORM = [
    'name: Bug report',
    'description: Report a bug',
    'labels: [bug]',
    'body:',
    '  - type: textarea',
    '    id: what',
    '    attributes:',
    '      label: What happened',
    '    validations:',
    '      required: true',
].join('\n');

test('C from my work, the repository chosen, ⌥A and Enter: the issue shows at once in my work as #…, then with GitHub’s number', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    const capture = new NewIssueHarness(page);

    await capture.open();
    // Nothing used yet: the repository comes first, those of my work offered.
    await capture.chooseRepository('web', 'acme/web');
    await capture.title.fill('Remember the last tab');
    await page.keyboard.press('Alt+a');
    await expect(capture.root.getByRole('button', { name: 'Assigned to me' })).toHaveAttribute('aria-pressed', 'true');

    const release = sample.world.holdEdits();
    await capture.title.press('Enter');
    await expect(capture.root).toBeHidden();
    const row = myWork.row('Remember the last tab');
    await expect(row).toContainText('acme/web#…');
    await expect(shell.statusBar).toContainText('Sending 1 change');

    release();
    await expect(row).toContainText('acme/web#22');
    await expect(shell.failedEdits).toHaveCount(0);
    expect(sample.world.findIssue('acme/web', 'Remember the last tab')).toMatchObject({
        number: 22,
        assignees: [sample.world.viewer],
    });
});

test('⌘Enter creates another in the same repository; the next C starts in the repository used last', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    await openMyWork(page, github, sample.world);
    const capture = new NewIssueHarness(page);

    await capture.open();
    await capture.chooseRepository('web', 'acme/web');
    await capture.title.fill('First of two');
    await capture.title.press('ControlOrMeta+Enter');
    await expect(capture.title).toHaveValue('');
    await expect(capture.title).toBeFocused();
    await capture.title.fill('Second of two');
    await capture.title.press('Enter');
    await expect(capture.root).toBeHidden();

    await expect.poll(() => sample.world.findIssue('acme/web', 'Second of two')?.number).toBe(23);
    expect(sample.world.findIssue('acme/web', 'First of two')?.number).toBe(22);

    await capture.open();
    await expect(capture.repository).toHaveAccessibleName('Repository: acme/web. Choose another');
    await expect(capture.title).toBeFocused();
});

test('a creation GitHub refuses opens the capture again with the title and body kept, and the reason (H9)', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.failCreate('acme/web', { kind: 'refuse', message: 'Issues are locked for maintenance' });
    await openMyWork(page, github, sample.world);
    const capture = new NewIssueHarness(page);

    await capture.open();
    await capture.chooseRepository('web', 'acme/web');
    await capture.title.fill('Do not lose me');
    await capture.title.press('Tab');
    await capture.body.fill('Three paragraphs of careful thought.');
    await capture.body.press('ControlOrMeta+Enter');

    await expect(capture.rejection).toContainText("GitHub didn't create this issue");
    await expect(capture.rejection).toContainText('GitHub said: Issues are locked for maintenance.');
    await expect(capture.title).toHaveValue('Do not lose me');
    await expect(capture.body).toHaveValue('Three paragraphs of careful thought.');
    // The toast too, under the capture (out of the modal's reach, so found by its text).
    await expect(page.getByText("Issue “Do not lose me” wasn't created in acme/web").first()).toBeVisible();
    expect(sample.world.findIssue('acme/web', 'Do not lose me')).toBeUndefined();
});

test('a repository that won’t take an issue says so before anything is typed', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    sample.world.repository('acme/legacy', { isArchived: true });
    await openMyWork(page, github, sample.world);
    await page.goto('/acme/legacy');
    const capture = new NewIssueHarness(page);

    await capture.open();
    await expect(capture.repository).toHaveAccessibleName('Repository: acme/legacy. Choose another');
    await expect(capture.root).toContainText("acme/legacy won't take a new issue");
    await expect(capture.root).toContainText('Archived repositories are read-only.');
    await expect(capture.root.getByRole('button', { name: /^Create/u }).first()).toBeDisabled();
});

test('an issue form where the user can’t push continues on GitHub’s own form, with the title in it (D14)', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.repository('vitejs/vite', {
        viewerPermission: 'READ',
        templates: { blankIssuesEnabled: false, forms: { 'bug_report.yml': BUG_FORM } },
    });
    github.web('/vitejs/vite/issues/new', () => ({ status: 200, body: '<title>New issue</title>' }));
    await openMyWork(page, github, sample.world);
    await page.goto('/vitejs/vite');
    const capture = new NewIssueHarness(page);

    await capture.open();
    await expect(capture.templates.getByRole('option', { name: /Bug report\s*form on GitHub/u })).toBeVisible();
    await expect(capture.root).toContainText("You can't push here, so forms continue on github.com");

    const popup = page.waitForEvent('popup');
    await capture.templates.getByRole('option', { name: /Bug report/u }).click();
    const url = new URL((await popup).url());
    expect(url.origin + url.pathname).toBe('https://github.com/vitejs/vite/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    await expect(capture.root).toBeHidden();
    expect(sample.world.edits).toEqual([]);
});

test('"New issue" in a project’s column adds it there with that column’s Status (H5)', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);
    const project = new ProjectScreenHarness(page);
    await project.tab('Board').click();
    const capture = new NewIssueHarness(page);

    await project.group('In Progress').getByRole('button', { name: 'New issue in In Progress' }).click();
    await capture.chooseRepository('app', SAMPLE_REPOSITORY);
    await expect(capture.root.getByRole('button', { name: /^Roadmap · Status: In Progress/u })).toBeVisible();
    await capture.title.fill('Explain the board');
    await capture.title.press('Enter');

    await expect(project.rows('In Progress')).toHaveText([/Remember the sidebar width/, /Explain the board/]);
    await expect
        .poll(() => sample.world.findIssue(SAMPLE_REPOSITORY, 'Explain the board')?.projects)
        .toEqual({ [SAMPLE_PROJECT]: 'In Progress' });
    await expect(shell.failedEdits).toHaveCount(0);
});

test('the capture keeps the keys to itself: on its buttons `j` moves nothing behind it, and Escape closes only the capture', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);
    const capture = new NewIssueHarness(page);
    await myWork.row('Sign-in loops after the token expires').click();
    await expect(item.title).toHaveText('Sign-in loops after the token expires');

    await capture.open();
    await capture.root.getByRole('button', { name: 'Details' }).focus();
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');

    // Behind the capture the screen is hidden from the keys and from assistive technology alike: checked once it closed.
    await expect(capture.root).toBeHidden();
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');
    await expect(item.title).toHaveText('Sign-in loops after the token expires');
    await expect(myWork.selectedRow).toContainText('Sign-in loops after the token expires');
});
