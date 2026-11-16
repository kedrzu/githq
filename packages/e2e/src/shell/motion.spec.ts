import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { PickerHarness } from '../harnesses/Picker.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { createSampleMergeableWork, FIRST_TITLE } from '../merge/sampleMergeableWork.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT } from '../tracking/sampleTrackedWork.js';

const ISSUE = 'Crash on start';
// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };
// How long a phone's sheet slides (`$motion-sheet`).
const SHEET_MS = 200;

/** One kind of overlay: how it opens, what it is in the page, and how it closes. */
interface Overlay {
    readonly name: string;
    readonly surface: Locator;
    open(): Promise<void>;
    close(): Promise<void>;
}

test('with animations on, every overlay opens with a short animation and closes out of the page at once', async ({
    page,
    github,
}) => {
    const { shell, myWork } = await openOverlayApp(page, github);

    for (const overlay of overlays(page, shell, myWork)) {
        await test.step(overlay.name, async () => {
            await overlay.open();
            const motion = await motionOf(overlay.surface);
            expect(motion.name).not.toBe('none');
            expect(motion.durationMs).toBeGreaterThan(0);
            expect(motion.durationMs).toBeLessThan(200);

            await overlay.close();
            await nextFrame(page);
            expect(await overlay.surface.count()).toBe(0);
        });
    }
});

test('with animations off, no overlay animates and each is out of the page with no wait', async ({ page, github }) => {
    const { shell, myWork } = await openOverlayApp(page, github);
    const settings = await openDisplaySettings(page);
    await settings.animationsSwitch.click();
    await expect(settings.animationsSwitch).not.toBeChecked();
    await shell.myWorkLink('My work').click();
    await expect(myWork.row(ISSUE)).toBeVisible();

    for (const overlay of overlays(page, shell, myWork)) {
        await test.step(overlay.name, async () => {
            await overlay.open();
            expect((await motionOf(overlay.surface)).name).toBe('none');

            await overlay.close();
            await nextFrame(page);
            expect(await overlay.surface.count()).toBe(0);
        });
    }

    // Back to the list from the item the popover was opened on, where a phone has its places button.
    await shell.myWorkLink('My work').click();
    await expect(myWork.row(ISSUE)).toBeVisible();
    await page.setViewportSize(PHONE);
    for (const sheet of phoneSheets(page)) {
        await test.step(`phone: ${sheet.name}`, async () => {
            await sheet.open();
            expect((await motionOf(sheet.surface)).name).toBe('none');

            await sheet.close();
            await nextFrame(page);
            expect(await sheet.surface.count()).toBe(0);

            // Nothing of it stayed behind: it opens again.
            await sheet.open();
            await sheet.close();
        });
    }
});

test('on a phone with animations on, the places panel and the command menu slide in from their edge and back out', async ({
    page,
    github,
}) => {
    await openOverlayApp(page, github);
    await page.setViewportSize(PHONE);

    for (const sheet of phoneSheets(page)) {
        await test.step(sheet.name, async () => {
            await sheet.open();
            expect(await motionOf(sheet.surface)).toEqual({ name: 'motion-sheet-in', durationMs: SHEET_MS });

            const restore = await slowAnimations(page);
            await sheet.close();
            expect(await motionOf(sheet.surface)).toEqual({ name: 'motion-sheet-out', durationMs: SHEET_MS });
            await restore();
            await expect(sheet.surface).toHaveCount(0);

            // Nothing of it stayed behind: it opens again.
            await sheet.open();
            await sheet.close();
            await expect(sheet.surface).toHaveCount(0);
        });
    }
});

test('on a phone, a tap on the places panel while it slides out does nothing', async ({ page, github }) => {
    await openOverlayApp(page, github);
    await page.setViewportSize(PHONE);
    const places = phoneSheets(page)[0]!;
    await places.open();
    // In place, slid in all the way.
    await places.surface.evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished));
    });
    const link = places.surface.getByRole('link').filter({ has: page.getByText('Mentioned', { exact: true }) });
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    const address = page.url();

    const restore = await slowAnimations(page);
    await places.close();
    expect((await motionOf(places.surface)).name).toBe('motion-sheet-out');
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await restore();

    await expect(places.surface).toHaveCount(0);
    expect(page.url()).toBe(address);
});

test('the Animations switch applies without a reload and is still as set after one', async ({ page, github }) => {
    await openOverlayApp(page, github);
    const settings = await openDisplaySettings(page);
    const html = page.locator('html');
    await expect(settings.animationsSwitch).toBeChecked();
    await expect(html).toHaveAttribute('data-motion', 'on');

    await settings.animationsSwitch.click();
    await expect(html).not.toHaveAttribute('data-motion', /.*/u);

    await page.reload();
    await expect(settings.animationsSwitch).not.toBeChecked();
    await expect(html).not.toHaveAttribute('data-motion', /.*/u);

    await settings.animationsSwitch.click();
    await expect(html).toHaveAttribute('data-motion', 'on');
});

test('with reduced motion asked for, an opening overlay does not animate and a Reveal does not run, the switch on', async ({
    page,
    github,
}) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await selectRow(myWork, FIRST_TITLE);
    const panel = new MergePanelHarness(page);
    const reveal = page.getByTestId('commit-message');
    const menu = new CommandMenuHarness(page);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.keyboard.press('Shift+M');
    await expect(reveal).toBeAttached();
    expect((await transitionOf(reveal)).durationMs).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await transitionOf(reveal)).durationMs).toBe(0);

    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await menu.open();
    expect((await motionOf(menu.root)).name).toBe('none');
});

