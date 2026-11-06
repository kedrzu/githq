import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';

import { NewVersion } from './NewVersion.js';
import NewVersionToast from './NewVersionToast.vue';

const toast = () => page.getByRole('region', { name: 'Notifications' }).getByRole('listitem');

test('nothing shows until a newer version is out; then it stays, and nothing reloads until the user says so', async () => {
    const { version, reload } = mount();
    await expect.element(page.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await expect.element(toast()).not.toBeInTheDocument();

    version.announce();

    await expect.element(toast()).toHaveTextContent('A new version of githq is out');
    await expect.element(toast()).toHaveTextContent('Reload to get it.');
    // Pinned: no countdown.
    expect(document.querySelector('[tid="toast-countdown"]')).toBeNull();
    const button = toast().getByRole('button', { name: 'Reload' });
    await expect.element(button).toHaveAttribute('aria-keyshortcuts', 'Alt+R');
    expect(reload).not.toHaveBeenCalled();

    await userEvent.click(button);
    expect(reload).toHaveBeenCalledOnce();
});

test('dismissed, it goes with its key and does not reload', async () => {
    const { version, reload, registry } = mount();
    version.announce();
    await expect.element(toast()).toBeInTheDocument();

    await userEvent.click(toast().getByRole('button', { name: 'Dismiss' }).first());

    await expect.element(toast()).not.toBeInTheDocument();
    expect(version.out).toBe(false);
    expect(registry.commands.some(candidate => candidate.id === 'app.reloadToNewVersion')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
});

/** The toast in the shell's toaster, over a browser whose reload is only counted. */
function mount() {
    const reload = vi.fn();
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, { ...createContainer().resolve(Browser), reload });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(Toaster, null, { default: () => h(NewVersionToast) }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return { version: container.resolve(NewVersion), reload, registry: container.resolve(CommandRegistry) };
}
