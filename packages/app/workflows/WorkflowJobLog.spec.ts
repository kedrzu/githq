import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { trackTabFocus } from '@/testing/trackTabFocus.js';

import { MAX_SHOWN_CHARACTERS } from './utils/getLogLineParts.js';
import * as stories from './WorkflowJobLog.stories.js';

const {
    Failed,
    FoldedAbove,
    Hostile,
    Huge,
    InvisibleCharacters,
    LongLines,
    NoMarker,
    OnlyMatches,
    OnlyMatchesAroundLeftOut,
    OnlyMatchesLeftOutBetween,
    Passed,
    Polled,
    SearchBoundByParent,
    SearchLiterally,
    SearchPastTheCut,
    Searching,
    SeveralErrors,
    TallAtTheEnd,
} = composeStories(stories);

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

test('the map shows the whole log: red for errors, dividers between steps by their lines, a band for the view, clicking moves there; folds move no mark', async () => {
    await SeveralErrors.run();
    await settled();
    const map = page.getByTestId('workflow-log-map');
    const tops = (id: string) =>
        map
            .getByTestId(id)
            .elements()
            .map(mark => Number.parseFloat(mark.style.top));
    const errors = () => map.getByTestId('workflow-log-map-error').elements();
    const band = () => map.getByTestId('workflow-log-map-view').element();

    // Between the steps with lines: 2 lines of Checkout, then the build's. A folded step takes its lines' height.
    const dividers = tops('workflow-log-map-step');
    expect(dividers).toHaveLength(2);
    const total = 2 + 87 + 2 + 1;
    expect(dividers[0]).toBeCloseTo((2 / total) * 100, 0);
    expect(errors().length).toBeGreaterThan(1);
    const errorTops = tops('workflow-log-map-error');
    const before = Number.parseFloat(band().style.top);
    expect(before).toBeGreaterThan(0);

    await userEvent.click(map, { position: { x: 5, y: 2 } });
    await settled();
    expect(log().scrollTop).toBe(0);
    expect(Number.parseFloat(band().style.top)).toBe(0);

    // Folding the long step: every mark stays, and more of the log is in view.
    const height = Number.parseFloat(band().style.height);
    await userEvent.keyboard('{Shift>}g{/Shift}{Shift>}k{/Shift} ');
    await settled();
    expect(Number.parseFloat(band().style.height)).toBeGreaterThan(height);
    expect(tops('workflow-log-map-step')).toEqual(dividers);
    expect(tops('workflow-log-map-error')).toEqual(errorTops);
});

test('the map: a click into a folded step opens it and lands there, the band following the lines', async () => {
    await FoldedAbove.run();
    await settled();
    expect(isExpanded('Set up job')).toBe('false');
    // Line 151 of 311 in the middle of the map: all that is folded away.
    const map = page.getByTestId('workflow-log-map');
    const { height } = map.element().getBoundingClientRect();

    await userEvent.click(map, { position: { x: 5, y: height / 2 } });
    await settled();
    await settled();

    expect(cursorText()).toMatch(/^1[45]\d word/u);
    expect(inView(cursorLine())).toBe(true);
    const band = map.getByTestId('workflow-log-map-view').element();
    const top = Number.parseFloat(band.style.top);
    const bandHeight = Number.parseFloat(band.style.height);
    expect(top).toBeLessThan(50);
    expect(top + bandHeight).toBeGreaterThan(50);
    expect(bandHeight).toBeLessThan(20);
});

