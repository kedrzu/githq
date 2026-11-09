import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, h } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { QuitHint } from './QuitHint.js';
import QuitHintToast from './QuitHintToast.vue';

const toast = () => page.getByRole('region', { name: 'Notifications' }).getByRole('listitem');

test('⌘W says that ⌘Q quits', async () => {
    const { hint } = mount();
    await expect.element(page.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await expect.element(toast()).not.toBeInTheDocument();

    hint.press();

    await expect.element(toast()).toHaveTextContent('Press ⌘Q to quit githq');
    await expect.element(toast()).toHaveTextContent("⌘W doesn't close the window, so githq won't quit by accident.");
});

test('pressed again while it shows, it is still the one toast', async () => {
    const { hint } = mount();
    hint.press();
    await expect.element(toast()).toBeInTheDocument();

    hint.press();
    hint.press();

    await expect.poll(() => toast().all().length).toBe(1);
});

test('a press before it was mounted (signed out) is not told later', async () => {
    const container = createContainer();
    container.resolve(QuitHint).press();

    mount(container);

    await expect.element(page.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await expect.element(toast()).not.toBeInTheDocument();
});

function mount(container = createContainer()) {
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(Toaster, null, { default: () => h(QuitHintToast) }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return { hint: container.resolve(QuitHint) };
}
