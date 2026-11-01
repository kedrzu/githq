import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AccountScreenHarness } from '../harnesses/AccountScreen.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import type { MyWorkGroupName } from '../harnesses/MyWorkScreen.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { TrackingScreenHarness } from '../harnesses/TrackingScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT_PATH, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// The sample "my work" (`createSampleMyWork`): the issues acme/web#12 and #9, the pull requests acme/web#15 and #17,
// acme/api#52 and #48; acme/web and acme/api are not tracked.
const ISSUE = 'Sign-in loops after the token expires';
const PULL_REQUEST = 'Redirect once after sign-in';
const OTHER_PULL_REQUEST = 'Add rate limit headers to the API';

/** Where the app remembers the arrangement items open in (`LocalPreferences`). */
const ITEM_ARRANGEMENT_KEY = 'githq.itemArrangement';

test("GitHub's dashboard lists open my work narrowed to their group, and an item's GitHub addresses open its page and settle on its own", async ({
    page,
    github,
}) => {
    await openMyWork(page, github, createSampleMyWork().world);
    const myWork = new MyWorkScreenHarness(page);
    const item = new ItemViewHarness(page);

    const lists: readonly (readonly [string, MyWorkGroupName])[] = [
        ['/pulls/review-requested', 'Review requested'],
        ['/pulls', 'My pull requests'],
        ['/issues/assigned', 'Assigned to me'],
        ['/issues/mentioned', 'Mentioned'],
        // The mentioned group holds pull requests too.
        ['/pulls/mentioned', 'Mentioned'],
    ];
    for (const [address, group] of lists) {
        await page.goto(address);
        await expect(myWork.groups).toHaveCount(1);
        await expect(myWork.group(group)).toBeVisible();
        await expect(page).toHaveURL(address);
    }

    await page.goto('/');
    await expect(myWork.groups).toHaveCount(4);
    await expect(page).toHaveURL('/');

    // [visited, where the address settles, the item's title]
    const items: readonly (readonly [string, string, string])[] = [
        ['/acme/web/issues/12', '/acme/web/issues/12', ISSUE],
        ['/acme/web/pull/15', '/acme/web/pull/15', PULL_REQUEST],
        // A pull request's tabs and anything deeper under an item, query and fragment kept.
        ['/acme/web/pull/15/files?x=1#c', '/acme/web/pull/15?x=1#c', PULL_REQUEST],
        ['/acme/web/pull/15/commits', '/acme/web/pull/15', PULL_REQUEST],
        ['/acme/web/issues/12/anything/deeper', '/acme/web/issues/12', ISSUE],
        // The issue address of a pull request, and the pull-request address of an issue, as GitHub redirects them.
        ['/acme/api/issues/52?x=1#c', '/acme/api/pull/52?x=1#c', OTHER_PULL_REQUEST],
        ['/acme/web/pull/12', '/acme/web/issues/12', ISSUE],
        ['/acme/web/issues/15/checks', '/acme/web/pull/15', PULL_REQUEST],
    ];
    for (const [address, settled, title] of items) {
        await page.goto(address);
        await expect(item.title).toHaveText(title);
        await expect(myWork.groups).toHaveCount(0);
        await expect(page).toHaveURL(settled);
    }

    // An untracked repository's lists, and an old githq address shaped like a repository, which is one on GitHub.
    const repository = new RepositoryScreenHarness(page);
    await page.goto('/acme/web/pulls');
    await expect(repository.notTracked('acme/web')).toBeVisible();
    await expect(repository.kind('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.rows('Concerns you')).toHaveText([/Redirect once after sign-in/, /Move the sidebar/]);
    await expect(page).toHaveURL('/acme/web/pulls');

    await page.goto('/acme/web/issues');
    await expect(repository.kind('Issues')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.rows('Concerns you')).toHaveText([/Sign-in loops/, /Document the keyboard shortcuts/]);
    await expect(page).toHaveURL('/acme/web/issues');

    await page.goto('/my/assigned');
    await expect(repository.notTracked('my/assigned')).toBeVisible();
    await expect(page).toHaveURL('/my/assigned');
});

test("a tracked repository and its lists, a project and its saved view, the account and tracking open at GitHub's addresses", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const repository = new RepositoryScreenHarness(page);

    await page.goto(`/${SAMPLE_REPOSITORY}`);
    await expect(repository.kind('All')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.row('Fix the crash on start')).toBeVisible();
    await expect(repository.row('Add a dark theme')).toBeVisible();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}`);

    await page.goto(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.kind('Issues')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.row('Add a dark theme')).toBeVisible();
    await expect(repository.row('Fix the crash on start')).toHaveCount(0);
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);

    await page.goto(`/${SAMPLE_REPOSITORY}/pulls`);
    await expect(repository.kind('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(repository.row('Fix the crash on start')).toBeVisible();
    await expect(repository.row('Add a dark theme')).toHaveCount(0);
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);

    const project = new ProjectScreenHarness(page);
    await page.goto(SAMPLE_PROJECT_PATH);
    await expect(project.currentTab).toHaveText(/Backlog/);
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);

    await page.goto(`${SAMPLE_PROJECT_PATH}/views/2`);
    await expect(project.currentTab).toHaveText(/Board/);
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/views/2`);

    await page.goto('/settings');
    await expect(new AccountScreenHarness(page).heading).toBeVisible();
    await expect(page).toHaveURL('/settings');

    await page.goto('/settings/tracking');
    await expect(new TrackingScreenHarness(page).tracked(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(page).toHaveURL('/settings/tracking');

    // Signed in, sign-in goes on to the work.
    await page.goto('/login');
    await expect(new MyWorkScreenHarness(page).groups.first()).toBeVisible();
    await expect(page).toHaveURL('/');
});

test("an item in GitHub's project-pane format opens over the list in the arrangement remembered, and opening one from a list writes that format", async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const item = new ItemViewHarness(page);

    // In the panel by default.
    await page.goto('/?pane=issue&issue=acme%7Cweb%7C12');
    await expect(item.title).toHaveText(ISSUE);
    await expect(item.modal).toBeHidden();
    await expect(myWork.selectedRow).toContainText(ISSUE);
    await expect(page).toHaveURL('/?pane=issue&issue=acme%7Cweb%7C12');

    // In the modal when that is the arrangement this browser remembers.
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [ITEM_ARRANGEMENT_KEY, 'modal'] as const);
    await page.goto('/pulls?pane=issue&issue=acme%7Capi%7C48');
    await expect(item.modal).toHaveAccessibleName('Cache search results');
    await expect(page).toHaveURL('/pulls?pane=issue&issue=acme%7Capi%7C48');

    // Opened from a repository's list, the address says so in the same format, the list's own query kept.
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [ITEM_ARRANGEMENT_KEY, 'panel'] as const);
    const repository = new RepositoryScreenHarness(page);
    await page.goto('/acme/web?x=1');
    await repository.row(PULL_REQUEST).click();
    await expect(item.title).toHaveText(PULL_REQUEST);
    await expect(item.modal).toBeHidden();
    await expect(page).toHaveURL('/acme/web?x=1&pane=issue&issue=acme%7Cweb%7C15');
});