test('a head clicked with wrap on leaves the view where it is, whatever was brought into view before', async () => {
    await FoldedAbove.run();
    await settled();
    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(log().scrollTop).toBe(0);

    await userEvent.click(page.getByRole('button', { name: /Set up job/u }), { position: IN_THE_TEST_FRAME });
    await settled();
    await settled();
    await settled();

    expect(isExpanded('Set up job')).toBe('true');
    expect(log().scrollTop).toBe(0);
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

test('the list is labelled, and takes the keyboard to scroll', async () => {
    await Failed.run();

    await expect.element(page.getByRole('list', { name: 'build' })).toBeInTheDocument();
    expect(log().getAttribute('tabindex')).toBe('0');
});

test('⇧G reaches the end even where wrapped lines come out taller than estimated', async () => {
    await TallAtTheEnd.run();
    await settled();
    await userEvent.keyboard('g');
    await settled();
    await userEvent.keyboard('w');
    await settled();
    await settled();

    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();
    await settled();
    await settled();

    expect(cursorText()).toContain('the very end');
    expect(inView(cursorLine())).toBe(true);
    expect(Math.ceil(log().scrollTop + log().clientHeight)).toBeGreaterThanOrEqual(log().scrollHeight);
});

test('a 200 on the jobs’ poll keeps a selection’s start in the DOM: the rows did not move', async () => {
    await Polled.run();
    await settled();
    const first = lines()[10];
    if (!first?.lastElementChild) {
        throw new Error('The line should be in view');
    }

    first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.getSelection()?.selectAllChildren(first.lastElementChild);
    first.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settled();
    log().scrollTop += 18 * 500;
    await settled();
    expect(first.isConnected).toBe(true);

    page.getByTestId('workflow-log-poll')
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settled();
    await settled();
    expect(first.isConnected).toBe(true);
    window.getSelection()?.removeAllRanges();
});

test('“… N more characters” opens the rest of its line by a click, wrapped, in view and within a moment', async () => {
    await Hostile.run();
    await settled();
    const long = () => lines().find(line => line.textContent?.startsWith('xxx') || line.textContent?.includes('xxxx'));
    const more = page.getByTestId('workflow-log-more');
    await expect.element(more).toHaveTextContent('990000 more characters');
    const before = long()?.getBoundingClientRect().height;
    expect(before).toBe(18);
    // Held in view, not 72,000 pixels off to the side.
    expect(more.element().getBoundingClientRect().right).toBeLessThanOrEqual(log().getBoundingClientRect().right);

    const started = performance.now();
    more.element().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settled();
    await settled();

    expect(long()?.lastElementChild?.textContent?.replaceAll(/\s/gu, '').length).toBe(1_000_000);
    await expect.element(more).not.toBeInTheDocument();
    expect(long()?.getBoundingClientRect().height).toBeGreaterThan(1000);
    expect(performance.now() - started).toBeLessThan(2000);
    // Wrapped within the view: nothing runs off to the side, whichever way the rest of the log lies.
    const box = long()?.lastElementChild?.getBoundingClientRect();
    expect(box?.width).toBeLessThanOrEqual(log().clientWidth);
    // Its neighbours moved by what it really measures.
    const rows = lines();
    const index = rows.indexOf(long() ?? rows[0] ?? document.body);
    expect(rows[index + 1]?.getBoundingClientRect().top).toBeCloseTo(
        rows[index]?.getBoundingClientRect().bottom ?? 0,
        0,
    );
});

test('Enter opens the rest of the line under the cursor, and only with something to open', async () => {
    await Hostile.run();
    await settled();
    const whole = () => lines().find(line => (line.textContent?.length ?? 0) > 500_000);

    // On the error: its line is whole.
    await userEvent.keyboard('{Enter}');
    await settled();
    expect(whole()).toBeUndefined();

    await userEvent.keyboard('k');
    await settled();
    expect(cursorLine()?.querySelector('button')?.textContent).toContain('990000 more characters');
    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();
    expect(whole()).toBe(cursorLine() ?? undefined);
    // The view stays at the line's start, not its far end.
    expect(cursorLine()?.getBoundingClientRect().top).toBeLessThan(log().getBoundingClientRect().bottom);
    expect(cursorLine()?.getBoundingClientRect().bottom).toBeGreaterThan(log().getBoundingClientRect().top);
    expect(log().scrollTop).toBeLessThan(cursorLine()?.getBoundingClientRect().height ?? 0);
});

test('the opened line stays open and measured through W, in a log of its own', async () => {
    await Hostile.run();
    await settled();
    await userEvent.keyboard('k');
    await settled();
    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();
    const height = cursorLine()?.getBoundingClientRect().height ?? 0;
    expect(height).toBeGreaterThan(1000);

    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(cursorLine()?.getBoundingClientRect().height).toBeGreaterThan(1000);
    await userEvent.keyboard('w');
    await settled();
    await settled();
    expect(cursorLine()?.getBoundingClientRect().height).toBeCloseTo(height, 0);
});

test('bidi and invisible characters show as what they are, change nothing around them, and copy as they were', async () => {
    await InvisibleCharacters.run();
    await settled();
    const line = lines().find(row => row.textContent?.includes('safe'));
    const body = line?.lastElementChild;
    if (!body) {
        throw new Error('The line should be in view');
    }

    const control = body.querySelector('[data-control]');
    expect(control?.getAttribute('data-control')).toBe('U+202E');
    expect(getComputedStyle(control ?? body, '::before').content).toContain('U+202E');

    // "evil" reads left to right: the override reaches no further than its own placeholder.
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    while (text && text.textContent !== 'evil') {
        text = walker.nextNode();
    }

    if (!text) {
        throw new Error('The text after the control should be there');
    }

    const edge = (index: number) => {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        return range.getBoundingClientRect().left;
    };
    expect(edge(0)).toBeLessThan(edge(3));

    window.getSelection()?.selectAllChildren(body);
    expect(window.getSelection()?.toString()).toBe('safe‮evil');
    window.getSelection()?.removeAllRanges();

    const zero = lines().find(row => row.textContent?.includes('zero'));
    expect(zero?.querySelector('[data-control]')?.getAttribute('data-control')).toBe('U+200B');
});

test('keyboard focus on the log draws no ring around it: the cursor’s row shows where the keyboard is', async () => {
    await Failed.run();
    await settled();

    for (let tabs = 0; tabs < 10 && document.activeElement !== log(); tabs++) {
        await userEvent.tab();
    }

    expect(log().matches(':focus-visible')).toBe(true);
    const holder = log().parentElement ?? log();
    expect(getComputedStyle(holder, '::after').boxShadow).toBe('none');
    expect(getComputedStyle(log()).outlineStyle).toBe('none');
    expect(log().querySelector('[aria-current]')).not.toBeNull();
});

test('moving onto a line taller than the view starts at its top, not its far end', async () => {
    await Hostile.run();
    await settled();
    await userEvent.keyboard('k');
    await settled();
    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();

    await userEvent.keyboard('g');
    await settled();
    await userEvent.keyboard('jjj');
    await settled();
    await settled();
    expect(cursorLine()?.getBoundingClientRect().height).toBeGreaterThan(1000);
    const top = cursorLine()?.getBoundingClientRect().top ?? 0;
    expect(top).toBeGreaterThanOrEqual(log().getBoundingClientRect().top);
    expect(top).toBeLessThan(log().getBoundingClientRect().bottom);
});

const field = () => page.getByTestId('workflow-log-search-field');
const position = () => page.getByTestId('workflow-log-search-position');
const marks = () => [...log().querySelectorAll('mark')];
/** Longer than the log's wait after the last key of a query. */
const QUERY_APPLIED_MS = 150;
const currentMark = () => log().querySelector('[data-current-match]');
const gaps = () => page.getByTestId('workflow-log-gap').elements();
const cursorGap = () => log().querySelector('[tid="workflow-log-gap"][aria-current="true"]');

async function search(text: string) {
    await userEvent.keyboard('/');
    await settled();
    await userEvent.keyboard(text);
    await expect.poll(() => page.getByTestId('workflow-log-search-position').query()).not.toBeNull();
    // The query applies a moment after the last key: on a slow machine what shows until then is the query's first letters'.
    await new Promise(resolve => {
        setTimeout(resolve, QUERY_APPLIED_MS);
    });
    await settled();
}

test('W4b: / opens the bar in the toolbar’s place, the field taking the keys; W and T stay on outside it', async () => {
    await Failed.run();
    await settled();
    await expect.element(page.getByTestId('workflow-log-open-search')).toBeVisible();

    await userEvent.keyboard('/');
    await settled();
    await expect.element(field()).toHaveFocus();
    await expect.element(page.getByTestId('workflow-log-wrap')).not.toBeVisible();
    await expect.element(page.getByTestId('workflow-log-search')).toBeVisible();

    // Typed: no screen key runs, not even the ones that are letters here.
    const before = cursorText();
    await userEvent.keyboard('jkwtgn');
    await expect.element(field()).toHaveValue('jkwtgn');
    expect(localStorage.getItem('githq.logWrap')).toBeNull();
    expect(cursorText()).toBe(before);

    // Outside the field the keys are the screen's.
    log().focus();
    await userEvent.keyboard('w');
    expect(localStorage.getItem('githq.logWrap')).toBe('true');
    await userEvent.keyboard('t');
    expect(localStorage.getItem('githq.logTimes')).toBe('true');
});

test('W4b: the toolbar’s button opens the bar', async () => {
    await Failed.run();
    await settled();

    await userEvent.click(page.getByRole('button', { name: /Search log/u }));
    await settled();
    await expect.element(field()).toHaveFocus();
});

test('W4b: ⌘F opens the bar, and is left alone in another field and under a layer', async () => {
    await Failed.run();
    await settled();
    const press = () =>
        new KeyboardEvent('keydown', {
            key: 'f',
            metaKey: /mac/iu.test(navigator.platform),
            ctrlKey: !/mac/iu.test(navigator.platform),
            bubbles: true,
            cancelable: true,
        });

    const other = document.createElement('input');
    document.body.append(other);
    const inField = press();
    other.dispatchEvent(inField);
    expect(inField.defaultPrevented).toBe(false);
    other.remove();

    const layer = document.createElement('div');
    layer.setAttribute('data-layer', '');
    document.body.append(layer);
    const underLayer = press();
    log().dispatchEvent(underLayer);
    expect(underLayer.defaultPrevented).toBe(false);
    layer.remove();
    await expect.element(page.getByTestId('workflow-log-search')).not.toBeInTheDocument();

    const free = press();
    log().dispatchEvent(free);
    expect(free.defaultPrevented).toBe(true);
    await settled();
    await expect.element(field()).toHaveFocus();
});

test('W4b: the whole job is searched, folded steps included: counts on their heads, matches on the map, n of m', async () => {
    await Failed.run();
    await settled();

    await search('prepare');

    await expect.element(position()).toHaveTextContent('1 of 1');
    await expect.element(page.getByTestId('workflow-log-search-where')).toHaveTextContent('in 1 step');
    // Landed in the folded step: open, the cursor there, in view.
    expect(isExpanded('Set up job')).toBe('true');
    expect(cursorText()).toBe('Prepare');
    expect(inView(cursorLine())).toBe(true);
    await expect.poll(() => currentMark()?.textContent).toBe('Prepare');
    expect(headOf('Set up job')?.textContent).toContain('1 match');
    expect(page.getByTestId('workflow-log-map-match').elements()).toHaveLength(1);
});

test('W4b: Enter or N next, ⇧N previous, wrapping around; ⇧Enter in the field', async () => {
    await Searching.run();
    await settled();
    await settled();
    // The cursor opened at the error, past every match: the first from there wraps around.
    await expect.element(position()).toHaveTextContent('1 of 6');
    expect(inView(cursorLine())).toBe(true);

    log().focus();
    await userEvent.keyboard('n');
    await expect.element(position()).toHaveTextContent('2 of 6');
    await userEvent.keyboard('{Enter}');
    await expect.element(position()).toHaveTextContent('3 of 6');
    await userEvent.keyboard('{Shift>}n{/Shift}');
    await expect.element(position()).toHaveTextContent('2 of 6');
    await userEvent.keyboard('{Shift>}n{/Shift}{Shift>}n{/Shift}');
    await expect.element(position()).toHaveTextContent('6 of 6');
    await settled();
    expect(inView(cursorLine())).toBe(true);
    await userEvent.keyboard('n');
    await expect.element(position()).toHaveTextContent('1 of 6');

    await userEvent.keyboard('/');
    await settled();
    await expect.element(field()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(position()).toHaveTextContent('2 of 6');
    await expect.element(field()).toHaveFocus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect.element(position()).toHaveTextContent('1 of 6');
});

test('smart case: lower case finds any case, a capital only itself', async () => {
    await Failed.run();
    await settled();

    // The two lines that say it, and the "Error:" a marked line is drawn with.
    await search('error');
    await expect.element(position()).toHaveTextContent(/of 3$/u);

    await userEvent.fill(field(), 'ERROR');
    await expect.element(position()).toHaveTextContent('1 of 1');
    await expect.poll(() => currentMark()?.textContent).toBe('ERROR');
});

test('W4b: what a marked line is drawn with can be found, highlighted where it shows, the line reading as before', async () => {
    await Failed.run();
    await settled();

    await search('Error:');
    await expect.element(position()).toHaveTextContent('1 of 1');
    await expect.poll(() => currentMark()?.textContent).toBe('Error:');
    expect(cursorText()).toBe('Error: Process completed with exit code 1.');

    // Across where the prefix meets the text, and in the text past it.
    await userEvent.fill(field(), 'Error: Process');
    await expect.poll(() => currentMark()?.textContent).toBe('Error: Process');
    await userEvent.fill(field(), 'completed');
    await expect.poll(() => currentMark()?.textContent).toBe('completed');
    expect(cursorText()).toBe('Error: Process completed with exit code 1.');

    await userEvent.fill(field(), 'Warning:');
    await expect.element(position()).toHaveTextContent('1 of 1');
    await expect.poll(() => currentMark()?.textContent).toBe('Warning:');
    expect(cursorText()).toBe('Warning: A chunk is larger than 500 KB');
});

test('the query is plain text: a pattern’s characters and markup are searched for as they are, and highlight as text', async () => {
    await SearchLiterally.run();
    await settled();

    for (const [query, count] of [
        ['.*(', 1],
        ['a{1000}', 1],
    ] as const) {
        await userEvent.keyboard('/');
        await settled();
        await userEvent.fill(field(), query);
        await expect.element(position()).toHaveTextContent(`1 of ${count}`);
        await expect.poll(() => currentMark()?.textContent).toBe(query);
        await userEvent.keyboard('{Escape}');
        await settled();
    }

    await userEvent.keyboard('/');
    await settled();
    await userEvent.fill(field(), '<b>');
    await expect.element(position()).toHaveTextContent('1 of 1');
    await expect.poll(() => currentMark()?.textContent).toBe('<b>');
    expect(log().querySelector('b')).toBeNull();
    expect(cursorText()).toBe('a <b>bold</b> claim');
});

test('a match past where a line is cut shows the line whole, the match in view', async () => {
    await SearchPastTheCut.run();
    await settled();

    await search('needle');

    await expect.poll(() => currentMark()?.textContent).toBe('needle');
    await settled();
    await settled();
    const box = currentMark()?.getBoundingClientRect();
    const view = log().getBoundingClientRect();
    expect(box?.top).toBeGreaterThanOrEqual(view.top);
    expect(box?.bottom).toBeLessThanOrEqual(view.bottom);
});

test('a line of a million characters searched for one of them: the marks are capped and the bar says there are more', async () => {
    await SearchPastTheCut.run();
    await settled();

    await search('q');

    await expect.element(position()).toHaveTextContent('1 of 1,000+');
    expect(marks().length).toBeLessThanOrEqual(1000);
});

test('W4c: Tab shows only the matching lines, by step, numbers kept, gaps counted; steps with none left out', async () => {
    await Searching.run();
    await settled();
    await settled();

    log().focus();
    await userEvent.keyboard('{Tab}');
    await settled();

    await expect.element(position()).toHaveTextContent('6 lines');
    await expect.element(page.getByTestId('workflow-log-search-where')).toHaveTextContent('in 2 steps');
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'true');
    log().scrollTop = 0;
    await settled();
    expect(heads().map(head => head.textContent)).toEqual([
        expect.stringContaining('Checkout'),
        expect.stringContaining('Run bun run build'),
    ]);
    expect(lines().every(line => line.querySelector('mark'))).toBe(true);
    // The numbers are the log's: past the first step's two lines and the 31 of the install before its first match.
    expect(lines()[0]?.firstElementChild?.textContent).toBe('34');
    expect(gaps()[0]?.textContent).toContain('31 lines');

    await userEvent.keyboard('{Tab}');
    await settled();
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
    await expect.element(position()).toHaveTextContent(/ of 6$/u);
    expect(page.getByTestId('workflow-log-gap').query()).toBeNull();
});

test('a control Tab reached outside the log holds its keys back, J as ↓; one Escape gives them back', async () => {
    trackTabFocus();
    await Failed.run();
    await settled();

    for (let tabs = 0; tabs < 10 && !document.activeElement?.hasAttribute('data-tab-focus'); tabs++) {
        await userEvent.tab();
    }

    expect(document.activeElement?.hasAttribute('data-tab-focus')).toBe(true);
    const first = cursorNumber();
    await userEvent.keyboard('k{ArrowUp}');
    await settled();
    expect(cursorNumber()).toBe(first);

    await userEvent.keyboard('{Escape}k');
    await settled();
    expect(cursorNumber()).not.toBe(first);
});

test('Tab onto the log holds nothing back: the keys are its own', async () => {
    trackTabFocus();
    await Failed.run();
    await settled();

    for (let tabs = 0; tabs < 10 && document.activeElement !== log(); tabs++) {
        await userEvent.tab();
    }

    expect(log().hasAttribute('data-tab-focus')).toBe(false);
    const first = cursorNumber();
    await userEvent.keyboard('{ArrowUp}');
    await settled();
    expect(cursorNumber()).not.toBe(first);
});

test('W4c: Tab from the field gives the keys to the rows; J/K stop at a gap, and Space opens it in place', async () => {
    await Searching.run();
    await settled();
    await settled();

    await userEvent.keyboard('/');
    await settled();
    await userEvent.keyboard('{Tab}');
    await settled();
    expect(document.activeElement).toBe(log());
    await expect.element(position()).toHaveTextContent('6 lines');

    const first = cursorNumber();
    await userEvent.keyboard('k');
    await settled();
    expect(log().querySelector('[tid="workflow-log-gap"][aria-current="true"]')?.textContent).toContain('31 lines');
    await userEvent.keyboard(' ');
    await settled();

    // In place: the gap's first line takes the cursor, and the match stays where it was, under its lines.
    expect(gaps().some(gap => gap.textContent?.includes('31 lines'))).toBe(false);
    expect(cursorText()).toBe('bun install v1.3');
    expect(Number(first)).toBe(34);
    expect(lines().map(line => line.firstElementChild?.textContent)).toContain('3');
    expect(isExpanded('Checkout')).toBe('true');
});

test('W4c: Enter on a line returns to the full log there, its neighbours around it, and Esc stays there', async () => {
    await OnlyMatches.run();
    await settled();
    await settled();
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'true');

    log().focus();
    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();

    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
    const chosen = cursorText();
    expect(chosen).toContain('resolve');
    expect(inView(cursorLine())).toBe(true);
    expect(page.getByTestId('workflow-log-gap').query()).toBeNull();
    expect(lines().some(line => !line.querySelector('mark'))).toBe(true);

    await userEvent.keyboard('{Escape}');
    await settled();
    await expect.element(page.getByTestId('workflow-log-search')).not.toBeInTheDocument();
    expect(cursorText()).toBe(chosen);
    expect(inView(cursorLine())).toBe(true);
    expect(marks()).toEqual([]);
});

test('W4c, bound like the page: Enter in the field shows the line in the full log, ⇧Enter stays the previous match', async () => {
    await SearchBoundByParent.run();
    await settled();
    await settled();
    await userEvent.keyboard('{Tab}');
    await settled();
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('n');
    await settled();
    const landed = cursorText();

    await userEvent.keyboard('/');
    await settled();
    await expect.element(field()).toHaveFocus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await settled();
    expect(cursorText()).not.toBe(landed);
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(field()).toHaveFocus();
    const chosen = cursorText();

    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();

    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
    expect(cursorText()).toBe(chosen);
    expect(inView(cursorLine())).toBe(true);
    expect(document.activeElement).toBe(log());
    expect(page.getByTestId('workflow-log-gap').query()).toBeNull();
});

test('W4c, bound like the page: Enter right after typing means what is typed, and with no match stays where it is', async () => {
    await SearchBoundByParent.run();
    await settled();
    await settled();
    await userEvent.keyboard('{Tab}');
    await settled();
    await userEvent.keyboard('/');
    await settled();

    await userEvent.fill(field(), 'nothing like it');
    await userEvent.keyboard('{Enter}');
    await settled();
    await expect.element(position()).toHaveTextContent('No matches');
    await expect.element(field()).toHaveFocus();

    // Among only the matches again, by what is typed.
    await userEvent.fill(field(), 'resolve');
    await expect.element(position()).toHaveTextContent('2 lines');

    await userEvent.fill(field(), 'checkout could');
    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();
    expect(cursorText()).toBe('checkout could not resolve it');
    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
});

test('W4c: E goes to the nearest row that shows past an error in a step left out, and on from there', async () => {
    await OnlyMatchesAroundLeftOut.run();
    await settled();
    await settled();
    await userEvent.keyboard('n');
    await settled();
    expect(cursorText()).toBe('fetch hit one');

    await userEvent.keyboard('e');
    await settled();

    expect(cursorText()).toBe('clean hit two');
    expect(inView(cursorLine())).toBe(true);
});

test('W4c: ⇧G goes to the last row that shows, past a step left out, and ⇧K and Space work from there', async () => {
    await OnlyMatchesAroundLeftOut.run();
    await settled();
    await settled();

    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();
    expect(cursorGap()?.textContent).toContain('1 line');

    await userEvent.keyboard('{Shift>}k{/Shift}');
    await settled();
    expect(cursorText()).toBe('fetch hit one');

    await userEvent.keyboard('{Shift>}g{/Shift}');
    await settled();
    await userEvent.keyboard(' ');
    await settled();
    expect(cursorText()).toBe('Cleaned');
});

test('W4c: a click on the map in a step left out lands on the nearest row that shows', async () => {
    await OnlyMatchesAroundLeftOut.run();
    await settled();
    await settled();
    const map = page.getByTestId('workflow-log-map');

    // A log shorter than the view takes the height of its lines on the map: this is line 5, the middle step's first.
    await userEvent.click(map, { position: { x: 5, y: 4.5 * 18 } });
    await settled();
    expect(cursorGap()?.textContent).toContain('1 line');
    await userEvent.keyboard(' ');
    await settled();
    expect(cursorText()).toBe('Done');

    // Line 1, in the step above them all.
    await userEvent.click(map, { position: { x: 5, y: 2 } });
    await settled();
    expect(cursorText()).toBe('fetch hit one');
});

test('W4c: the sticky head gives way to the next head, past a step left out between them', async () => {
    await OnlyMatchesLeftOutBetween.run();
    await settled();
    await settled();
    // Where a head of 26 and 60 lines of 18 put the next head, a little above the bottom of the view.
    log().scrollTop = 26 + 60 * 18 - 100;
    await settled();

    const head = headOf('Post Checkout');
    if (!head) {
        throw new Error('The head should be in the DOM by now');
    }

    log().scrollTop += head.getBoundingClientRect().top - log().getBoundingClientRect().top - 10;
    await settled();

    const sticky = page.getByTestId('workflow-log-sticky');
    await expect.element(sticky).toHaveTextContent('Checkout');
    expect(Number.parseFloat(sticky.element().style.transform.replace('translateY(', ''))).toBeLessThan(0);
});

test('W4c, bound like the page: Enter on a match in a step folded in the full log opens it there, in view', async () => {
    await SearchBoundByParent.run();
    await settled();
    await settled();
    log().focus();
    await userEvent.keyboard('{Tab}');
    await settled();
    await userEvent.keyboard('n');
    await settled();
    expect(cursorText()).toBe('checkout could not resolve it');

    await userEvent.keyboard('{Enter}');
    await settled();
    await settled();

    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
    expect(cursorText()).toBe('checkout could not resolve it');
    expect(inView(cursorLine())).toBe(true);
    expect(log().scrollTop).toBeGreaterThan(0);
    expect(lines().some(line => line.textContent?.includes('checkout line 249'))).toBe(true);
    expect(document.activeElement).toBe(log());
});

test('W4c, bound like the page: Tab back to the full log stays at the line, its step opening', async () => {
    await SearchBoundByParent.run();
    await settled();
    await settled();
    log().focus();
    await userEvent.keyboard('{Tab}');
    await settled();
    await userEvent.keyboard('n');
    await settled();

    await userEvent.keyboard('{Tab}');
    await settled();
    await settled();

    await expect.element(page.getByTestId('workflow-log-search-only')).toHaveAttribute('aria-pressed', 'false');
    expect(cursorText()).toBe('checkout could not resolve it');
    expect(inView(cursorLine())).toBe(true);
    expect(log().scrollTop).toBeGreaterThan(0);
});

test('W4c, bound like the page: Tab to only the matches brings the line landed on into view, in the document it shows', async () => {
    await SearchBoundByParent.run();
    await settled();
    await settled();
    await userEvent.keyboard('/');
    await settled();
    await userEvent.keyboard('line 2');
    await expect.element(position()).toHaveTextContent(/ of 220$/u);
    await settled();
    log().focus();
    // Past the first step's matches, in a list of them longer than the view, far above where the full log has the line.
    await userEvent.keyboard('{Shift>}j{/Shift}n');
    await settled();
    expect(cursorText()).toBe('checkout line 2');

    await userEvent.keyboard('{Tab}');
    await settled();
    await settled();

    await expect.element(position()).toHaveTextContent('220 lines');
    expect(cursorText()).toBe('checkout line 2');
    expect(inView(cursorLine())).toBe(true);
});

test('Esc closes the search and returns to where the view was: cursor, scroll, folds; the keys back on the log', async () => {
    await Failed.run();
    await settled();
    await userEvent.keyboard('kk');
    await settled();
    const cursorBefore = cursorText();
    const scrollBefore = log().scrollTop;

    await search('prepare');
    expect(cursorText()).toBe('Prepare');
    await expect.element(field()).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await settled();
    await settled();

    await expect.element(page.getByTestId('workflow-log-search')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('workflow-log-wrap')).toBeVisible();
    expect(document.activeElement).toBe(log());
    expect(cursorText()).toBe(cursorBefore);
    expect(log().scrollTop).toBe(scrollBefore);
    log().scrollTop = 0;
    await settled();
    expect(isExpanded('Set up job')).toBe('false');
});

test('100,000 lines: typing goes straight in the field, the DOM stays small, and all the matches are found', async () => {
    await Huge.run();
    await settled();

    await userEvent.keyboard('/');
    await settled();
    await userEvent.keyboard('line 99');
    await expect.element(field()).toHaveValue('line 99');

    await expect.element(position()).toHaveTextContent(/ of 1,111$/u);
    await settled();
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);

    await userEvent.keyboard('{Tab}');
    await settled();
    await expect.element(position()).toHaveTextContent('1,111 lines');
    expect(rowCount()).toBeLessThan(DOM_ROW_CAP);
});

test('a very long list of matches draws no more on the map than it has pixels for', async () => {
    await Huge.run();
    await settled();

    await search('line');

    await expect.element(position()).toHaveTextContent(/ of 99,990$/u);
    const { height } = page.getByTestId('workflow-log-map').element().getBoundingClientRect();
    expect(page.getByTestId('workflow-log-map-match').elements().length).toBeLessThanOrEqual(height / 2 + 1);
});

test('the query holds through a poll: the view stays on its match', async () => {
    await Polled.run();
    await settled();
    await search('line 2500 of');
    await expect.element(position()).toHaveTextContent('1 of 1');
    const landed = cursorText();

    log().focus();
    await userEvent.click(page.getByTestId('workflow-log-poll'));
    await settled();

    expect(cursorText()).toBe(landed);
    await expect.element(position()).toHaveTextContent('1 of 1');
});
