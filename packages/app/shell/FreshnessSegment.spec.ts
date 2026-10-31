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

const NOW = Date.parse('2026-10-30T14:06:00Z');

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

/** Mounts the segment showing `freshness`, on a clock that moves only when told. */
function mount(freshness: Freshness) {
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

    const app = createApp({ setup: () => () => h(FreshnessSegment, { freshness }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return {
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