test('switching the kind of a repository with an item opened changes its address, keeping the query, the item and the view options', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const repository = new RepositoryScreenHarness(page);
    const item = new ItemViewHarness(page);
    const pane = `pane=issue&issue=${SAMPLE_REPOSITORY.replace('/', '%7C')}%7C4`;
    // Wide enough that the layout toggle stays on the toolbar beside the item's panel, not in Display.
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(`/${SAMPLE_REPOSITORY}?${pane}`);
    await expect(item.title).toHaveText('Fix the crash on start');
    await expect(repository.selectedRow).toContainText('Fix the crash on start');
    await repository.layout('Board').click();
    await expect(repository.layout('Board')).toHaveAttribute('aria-pressed', 'true');

    await repository.kind('Pull requests').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls?${pane}`);
    await expect(repository.row('Add a dark theme')).toHaveCount(0);
    await expect(item.title).toHaveText('Fix the crash on start');
    await expect(repository.selectedRow).toContainText('Fix the crash on start');
    await expect(repository.layout('Board')).toHaveAttribute('aria-pressed', 'true');

    await repository.kind('All').click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}?${pane}`);
    await expect(repository.row('Add a dark theme')).toBeVisible();
    await expect(repository.selectedRow).toContainText('Fix the crash on start');
});

test('signing in for the first time from a link with GitHub\'s "return_to" chooses what to track, then returns there', async ({
    page,
    github,
}) => {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });

    // GitHub's sign-in links carry the whole github.com address: its path is the same here.
    await page.goto(`/login?return_to=${encodeURIComponent('https://github.com/pulls')}`);
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    await expect(page).toHaveURL('/settings/tracking/new?next=/pulls');
    await new FirstSignInHarness(page).continueButton.click();

    await expect(page).toHaveURL('/pulls');
    await expect(new MyWorkScreenHarness(page).group('My pull requests')).toBeVisible();
});

test('an address githq does not show leaves for the same address on github.com, query and fragment kept', async ({
    page,
    github,
}) => {
    // Signed out: nothing of the user's is shown, and the app asks GitHub for nothing on the way.
    const addresses = [
        '/acme?tab=repositories#top',
        '/orgs/acme',
        '/acme/web/tree/main/src?plain=1#L3',
        '/acme/web/actions',
        '/notifications?query=mentioned',
        '/issues/created',
        '/settings/profile',
        // githq's old addresses are GitHub's like any other.
        '/account',
        '/sign-in',
        '/welcome',
        '/tracking',
    ];
    for (const address of addresses) {
        const target = answerGitHubPage(github, address);
        await page.goto(address);
        expect((await target).href).toBe(new URL(address.replace(/#.*$/u, ''), 'https://github.com').href);
        await expect(page).toHaveURL(`https://github.com${address}`);
        await expect(page.locator('body')).toHaveText(`github.com${new URL(address, 'https://github.com').pathname}`);
    }

    // Back does not land on the githq address again: it was replaced.
    await page.goto('/');
    await expect(new LandingHarness(page).signInButton).toBeVisible();
    const target = answerGitHubPage(github, '/acme');
    await page.evaluate(() => {
        window.location.href = '/acme';
    });
    await target;
    await expect(page).toHaveURL('https://github.com/acme');
    await page.goBack();
    await expect(page).toHaveURL('/');
});

/**
 * Answers the github.com page at `address`'s path with a page naming it; resolves with the address it was asked
 * for.
 */
function answerGitHubPage(github: GitHubMock, address: string) {
    const { pathname } = new URL(address, 'https://github.com');
    return new Promise<URL>(resolve => {
        github.web(pathname, url => {
            resolve(url);
            return { status: 200, headers: { 'content-type': 'text/html' }, body: `github.com${pathname}` };
        });
    });
}
