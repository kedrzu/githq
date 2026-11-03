import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { MAX_SHOWN_CHARACTERS } from './utils/getLogLineParts.js';
import * as stories from './WorkflowJobLog.stories.js';

const { Failed, Highlighted, Hostile, Huge, LongLines, NoMarker, Passed, SeveralErrors } = composeStories(stories);

/** A 100,000-line log may still only ever have what is in view: 500 / 18 rows and a little overscan. */
const DOM_ROW_CAP = 70;
/** The test's frame is narrower than the story: the middle of a row, where a click goes by default, is outside it. */
const IN_THE_TEST_FRAME = { x: 40, y: 9 };

const log = () => page.getByTestId('workflow-job-log').element();
const rowCount = () => log().querySelectorAll('li').length;
const lines = () => page.getByTestId('workflow-log-line').elements();
const heads = () => page.getByTestId('workflow-log-step').elements();
const cursorLine = () => log().querySelector('[aria-current="true"]');
const cursorText = () => cursorLine()?.lastElementChild?.textContent;
const cursorNumber = () => cursorLine()?.firstElementChild?.firstElementChild?.textContent;
const headOf = (name: string) => heads().find(head => head.textContent?.includes(name));
const isExpanded = (name: string) => headOf(name)?.querySelector('button')?.getAttribute('aria-expanded');
const inView = (element: Element | null | undefined) => {
    const box = element?.getBoundingClientRect();
    const view = log().getBoundingClientRect();
    return box !== undefined && box.top >= view.top && box.bottom <= view.bottom;
};
const settled = () =>
    new Promise(resolve => {
        requestAnimationFrame(() => setTimeout(resolve));
    });

beforeEach(() => {
    localStorage.removeItem('githq.logWrap');
    localStorage.removeItem('githq.logTimes');
});

test('W4a: opens with the cursor on the failed step’s error and the lines above it in view', async () => {
    await Failed.run();
    await settled();

    expect(cursorText()).toBe('Error: Process completed with exit code 1.');
    expect(inView(cursorLine())).toBe(true);
    // What caused it stands above it.
    expect(lines().some(line => inView(line) && line.textContent?.includes('Build failed after 2m 04s'))).toBe(true);
    await expect.element(page.getByTestId('workflow-log-errors')).toHaveTextContent('Error 1 of 1');
});

test('W4a: passed steps are folded and part of the document, the failed step is open; a skipped one has nothing to fold', async () => {
    await Failed.run();
    await settled();
    log().scrollTop = log().scrollHeight;
    await settled();

    expect(isExpanded('Post Checkout')).toBe('false');
    expect(isExpanded('Complete job')).toBe('false');
    expect(headOf('Upload artifact')?.textContent).toContain('skipped');
    expect(isExpanded('Upload artifact')).toBeNull();
    log().scrollTop = 0;
    await settled();
    expect(isExpanded('Set up job')).toBe('false');
    expect(isExpanded('Run bun run build')).toBe('true');
});

test('W4h: with no marker it opens at the end, the toolbar saying so and the end of the log saying why', async () => {
    await NoMarker.run();
    await settled();

    expect(cursorText()).toContain('59 books a place');
    await expect.element(page.getByTestId('workflow-log-errors')).toHaveTextContent('No error marker');
    const end = page.getByTestId('workflow-log-end');
    await expect.element(end).toHaveTextContent('The log ends here. The job failed without an error marker');
    expect(inView(end.element())).toBe(true);
});

test('J/K move by line, across steps; moving into a folded step opens it', async () => {
    await Failed.run();
    await settled();

    await userEvent.keyboard('k');
    expect(cursorText()).toBe('error: script "build" exited with code 1');
    await userEvent.keyboard('j');
    expect(cursorText()).toContain('Process completed');
    // The arrows too.
    await userEvent.keyboard('{ArrowUp}{ArrowDown}');
    expect(cursorText()).toContain('Process completed');

    expect(isExpanded('Post Checkout')).toBe('false');
    await userEvent.keyboard('j');
    expect(cursorText()).toBe('Clean');
    expect(isExpanded('Post Checkout')).toBe('true');
});

