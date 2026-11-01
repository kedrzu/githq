import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';

import StatusBar from './StatusBar.vue';
import * as stories from './StatusBar.stories.js';

// The translations keep short words with the next one (a no-break space): `\s` matches either.
const SEGMENT = /^Paused until\s14:32 · 100 left$/;

const { Exhausted, Paused, PausedCollapsed } = composeStories(stories);

test('refresh paused (K3): the segment opens why — editing still works, other changes wait — and Escape closes it', async () => {
    await Paused.run();

    const segment = page.getByRole('button', { name: SEGMENT });
    await userEvent.click(segment);

    // Named by the segment that opened it, as a popover is.
    const explanation = page.getByRole('dialog', { name: SEGMENT });
    await expect.element(explanation).toBeVisible();
    await expect.element(explanation.getByRole('heading', { name: /^Background refresh is\spaused$/ })).toBeVisible();
    await expect.element(explanation.getByText(/your edits still go\sthrough/)).toBeVisible();
    await expect.element(explanation.getByText(/^100 of\s5,000 this hour$/)).toBeVisible();
    await expect.element(explanation.getByText(/^14:32 · in\s\d+ min$/)).toBeVisible();
    await expect.element(explanation.getByText(/^13:58 · /)).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(explanation).not.toBeInTheDocument();
    await expect.element(segment).toHaveFocus();
});

test('under the rail the paused segment is its icon, named by the whole sentence, and opens the same', async () => {
    await PausedCollapsed.run();

    await userEvent.click(page.getByRole('button', { name: SEGMENT }));
    await expect.element(page.getByRole('dialog', { name: SEGMENT })).toBeVisible();
});

test('the allowance used up to the last point, by other apps too, says edits may be refused until the reset', async () => {
    await Exhausted.run();

    await userEvent.click(page.getByRole('button', { name: /^Paused until\s14:32 · 0 left$/ }));
    await expect.element(page.getByText(/GitHub may refuse edits until\s14:32/)).toBeVisible();
});

test('on the web the bar never offers an update, even one said to be ready', async () => {
    // The stories and these tests build the web app (`__DESKTOP__` is `false`), whose bar has no update segment.
    const restart = vi.fn();
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(AppUpdate, { readyVersion: '1.4.0', restart, later: () => {} });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ setup: () => () => h(StatusBar, { rateLimit: null }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    const bar = page.elementLocator(host).getByRole('contentinfo', { name: 'Status' });
    await expect.element(bar).toBeInTheDocument();
    // Time enough for a lazily loaded segment to appear, were there one.
    await new Promise(resolve => {
        setTimeout(resolve, 200);
    });
    await expect.element(bar.getByText(/is ready/)).not.toBeInTheDocument();
    await expect.element(bar.getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(restart).not.toHaveBeenCalled();
});
