import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// What axe can't see in a keyboard-first app: where Tab goes, and whether the user can see it get there.

/** Tab presses to a walk: enough to pass the sidebar and into a screen, on the window this config opens. */
const TABS = 25;

test('Tab walks the screens in order: never stuck, and every stop shows it has the focus', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);

    await test.step('my work', () => expectWalk(page));

    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(new RepositoryScreenHarness(page).section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await test.step('a repository', () => expectWalk(page));

    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(new ProjectScreenHarness(page).tabs.first()).toBeVisible();
    await test.step('a project', () => expectWalk(page));

    await page.goto('/settings');
    await expect(new SettingsScreenHarness(page).heading).toBeVisible();
    await test.step('Settings', () => expectWalk(page));
});

test('the command menu takes the focus, keeps it in, and hands it back when it closes', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    const opener = shell.tracked(SAMPLE_REPOSITORY);
    await opener.focus();

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.field).toBeFocused();

    for (let press = 0; press < 5; press++) {
        await page.keyboard.press('Tab');
        await expect(page.getByRole('dialog').locator('*:focus')).toHaveCount(1);
    }

    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();
    await expect(opener).toBeFocused();
});

/** Presses Tab through the screen: each stop must differ from the last, and look different for having the focus. */
async function expectWalk(page: Page) {
    // An indicator that fades in would read as none.
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    await page.locator('body').evaluate(body => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        body.focus();
    });

    const stops: string[] = [];
    const unseen: string[] = [];
    let last: unknown = null;
    for (let press = 0; press < TABS; press++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluateHandle(() => document.activeElement);
        const same = await stop.evaluate((element, previous) => element === previous, last);
        expect(same, `Tab stayed on ${stops.at(-1)}`).toBe(false);
        last = stop;

        const name = await stop.evaluate(describeElement);
        if (name === 'body') {
            continue;
        }
        stops.push(name);

        // A field shows its caret.
        const focused = await stop.evaluate(readLook);
        await stop.evaluate(element => {
            (element as HTMLElement).blur();
        });
        if (focused === (await stop.evaluate(readLook)) && !(await stop.evaluate(isField))) {
            unseen.push(name);
        }
        await stop.evaluate(element => {
            (element as HTMLElement).focus();
        });
    }

    expect(stops.length).toBeGreaterThan(0);
    expect(unseen).toEqual([]);
}

function isField(element: unknown) {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function describeElement(element: unknown) {
    if (!(element instanceof HTMLElement)) {
        return 'none';
    }
    const name = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? '';
    return element === document.body ? 'body' : `${element.tagName.toLowerCase()} "${name}"`;
}

/** How an element, its parent and what it holds look, in all a focus indicator could change. */
function readLook(element: unknown) {
    if (!(element instanceof Element)) {
        return '';
    }
    const properties = [
        'outlineStyle',
        'outlineColor',
        'boxShadow',
        'backgroundColor',
        'borderTopColor',
        'color',
    ] as const;
    const read = (target: Element, pseudo?: string) => {
        const style = getComputedStyle(target, pseudo);
        return properties.map(property => style[property]).join('|');
    };
    return [element, element.parentElement, ...element.querySelectorAll('*')]
        .flatMap(target => (target ? [read(target), read(target, '::before'), read(target, '::after')] : []))
        .join(';');
}