test('⇧J/⇧K move by step, opening the one moved into', async () => {
    await Failed.run();
    await settled();

    await userEvent.keyboard('{Shift>}k{/Shift}');
    await settled();
    expect(cursorText()).toBe('Fetching…');
    expect(isExpanded('Checkout')).toBe('true');
    expect(inView(cursorLine())).toBe(true);

    await userEvent.keyboard('{Shift>}j{/Shift}');
    await settled();
    expect(cursorText()).toBe('Run bun run build');
});

test('Space folds and opens the cursor’s step, the cursor waiting on its head', async () => {
    await Failed.run();
    await settled();

    await userEvent.keyboard(' ');
    await settled();
    expect(isExpanded('Run bun run build')).toBe('false');
    expect(lines().map(line => line.textContent)).not.toContainEqual(expect.stringContaining('Process completed'));

    await userEvent.keyboard(' ');
    await settled();
    expect(cursorText()).toContain('Process completed');
    expect(inView(cursorLine())).toBe(true);
});

test('a head clicked folds or opens its step, and Space keeps working', async () => {
    await Failed.run();
    await settled();
    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();

    await userEvent.click(page.getByRole('button', { name: /Post Checkout/u }), { position: IN_THE_TEST_FRAME });
    await settled();
    expect(isExpanded('Post Checkout')).toBe('true');
    expect(document.activeElement).toBe(log());
});

test('E/⇧E go between errors, opening a folded step, and the toolbar counts', async () => {
    await SeveralErrors.run();
    await settled();

    const errors = page.getByTestId('workflow-log-errors');
    expect(cursorText()).toContain('Process completed');
    await expect.element(errors).toHaveTextContent('Error 2 of 3');

    await userEvent.keyboard('e');
    await settled();
    expect(cursorText()).toContain('And again');
    await expect.element(errors).toHaveTextContent('Error 3 of 3');

    await userEvent.keyboard('{Shift>}e{/Shift}{Shift>}e{/Shift}');
    await settled();
    expect(cursorText()).toContain('Checkout hiccup');
    expect(isExpanded('Checkout')).toBe('true');
    await expect.element(errors).toHaveTextContent('Error 1 of 3');
});

test('G/⇧G go to the top and the end; D/U go half a page', async () => {
    await Failed.run();
    await settled();

    await userEvent.keyboard('g');
    await settled();
    expect(log().scrollTop).toBe(0);
    expect(cursorText()).toBe('Runner image 2.1');

    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();
    expect(cursorText()).toBe('Bye');
    expect(Math.ceil(log().scrollTop + log().clientHeight)).toBeGreaterThanOrEqual(log().scrollHeight);

    await userEvent.keyboard('{Shift>}k{/Shift}{Shift>}k{/Shift}');
    await settled();
    await userEvent.keyboard('d');
    await settled();
    const halfPage = Math.floor(log().clientHeight / 2 / 18);
    expect(Number(cursorNumber())).toBeGreaterThanOrEqual(halfPage - 2);
    const down = log().scrollTop;
    expect(down).toBeGreaterThan(0);
    await userEvent.keyboard('u');
    await settled();
    expect(log().scrollTop).toBeLessThan(down);
});

test('the sticky header names the step the top of the view is in, and the numbers are the whole log’s', async () => {
    await Failed.run();
    await settled();

    const sticky = page.getByTestId('workflow-log-sticky');
    await expect.element(sticky).toHaveTextContent('Run bun run build');
    // Past the two steps before it, whose lines are the log's first.
    expect(Number(cursorNumber())).toBeGreaterThan(80);

    log().scrollTop = 0;
    await settled();
    await expect.element(sticky).not.toBeInTheDocument();
});

test('Y copies the line’s address in GitHub’s form, counted within its step', async () => {
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await Failed.run();
    await settled();

    await userEvent.keyboard('y');

    expect(copy).toHaveBeenCalledWith('https://github.com/fitloop/webapp/actions/runs/4821/job/103#step:3:89');
    copy.mockRestore();
});

test('an address lands the cursor on its line, opening its step; a new one moves it', async () => {
    await Failed.run({ args: { ...Failed.args, address: { stepNumber: 2, stepLine: 2 } } });
    await settled();

    expect(cursorText()).toBe('Done');
    expect(isExpanded('Checkout')).toBe('true');
});

