import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as dialogStories from '@/components/Dialog.stories.jsx';

import { keepEscapeInPage } from './keepEscapeInPage.js';

const { NewIssue } = composeStories(dialogStories);

/** Installs it as the app does, ahead of everything else, and records the keys seen by a listener added after it. */
function install() {
    onTestFinished(keepEscapeInPage());

    const seen: { event: KeyboardEvent; preventedWhenHandled: boolean }[] = [];
    const listener = (event: KeyboardEvent) => {
        seen.push({ event, preventedWhenHandled: event.defaultPrevented });
    };
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));

    return seen;
}

test('an Escape nobody handled ends up prevented, and the listeners saw it free', async () => {
    const seen = install();

    await userEvent.keyboard('{Escape}');

    expect(seen).toHaveLength(1);
    expect(seen[0]?.preventedWhenHandled).toBe(false);
    expect(seen[0]?.event.defaultPrevented).toBe(true);
});

test('Escape still closes a layer, and does not go on to the system after it', async () => {
    const seen = install();
    await NewIssue.run();

    await userEvent.click(page.getByRole('button', { name: 'New issue' }));
    const dialog = page.getByRole('dialog', { name: 'New issue' });
    await expect.element(dialog).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await expect.element(dialog).not.toBeInTheDocument();
    expect(seen.at(-1)?.event.key).toBe('Escape');
    expect(seen.at(-1)?.event.defaultPrevented).toBe(true);
});

test('other keys keep their default', async () => {
    const seen = install();

    await userEvent.keyboard('j');

    expect(seen[0]?.event.defaultPrevented).toBe(false);
});

test('an Escape stopped on its way leaves the next key alone', async () => {
    const seen = install();
    const stop = (event: KeyboardEvent) => {
        event.stopPropagation();
    };
    window.addEventListener('keydown', stop, { capture: true });

    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', stop, { capture: true });
    await userEvent.keyboard('j');

    expect(seen.map(({ event }) => event.key)).toEqual(['j']);
    expect(seen[0]?.event.defaultPrevented).toBe(false);
});

test('an Escape composing text is left to the input method', () => {
    onTestFinished(keepEscapeInPage());
    const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, cancelable: true, bubbles: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
});
