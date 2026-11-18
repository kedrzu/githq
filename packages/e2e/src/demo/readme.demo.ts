import { writeFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';

import { createSampleDemoWork, DEMO_ISSUE, DEMO_PROJECT } from './sampleDemoWork.js';

/** How long GitHub takes to confirm the status change: the screen has changed long before. */
const GITHUB_DELAY_MS = 1500;

/** A person's typing speed, so the viewer can read along. */
const TYPING_DELAY_MS = 90;

// The README's demo: ⌘K finds an issue across every repository, S moves it to "In Progress" while GitHub is still
// answering, ⌘K opens the project's board with the card already moved. No spinner anywhere. Recorded by
// `recordReadmeDemo.ts`, which cuts the video at the second written to `demo-start.txt`.
test('README demo', async ({ page, github }, testInfo) => {
    test.setTimeout(120_000);
    const world = createSampleDemoWork();
    const recordingStarted = Date.now();
    // Registered after the GitHub mock, so it answers the avatars first: initials instead of the mock's 1×1 pixel.
    await page
        .context()
        .route('https://avatars.githubusercontent.com/**', route =>
            route.fulfill({ contentType: 'image/svg+xml', body: avatarOf(new URL(route.request().url()).pathname) }),
        );
    await openTrackedWork(page, github, world);
    await page.mouse.move(-10, -10);
    await page.waitForTimeout(500);
    await writeFile(testInfo.outputPath('demo-start.txt'), String((Date.now() - recordingStarted) / 1000));

    await page.waitForTimeout(1200);
    const menu = new CommandMenuHarness(page);
    await showKeys(page, '⌘ K');
    await menu.open();
    await page.waitForTimeout(400);
    await page.keyboard.type('timezone', { delay: TYPING_DELAY_MS });
    await expect(menu.option(new RegExp(DEMO_ISSUE))).toBeVisible();
    await page.waitForTimeout(500);
    await showKeys(page, '↵');
    await page.keyboard.press('Enter');

    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText(DEMO_ISSUE);
    await page.waitForTimeout(1200);

    const release = world.holdEdits();
    await showKeys(page, 'S');
    await page.keyboard.press('s');
    await page.waitForTimeout(400);
    await page.keyboard.type('in pr', { delay: TYPING_DELAY_MS });
    await page.waitForTimeout(300);
    await showKeys(page, '↵');
    await page.keyboard.press('Enter');
    await expect(item.projectField('Status')).toHaveAccessibleName('Status: In Progress');
    await page.waitForTimeout(GITHUB_DELAY_MS);
    release();
    await page.waitForTimeout(800);

    await showKeys(page, 'Esc');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await showKeys(page, '⌘ K');
    await menu.open();
    await page.waitForTimeout(300);
    await page.keyboard.type(DEMO_PROJECT, { delay: TYPING_DELAY_MS });
    await page.waitForTimeout(400);
    await showKeys(page, '↵');
    await page.keyboard.press('Enter');

    const board = new ProjectScreenHarness(page);
    await expect(board.row(DEMO_ISSUE)).toBeVisible();
    await expect(board.rows('In Progress').filter({ hasText: DEMO_ISSUE })).toHaveCount(1);
    await page.waitForTimeout(2500);
});

/** An avatar with the user's initials, as githq's designs draw them; the viewer's avatar path names no login. */
function avatarOf(path: string) {
    const login = path.startsWith('/u/') ? SAMPLE_VIEWER.viewer.login : path.slice(1);
    const colors = ['#5b8def', '#8b6fd6', '#d9895b', '#4fa37a', '#c75f8a'];
    let hash = 0;
    for (const char of login) {
        hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
    }

    const color = colors[hash % colors.length];
    const initials = login.slice(0, 2).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><text x="32" y="42" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="600" fill="#fff">${initials}</text></svg>`;
}

/** Shows the keys just pressed in the bottom corner, as a screencast does, so a reader of the GIF sees them. */
async function showKeys(page: Page, keys: string) {
    await page.evaluate(text => {
        const id = 'githq-demo-keys';
        document.querySelector(`#${id}`)?.remove();
        const badge = document.createElement('div');
        badge.id = id;
        badge.textContent = text;
        Object.assign(badge.style, {
            position: 'fixed',
            right: '24px',
            bottom: '40px',
            zIndex: '2147483647',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(124, 131, 255, 0.92)',
            color: '#fff',
            font: '600 20px/1 ui-sans-serif, system-ui, sans-serif',
            letterSpacing: '0.04em',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
            transition: 'opacity 300ms ease-out',
        });
        document.body.append(badge);
        setTimeout(() => {
            badge.style.opacity = '0';
        }, 900);
        setTimeout(() => badge.remove(), 1300);
    }, keys);
}