test('W and T persist between logs and sessions, off by default; wrapped lines hang under their text', async () => {
    await LongLines.run();
    await settled();
    await expect.element(page.getByTestId('workflow-log-wrap')).toHaveAttribute('aria-pressed', 'false');
    const text = () => lines().find(line => line.textContent?.includes('much more besides'));
    expect(text()?.getBoundingClientRect().height).toBe(18);
    expect(log().scrollWidth).toBeGreaterThan(log().clientWidth);

    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(localStorage.getItem('githq.logWrap')).toBe('true');
    const wrapped = lines().filter(line => line.getBoundingClientRect().height > 18);
    expect(wrapped.length).toBeGreaterThan(0);
    expect(log().scrollWidth).toBe(log().clientWidth);
    const body = wrapped[0]?.lastElementChild;
    expect(body?.getBoundingClientRect().left).toBeGreaterThan(wrapped[0]?.getBoundingClientRect().left ?? 0);

    await userEvent.keyboard('t');
    await settled();
    expect(localStorage.getItem('githq.logTimes')).toBe('true');
    expect(cursorLine()?.firstElementChild?.children).toHaveLength(2);
    expect(cursorLine()?.firstElementChild?.lastElementChild?.textContent).toMatch(/^\d\d:\d\d:\d\d$/u);

    // Another log, another session.
    await Failed.run();
    await settled();
    await expect.element(page.getByTestId('workflow-log-wrap')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByTestId('workflow-log-times')).toHaveAttribute('aria-pressed', 'true');
});

test('a wrapped line’s height is measured as it shows, and the row’s place follows it', async () => {
    await LongLines.run();
    await settled();
    await userEvent.keyboard('w');
    await settled();
    await settled();

    const rows = lines();
    for (const [index, row] of rows.entries()) {
        const next = rows[index + 1];
        if (next) {
            expect(next.getBoundingClientRect().top).toBeCloseTo(row.getBoundingClientRect().bottom, 0);
        }
    }

    expect(inView(cursorLine())).toBe(true);
});

test('the map: red for errors, dividers for steps, a band for the view, clicking moves there; folds shrink what it maps', async () => {
    await SeveralErrors.run();
    await settled();
    const map = page.getByTestId('workflow-log-map');
    const errors = () => map.getByTestId('workflow-log-map-error').elements();
    const band = () => map.getByTestId('workflow-log-map-view').element();

    expect(map.getByTestId('workflow-log-map-step').elements()).toHaveLength(6);
    expect(errors().length).toBeGreaterThan(1);
    const before = Number.parseFloat(band().style.top);
    expect(before).toBeGreaterThan(0);

    await userEvent.click(map, { position: { x: 5, y: 2 } });
    await settled();
    expect(log().scrollTop).toBe(0);
    expect(Number.parseFloat(band().style.top)).toBe(0);

    // Folding the long step: the band takes more of what is left.
    const height = Number.parseFloat(band().style.height);
    await userEvent.keyboard('{Shift>}g{/Shift}{Shift>}k{/Shift} ');
    await settled();
    expect(Number.parseFloat(band().style.height)).toBeGreaterThan(height);
});

test('a log of 100,000 lines only has what is in view in the DOM, whatever is done to it', async () => {
    await Huge.run();
    await settled();
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);
    expect(cursorText()).toContain('Error at 5000');

    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);
    expect(cursorText()).toBe('Clean');

    log().scrollTop = log().scrollHeight / 2;
    await settled();
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);
    expect(lines().length).toBeGreaterThan(20);
    expect(inView(lines()[15])).toBe(true);

    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);
    await userEvent.keyboard('{Shift>}e{/Shift}');
    await settled();
    expect(cursorText()).toContain('Error at');
    expect(page.getByTestId('workflow-log-map-error').elements().length).toBeLessThan(200);
});

