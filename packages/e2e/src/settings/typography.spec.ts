import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { CommitGraphHarness } from '../harnesses/CommitGraph.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { answerReview } from '../review/answerReview.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

import { turnOnSaving } from './turnOnSaving.js';

// The typography of Settings › Display (`TypographyBlock.vue`): the Reading role sets comments and review threads, the
// Code role the diff and the interface's monospace text, the shell setting the chosen values on `<html>` outside the
// phone layout (`layouts/shell.vue`).

/** In My work: assigned to the viewer. */
const ASSIGNED_ISSUE = 'Crash on start';
const REVIEW_ADDRESS = `/${SAMPLE_REPOSITORY}/pull/4/files`;
const COMMENTS_ADDRESS = `/${SAMPLE_REPOSITORY}/pull/4`;
const COMMENT = 'Reproduced it on a cold start.';
const THREAD_COMMENT = 'Why three and not five?';
const CHANGED_LINE = 'const retries = 3;';
const COMMIT = 'Initial commit';
const COMMIT_OID = 'c0ffee1234567890c0ffee1234567890c0ffee12';
/** A face of the fonts the tests choose, by the file names `@fontsource` gives them. */
const CHOSEN_FONT_FILE = /monaspace|plex/iu;

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test.use({ viewport: { width: 1440, height: 900 } });

test('with no typography saved, comments and review threads read at 14px on 21px, a diff line is 20px tall in JetBrains Mono', async ({
    page,
    github,
}) => {
    await openTypographyWork(page, github);
    const review = await openReview(page);

    expect(await getText(review.conversation.getByText(COMMENT))).toMatchObject({
        fontSize: '14px',
        lineHeight: '21px',
    });
    expect(await getText(review.thread(THREAD_COMMENT).getByText(THREAD_COMMENT))).toMatchObject({
        fontSize: '14px',
        lineHeight: '21px',
    });
    const line = await getText(review.code(CHANGED_LINE).first());
    expect(line.height).toBe(20);
    expect(line.fontFamily).toMatch(/^"JetBrains Mono"/u);
});

test('Spaced in Settings › Display sets comments at 15px and diff lines 22px tall at once, a row title staying 13.5px, is saved to the settings repository and holds after a reload', async ({
    page,
    github,
}) => {
    const shell = await openTypographyWork(page, github);
    const repository = await turnOnSaving(page, github, { exists: false, file: null });
    const review = await openReview(page);
    const comment = review.conversation.getByText(COMMENT);
    const line = review.code(CHANGED_LINE).first();

    await chooseInDisplay(page, settings => settings.preset('Spaced').click());
    await page.goBack();

    await expect(line).toBeVisible();
    expect(await getText(comment)).toMatchObject({ fontSize: '15px', lineHeight: '24.75px' });
    expect((await getText(line)).height).toBe(22);
    await expect
        .poll((): unknown => repository.file && JSON.parse(repository.file.text))
        .toMatchObject({ typography: { preset: 'spaced' } });

    await test.step('a list row keeps its interface size', async () => {
        await shell.sidebar.getByRole('link', { name: 'My work', exact: true }).click();
        const title = new MyWorkScreenHarness(page).row(ASSIGNED_ISSUE).getByText(ASSIGNED_ISSUE, { exact: true });
        expect((await getText(title)).fontSize).toBe('13.5px');
    });

    await test.step('after a reload', async () => {
        await page.goto(REVIEW_ADDRESS);
        await expect(line).toBeVisible();
        await expect(review.conversation).toBeVisible();
        expect((await getText(comment)).fontSize).toBe('15px');
        expect((await getText(line)).height).toBe(22);
    });
});