test('keys typed at once after ⌘K reach the field in full, and Escape closes it and gives focus back', async ({
    page,
    github,
}) => {
    const { shell } = await openOverlayApp(page, github);
    const menu = new CommandMenuHarness(page);
    const origin = shell.collapseButton;
    await origin.focus();
    await expect(origin).toBeFocused();

    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('remember the side');
    await expect(menu.field).toHaveValue('remember the side');

    await page.keyboard.press('Escape');
    await nextFrame(page);
    expect(await menu.root.count()).toBe(0);
    expect(await origin.evaluate(element => element === document.activeElement)).toBe(true);
});

/** Signs in with the tracked sample, whose issue's label edit GitHub refuses (a toast), and waits for its row. */
async function openOverlayApp(
    page: Page,
    github: GitHubMock,
): Promise<{ shell: AppShellHarness; myWork: MyWorkScreenHarness }> {
    const sample = createSampleTrackedWork();
    sample.world.failEdit(sample.assignedIssue, 'AddLabels', { kind: 'refuse', message: 'Not allowed' });
    const shell = await openTrackedWork(page, github, sample.world);
    const myWork = new MyWorkScreenHarness(page);
    await expect(myWork.row(ISSUE)).toBeVisible();
    return { shell, myWork };
}

/** Opens Settings' Display section with the keys, each once the screen it is for has arrived. */
async function openDisplaySettings(page: Page): Promise<SettingsScreenHarness> {
    const settings = new SettingsScreenHarness(page);
    await page.keyboard.press(',');
    await expect(settings.heading).toBeVisible();
    await page.keyboard.press('3');
    await expect(settings.section('Display')).toHaveAttribute('aria-pressed', 'true');
    return settings;
}

/** The kinds of overlay of the app's: a tooltip, a menu, a context menu, a dialog, a popover and a toast. */
function overlays(page: Page, shell: AppShellHarness, myWork: MyWorkScreenHarness): Overlay[] {
    const menu = new CommandMenuHarness(page);
    const picker = new PickerHarness(page, 'Labels');
    const item = new ItemViewHarness(page);
    const tooltip = page.locator('[data-side]:is([data-state="delayed-open"], [data-state="instant-open"])');
    const escape = async () => {
        await page.keyboard.press('Escape');
    };
    return [
        {
            name: 'tooltip',
            surface: tooltip,
            open: async () => {
                await shell.collapseButton.hover();
                await expect(tooltip).toBeVisible();
            },
            close: escape,
        },
        {
            name: 'dropdown menu',
            surface: page.getByRole('menu'),
            open: async () => {
                await shell.account(SAMPLE_VIEWER.viewer.login).click();
                await expect(page.getByRole('menu')).toBeVisible();
            },
            close: escape,
        },
        {
            name: 'context menu',
            surface: page.getByRole('menu'),
            open: async () => {
                await shell.openTrackedMenu(SAMPLE_PROJECT);
                await expect(page.getByRole('menu')).toBeVisible();
            },
            close: escape,
        },
        {
            name: 'dialog',
            surface: menu.root,
            open: async () => {
                await menu.open();
            },
            close: escape,
        },
        {
            name: 'popover',
            surface: picker.root,
            open: async () => {
                await myWork.row(ISSUE).click();
                await expect(item.property('Labels')).toBeVisible();
                await page.keyboard.press('l');
                await expect(picker.filter).toBeVisible();
            },
            close: escape,
        },
        {
            name: 'toast',
            surface: shell.toasts,
            open: async () => {
                await page.keyboard.press('l');
                await picker.choose('bug');
                await picker.close();
                await expect(shell.toasts).toBeVisible();
            },
            close: async () => {
                await shell.toasts.first().getByRole('button', { name: 'Dismiss' }).first().click();
            },
        },
    ];
}

/** A phone's sheets: the places panel from the left and the command menu from below. Escape closes each. */
function phoneSheets(page: Page): Overlay[] {
    const places = page.getByRole('dialog', { name: 'Places' });
    const menu = new CommandMenuHarness(page);
    const escape = async () => {
        await page.keyboard.press('Escape');
    };
    return [
        {
            name: 'places panel',
            surface: places,
            open: async () => {
                await page.getByRole('button', { name: 'Open places' }).click();
                await expect(places).toBeVisible();
            },
            close: escape,
        },
        {
            name: 'command menu',
            surface: menu.root,
            open: async () => {
                await page.getByRole('button', { name: /Do or find…/u }).click();
                await expect(menu.root).toBeVisible();
            },
            close: escape,
        },
    ];
}

/** What `surface` animates by, as computed. */
async function motionOf(surface: Locator): Promise<{ name: string; durationMs: number }> {
    return await surface.first().evaluate(element => {
        const style = getComputedStyle(element);
        return { name: style.animationName, durationMs: Number.parseFloat(style.animationDuration) * 1000 };
    });
}

/** What `element` transitions by, as computed (the first of its durations). */
async function transitionOf(element: Locator): Promise<{ durationMs: number }> {
    return await element.evaluate(node => ({
        durationMs: Number.parseFloat(getComputedStyle(node).transitionDuration) * 1000,
    }));
}

/**
 * Plays the page's animations ten times slower, so a check surely lands while a sheet of 200 ms slides out however
 * loaded the machine is; the function it returns plays them at their speed again.
 */
async function slowAnimations(page: Page): Promise<() => Promise<void>> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
    return async () => {
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
        await cdp.detach();
    };
}

/** Resolves after the browser painted a frame: Vue has updated the page by then, a fade of 150 ms has not ended. */
async function nextFrame(page: Page): Promise<void> {
    await page.evaluate(
        () =>
            new Promise<void>(resolve => {
                requestAnimationFrame(() => resolve());
            }),
    );
}
