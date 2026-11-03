import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ClockShape } from '@/services/Clock.js';
import { Clock } from '@/services/Clock.js';
import type { Freshness } from '@/sync/Freshness.js';

import FreshnessSegment from './FreshnessSegment.vue';
import type { SegmentEdits } from './SegmentEdits.js';

const NOW = Date.parse('2026-10-30T14:06:00Z');
const FRESH: Freshness = { kind: 'fresh', checkedAt: NOW };

// Mounted by hand rather than from a story: the test moves the clock the segment ticks by.

test('hovering "Up to date" tells how long ago it was checked, and the time moves on while it is open', async () => {
    const clock = mount({ kind: 'fresh', checkedAt: NOW - 12_000 });

    await userEvent.hover(page.getByText('Up to date'));
    await expect.element(tooltip('Checked 12s ago')).toBeVisible();

    clock.advance(3000);
    await expect.element(tooltip('Checked 15s ago')).toBeVisible();

    clock.advance(60_000);
    await expect.element(tooltip('Checked 1m ago')).toBeVisible();
});

test('W4j: while a job runs it says when GitHub was last asked, and the time moves on', async () => {
    const clock = mount({ kind: 'statusChecked', checkedAt: NOW - 20_000 });

    await expect.element(page.getByText('Status checked 20s ago')).toBeVisible();
    clock.advance(3000);
    await expect.element(page.getByText('Status checked 23s ago')).toBeVisible();
});

test('W4i: a log that failed to read says so, whichever job', async () => {
    mount({ kind: 'logFailed', job: 'build' });

    await expect.element(page.getByText("The log of build didn't load")).toBeVisible();
});

test('PM35, PM36: a merge refused is red and brings its toast back; one GitHub has not answered is grey, with nothing to click', async () => {
    const refused = mount(FRESH, { kind: 'failed', text: 'Merge refused · fitloop/api#477' });
    await userEvent.click(page.getByRole('button', { name: 'Merge refused · fitloop/api#477' }));
    expect(refused.shown).toBe(1);

    const text = "fitloop/api#477 · GitHub hasn't answered · the next refresh will settle it";
    mount(FRESH, { kind: 'unanswered', text });
    await expect.element(page.getByText(text)).toBeVisible();
    await expect.element(page.getByRole('button', { name: text })).not.toBeInTheDocument();
});

/** Mounts the segment showing `freshness` — or the user's `edits` — on a clock that moves only when told. */
function mount(freshness: Freshness, edits: SegmentEdits | null = null) {
    let now = NOW;
    let timers: { at: number; callback: () => void }[] = [];
    const clock: ClockShape = {
        now: () => now,
        schedule: (callback, delayMs) => {
            const timer = { at: now + delayMs, callback };
            timers.push(timer);
            return () => {
                timers = timers.filter(other => other !== timer);
            };
        },
    };

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Clock, clock);
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.height = '26px';
    host.style.marginTop = '100px';
    document.body.append(host);

    let shown = 0;
    const app = createApp({
        setup: () => () => h(FreshnessSegment, { freshness, edits, onShowFailure: () => shown++ }),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return {
        /** How many times the failure's toast was asked for again. */
        get shown() {
            return shown;
        },
        /** Moves the clock on by `ms`, running the timers that fall due on the way. */
        advance(ms: number) {
            const end = now + ms;
            for (;;) {
                const next = timers.toSorted((a, b) => a.at - b.at)[0];
                if (!next || next.at > end) {
                    break;
                }

                timers = timers.filter(other => other !== next);
                now = next.at;
                next.callback();
            }

            now = end;
        },
    };
}

/** The open tooltip, by what it says — the first match: reka-ui keeps a hidden copy of its text inside it. */
function tooltip(text: string) {
    return page.getByText(text).first();
}