test('Monaspace Neon for Code and IBM Plex Sans for Reading set the diff, a commit sha in the graph and a comment, none of their files fetched before they are chosen', async ({
    page,
    github,
}) => {
    const fetched: string[] = [];
    page.on('request', request => {
        if (CHOSEN_FONT_FILE.test(request.url())) {
            fetched.push(request.url());
        }
    });
    await openTypographyWork(page, github);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    const sha = graph.row(COMMIT).getByText(COMMIT_OID.slice(0, 7), { exact: true });
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    expect((await getText(sha)).fontFamily).toMatch(/^"JetBrains Mono"/u);
    const review = await openReview(page);
    const comment = review.conversation.getByText(COMMENT);
    const line = review.code(CHANGED_LINE).first();
    expect((await getText(comment)).fontFamily).toMatch(/^Inter/u);
    expect((await getText(line)).fontFamily).toMatch(/^"JetBrains Mono"/u);
    expect(fetched).toEqual([]);

    await chooseInDisplay(page, async settings => {
        await settings.font('Code', 'JetBrains Mono').click();
        await page.getByRole('menuitemradio', { name: 'Monaspace Neon', exact: true }).click();
        await settings.font('Reading', 'Inter').click();
        await page.getByRole('menuitemradio', { name: 'IBM Plex Sans', exact: true }).click();
        await expect(settings.font('Reading', 'IBM Plex Sans')).toBeVisible();
    });
    await page.goBack();

    await expect(line).toBeVisible();
    expect((await getText(line)).fontFamily).toMatch(/^"Monaspace Neon"/u);
    expect((await getText(comment)).fontFamily).toMatch(/^"IBM Plex Sans"/u);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    expect((await getText(sha)).fontFamily).toMatch(/^"Monaspace Neon"/u);
});

test('in the phone layout Display offers no typography and a comment keeps the phone size with Spaced saved', async ({
    page,
    github,
}) => {
    await openTypographyWork(page, github);
    await page.goto('/settings?tab=display');
    const settings = new SettingsScreenHarness(page);
    const typography = page.getByRole('region', { name: 'Typography' });
    await expect(typography).toBeVisible();
    await settings.preset('Spaced').click();
    await expect(settings.preset('Spaced')).toHaveAttribute('aria-pressed', 'true');

    await page.setViewportSize(PHONE);
    await expect(page.getByRole('heading', { name: 'Display', level: 1 })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Animations' })).toBeVisible();
    await expect(typography).toHaveCount(0);

    await page.goto(COMMENTS_ADDRESS);
    const item = new ItemViewHarness(page);
    expect((await getText(item.entry(COMMENT).getByText(COMMENT))).fontSize).toBe('13.5px');
});

/**
 * Signs in on the sample's tracked work with a comment and a review thread on its pull request "Fix the crash on
 * start", one changed line in its diff, and one commit in its repository's history.
 */
async function openTypographyWork(page: Page, github: GitHubMock) {
    const { world, fixPullRequest } = createSampleTrackedWork();
    world.comment(fixPullRequest, { author: 'hubot', body: COMMENT, minutesAgo: 60 });
    world.history(SAMPLE_REPOSITORY, {
        commits: [{ oid: COMMIT_OID, headline: COMMIT, author: 'monalisa', minutesAgo: 120 }],
        branches: { main: COMMIT_OID },
    });
    const shell = await openTrackedWork(page, github, world);
    answerReview(github, {
        repository: SAMPLE_REPOSITORY,
        number: 4,
        id: fixPullRequest,
        files: [{ path: 'src/start.ts', before: 'const retries = 1;\n', after: `${CHANGED_LINE}\n` }],
        threads: [{ id: 'T_retries', path: 'src/start.ts', line: 1, comments: [`<p>${THREAD_COMMENT}</p>`] }],
    });
    return shell;
}

/** Opens the pull request's review with its conversation beside the diff: its comment, its thread and its diff at once. */
async function openReview(page: Page) {
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.code(CHANGED_LINE).first()).toBeVisible();
    if (!(await review.conversation.isVisible())) {
        await review.conversationToggle.click();
    }
    await expect(review.conversation.getByText(COMMENT)).toBeVisible();
    await expect(review.thread(THREAD_COMMENT)).toBeVisible();
    return review;
}

/** Opens Settings › Display by `,` from the screen shown, and does `act` there: the screen stays one Back away. */
async function chooseInDisplay(page: Page, act: (settings: SettingsScreenHarness) => Promise<void>) {
    await page.keyboard.press(',');
    const settings = new SettingsScreenHarness(page);
    await settings.section('Display').click();
    await expect(page).toHaveURL('/settings?tab=display');
    await act(settings);
}

/** The text's computed font and line, and its box's height in whole pixels. */
async function getText(text: Locator) {
    await expect(text).toBeVisible();
    return await text.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            height: Math.round(element.getBoundingClientRect().height),
        };
    });
}
