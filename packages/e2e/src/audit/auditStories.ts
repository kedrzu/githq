/**
 * Measures every story of the built Storybook, for the accessibility work of issue #119. Not a test: it reports, it
 * doesn't judge. For each story at the e2e viewport it records
 *
 * - every rule of axe that is on by default (best practices included), violations and "incomplete" results;
 * - the colors text, icons and control outlines really render in, composited over what is behind them, at rest, hovered
 *   and focused — axe gives up on some of these and doesn't look at icons or hovers at all.
 *
 * `bun --cwd packages/app build-storybook && bun packages/e2e/src/audit/auditStories.ts [out.json] [storyIdFilter]`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { measurePaint } from './measurePaint.js';
import type { PaintSample } from './measurePaint.js';

const STORYBOOK = path.join(import.meta.dirname, '../../../app/storybook-static');
const OUTPUT = process.argv[2] ?? path.join(import.meta.dirname, '../../../../.context/a11y/stories.json');
const FILTER = process.argv[3];
const WORKERS = 6;
/** Hover is tried on this many different-looking controls of a story. */
const MAX_INTERACTIVE = 24;
/** Tab presses per story: enough to pass every kind of control of a screen. */
const MAX_TABS = 30;
const INTERACTIVE =
    'button, a[href], input, select, textarea, summary, [tabindex], [role=button], [role=tab], [role=link], [role=option], [role=menuitem], [role=checkbox], [role=switch], [role=radio]';

const MIME_TYPES: Record<string, string> = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

interface AxeNode {
    target: string[];
    html: string;
    failureSummary?: string;
    any: { id: string; message: string; data: unknown }[];
}

interface AxeResult {
    id: string;
    impact: string | null;
    tags: string[];
    help: string;
    nodes: AxeNode[];
}

interface AxeRun {
    violations: AxeResult[];
    incomplete: AxeResult[];
}

interface StoryAudit {
    story: string;
    error?: string;
    violations: AxeResult[];
    incomplete: AxeResult[];
    paint: (PaintSample & { state: 'rest' | 'hover' | 'focus' })[];
    /** Controls that take focus and look the same with it (WCAG 2.4.7), which axe can't see. */
    focusless: string[];
    /** What the pointer can click under 24 px, focusable or not: axe sees focusable ones only. */
    smallTargets: string[];
}

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    try {
        const body = readFileSync(path.join(STORYBOOK, pathname));
        response.writeHead(200, { 'content-type': MIME_TYPES[path.extname(pathname)] ?? 'application/octet-stream' });
        response.end(body);
    } catch {
        response.writeHead(404).end();
    }
});
await new Promise<void>(resolve => {
    server.listen(0, resolve);
});
const { port } = server.address() as AddressInfo;
const stories = readStories().filter(id => !FILTER || id.includes(FILTER));
const browser = await chromium.launch();
const results: StoryAudit[] = [];
let next = 0;

await Promise.all(Array.from({ length: WORKERS }, () => runWorker(browser)));
await browser.close();
server.close();

mkdirSync(path.dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(results));
console.log(`${results.length} stories, ${results.filter(result => result.error).length} errors → ${OUTPUT}`);

async function runWorker(activeBrowser: Browser) {
    const context = await activeBrowser.newContext({
        viewport: { width: Number(process.env.A11Y_WIDTH ?? 1440), height: 900 },
        reducedMotion: 'reduce',
    });

    while (next < stories.length) {
        const story = stories[next++]!;
        const page = await context.newPage();
        try {
            results.push(await auditStory(page, story));
        } catch (error) {
            results.push({
                story,
                error: String(error),
                violations: [],
                incomplete: [],
                paint: [],
                focusless: [],
                smallTargets: [],
            });
        }
        await page.close();
        if (results.length % 50 === 0) {
            console.log(`${results.length}/${stories.length}`);
        }
    }

    await context.close();
}