test('log text is text only: markup in a line shows as written and runs nothing', async () => {
    await Hostile.run();
    await settled();
    await userEvent.keyboard('g');
    await settled();
    await userEvent.keyboard('{Shift>}j{/Shift}{Shift>}j{/Shift}');
    await settled();

    const body = lines().map(line => line.textContent ?? '');
    expect(body).toContainEqual(expect.stringContaining('<script>alert(1)</script>'));
    expect(body).toContainEqual(expect.stringContaining('<img src=x onerror="window.logXss = true">'));
    expect(body).toContainEqual(expect.stringContaining('{{ 1 + 1 }}'));
    expect(log().querySelector('script, img')).toBeNull();
    expect(Reflect.get(window, 'logXss')).toBeUndefined();
});

test('a line of a million characters is cut, saying how much, and stays quick wrapped or not', async () => {
    const started = performance.now();
    await Hostile.run();
    await settled();
    const longest = () => lines().find(line => line.textContent?.includes('more characters'));
    expect(longest()?.textContent?.length).toBeLessThan(MAX_SHOWN_CHARACTERS + 100);
    expect(longest()?.textContent).toMatch(/990000 more characters/u);

    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(longest()?.getBoundingClientRect().height).toBeGreaterThan(18);
    expect(performance.now() - started).toBeLessThan(3000);
});

test('a line clicked takes the cursor; a selection with the mouse stays and doesn’t', async () => {
    await Failed.run();
    await settled();

    const clicked = lines().find(line => line.textContent?.includes('Build failed after 2m 04s'));
    if (!clicked) {
        throw new Error('The line should be in view');
    }

    await userEvent.click(clicked, { position: IN_THE_TEST_FRAME });
    await settled();
    expect(cursorText()).toContain('Build failed after 2m 04s');

    const body = clicked.lastElementChild;
    if (!body) {
        throw new Error('The line should have its text');
    }

    window.getSelection()?.selectAllChildren(body);
    await settled();
    const selected = window.getSelection()?.toString();
    const other = lines().find(line => line.textContent?.includes('exited with code 1'));
    other?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cursorText()).toContain('Build failed after 2m 04s');
    expect(selected).toBe('[nuxi] ERROR  Build failed after 2m 04s');
    window.getSelection()?.removeAllRanges();
});

test('a selection’s start stays in the DOM as the view moves away from it', async () => {
    await Huge.run();
    await settled();
    const first = lines()[10];
    if (!first?.lastElementChild) {
        throw new Error('The line should be in view');
    }

    const number = first.firstElementChild?.textContent;
    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    // A press collapses the selection first: that must not let go of the row.
    window.getSelection()?.removeAllRanges();
    await settled();
    window.getSelection()?.selectAllChildren(first.lastElementChild);
    first.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settled();

    log().scrollTop += 18 * 500;
    await settled();
    expect(first.isConnected).toBe(true);
    expect(lines().find(line => line.firstElementChild?.textContent === number)).toBe(first);

    window.getSelection()?.removeAllRanges();
    await settled();
    expect(first.isConnected).toBe(false);
});

test('keys stay away from a text field', async () => {
    await Failed.run();
    await settled();
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();

    const before = cursorText();
    await userEvent.keyboard('k{ArrowUp}');
    expect(cursorText()).toBe(before);
    expect(localStorage.getItem('githq.logWrap')).toBeNull();
    await userEvent.keyboard('w');
    expect(localStorage.getItem('githq.logWrap')).toBeNull();
    field.remove();
});

test('a job that passed opens at its top with every step folded, the cursor on the first head', async () => {
    await Passed.run();
    await settled();

    expect(lines()).toEqual([]);
    expect(heads()).toHaveLength(2);
    expect(page.getByTestId('workflow-log-errors').query()).toBeNull();
    expect(headOf('Set up job')?.querySelector('button')?.className).toMatch(/cursor/u);
    await userEvent.keyboard(' ');
    await settled();
    expect(cursorText()).toBe('Prepare');
});

test('ranges to highlight mark their text', async () => {
    await Highlighted.run();
    await settled();

    expect(log().querySelector('mark')?.textContent).toBe('error');
    expect(lines().find(line => line.querySelector('mark'))?.lastElementChild?.textContent).toBe(
        'error: script "build" exited',
    );
});

test('the list is labelled, and takes the keyboard to scroll', async () => {
    await Failed.run();

    await expect.element(page.getByRole('list', { name: 'build' })).toBeInTheDocument();
    expect(log().getAttribute('tabindex')).toBe('0');
});