async function auditStory(page: Page, story: string): Promise<StoryAudit> {
    await page.goto(`http://localhost:${port}/iframe.html?id=${story}&viewMode=story`);
    await page.waitForFunction(() => document.querySelector('#storybook-root')?.hasChildNodes(), undefined, {
        timeout: 15_000,
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(150);

    await page.addScriptTag({ content: axeSource });
    const axe = await page.evaluate(async () => {
        const { axe: runner } = window as unknown as {
            axe: { run(context: unknown, options: unknown): Promise<AxeRun> };
        };
        return await runner.run(
            {
                exclude: [
                    '.sb-wrapper',
                    '.sb-nopreview',
                    '.sb-errordisplay',
                    '.sb-preparing-story',
                    '.sb-preparing-docs',
                ],
            },
            {
                resultTypes: ['violations', 'incomplete'],
                // `target-size` is off unless asked for by tag; best practices hold most of the ARIA and landmark rules
                // beyond WCAG.
                runOnly: {
                    type: 'tag',
                    values: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
                },
            },
        );
    });
    const { violations, incomplete } = axe;

    const paint: StoryAudit['paint'] = (await page.evaluate(measurePaint, null)).map(sample => ({
        ...sample,
        state: 'rest' as const,
    }));

    const smallTargets = await page.evaluate(() => {
        const found: string[] = [];
        for (const element of document.querySelectorAll(
            '#storybook-root *, body > [data-reka-popper-content-wrapper] *',
        )) {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const pointer = style.cursor === 'pointer';
            const inherited = element.parentElement && getComputedStyle(element.parentElement).cursor === 'pointer';
            if (!pointer || inherited || box.width === 0 || box.height === 0 || Math.min(box.width, box.height) >= 24) {
                continue;
            }
            if (style.display === 'inline' && element.tagName === 'A') {
                continue;
            }
            const name =
                (element.getAttribute('class') ?? '').split(/\s+/).find(part => part.startsWith('_')) ??
                element.tagName.toLowerCase();
            found.push(
                `${name} ${element.tagName.toLowerCase()}${element.getAttribute('tabindex') === '-1' ? ' tabindex=-1' : ''} ${Math.round(box.width)}×${Math.round(box.height)}`,
            );
        }
        return found;
    });
    const controls = await distinctControls(page);
    const focusless: string[] = [];
    for (const control of controls) {
        try {
            await control.hover({ timeout: 400, force: true });
            await page.waitForTimeout(30);
            const samples = await control.evaluate(measurePaint, true);
            paint.push(...samples.map(sample => ({ ...sample, state: 'hover' as const })));
        } catch {
            // Hidden, covered or gone after an earlier control changed the story: nothing to measure.
        }
    }

    // The keyboard's own walk: Tab through the story as a keyboard user does, with what lands focus and what it looks like.
    await page.mouse.move(0, 0);
    const seen = new Set<string>();
    for (let press = 0; press < MAX_TABS; press++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
            const element = document.activeElement;
            if (!element || element === document.body || element.closest('.sb-wrapper')) {
                return null;
            }
            return element.getAttribute('class') ?? element.tagName;
        });
        if (stop === null || seen.has(stop)) {
            continue;
        }
        seen.add(stop);
        await page.evaluate(() => document.activeElement?.setAttribute('data-audit-focus', ''));
        const control = page.locator('[data-audit-focus]').first();
        await page.waitForTimeout(20);
        const samples = await control.evaluate(measurePaint, true);
        paint.push(...samples.map(sample => ({ ...sample, state: 'focus' as const })));
        const focusedLook = await control.evaluate(focusLook);
        await control.evaluate(element => {
            (element as HTMLElement).blur();
        });
        await page.waitForTimeout(20);
        if (focusedLook === (await control.evaluate(focusLook))) {
            focusless.push(await control.evaluate(describeControl));
        }
        await control.evaluate(element => {
            (element as HTMLElement).focus();
            element.removeAttribute('data-audit-focus');
        });
    }

    return { story, violations, incomplete, paint, focusless, smallTargets };
}

async function distinctControls(page: Page) {
    const all = await page.locator(INTERACTIVE).all();
    const seen = new Set<string>();
    const distinct = [];
    for (const control of all) {
        const key = await control
            .evaluate(element => `${element.tagName}|${element.getAttribute('class') ?? ''}`, undefined, {
                timeout: 400,
            })
            .catch(() => null);
        if (key === null || seen.has(key)) {
            continue;
        }
        seen.add(key);
        distinct.push(control);
        if (distinct.length === MAX_INTERACTIVE) {
            break;
        }
    }
    return distinct;
}

/** How a control and its subtree look, in everything a focus indicator could change. */
function focusLook(element: Element) {
    const properties = [
        'outlineStyle',
        'outlineColor',
        'boxShadow',
        'backgroundColor',
        'borderTopColor',
        'color',
        'textDecorationLine',
        'opacity',
    ] as const;
    const look = (target: Element, pseudo?: string) => {
        const style = getComputedStyle(target, pseudo);
        return properties.map(property => style[property]).join('|');
    };
    return [element, element.parentElement, ...element.querySelectorAll('*')]
        .flatMap(target => (target ? [look(target), look(target, '::before'), look(target, '::after')] : []))
        .join(';');
}

function describeControl(element: Element) {
    const name = (element.getAttribute('class') ?? '').split(/\s+/).find(part => part.startsWith('_')) ?? '';
    return `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : ''} ${name} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}"`;
}

function readStories() {
    const index = JSON.parse(readFileSync(path.join(STORYBOOK, 'index.json'), 'utf8')) as {
        entries: Record<string, { id: string; type: string }>;
    };
    return Object.values(index.entries)
        .filter(entry => entry.type === 'story')
        .map(entry => entry.id);
}
