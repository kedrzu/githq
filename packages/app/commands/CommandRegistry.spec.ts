import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { Translator } from '@nzyme/i18n/Translator.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { bindCommand } from './bindCommand.js';
import { CommandRegistry } from './CommandRegistry.js';
import type { BoundCommand } from './CommandTypes.js';
import { defineAppCommand } from './defineAppCommand.js';

// The registry's own rules for whose a key is, with no screen: a screen's command (one with a place but `app`) against
// the app's.

const container = createContainer();
container.set(LanguageContext, () => APP_LANGUAGE);
const t = container.resolve(Translator);

test("a screen's command runs by its other keys too", async () => {
    const ran: string[] = [];
    register([listCommand('J', ran, ['ArrowDown'])]);

    await userEvent.keyboard('j{ArrowDown}');
    expect(ran).toEqual(['list:J', 'list:J']);
});

test("a screen's keys yield to a layer over the screen, its Escape to an open picker; the app's run as before", async () => {
    const ran: string[] = [];
    register([listCommand('J', ran), listCommand('Escape', ran), appCommand('Alt+G', ran), appCommand('Escape', ran)]);

    const layer = prepend('div', element => {
        element.dataset.layer = '';
    });
    await userEvent.keyboard('j{Alt>}g{/Alt}');
    expect(ran).toEqual(['app:Alt+G']);
    layer.remove();

    // A picker's Escape closes it: the screen's yields, to the app's that runs as it did.
    const picker = prepend('div', element => element.setAttribute('data-reka-popper-content-wrapper', ''));
    await userEvent.keyboard('{Escape}j');
    expect(ran).toEqual(['app:Alt+G', 'app:Escape', 'list:J']);
    picker.remove();

    await userEvent.keyboard('{Escape}');
    expect(ran).toEqual(['app:Alt+G', 'app:Escape', 'list:J', 'list:Escape']);
});

test("Enter and Space are a focused button's own, whoever's command they are", async () => {
    const ran: string[] = [];
    register([listCommand('Enter', ran), listCommand('Space', ran), appCommand('Enter', ran)]);
    const clicked = vi.fn();
    const button = prepend('button', element => element.addEventListener('click', clicked));

    button.focus();
    await userEvent.keyboard('{Enter} ');
    expect(ran).toEqual([]);
    expect(clicked).toHaveBeenCalledTimes(2);

    button.blur();
    await userEvent.keyboard('{Enter} ');
    expect(ran).toEqual(['list:Enter', 'list:Space']);
});

/** The registry of a fresh container, with these commands registered for the test. */
function register(commands: readonly BoundCommand[]) {
    const registry = createContainer().resolve(CommandRegistry);
    onTestFinished(registry.register({ commands, subject: null }));
}

/** A list's command on a test definition, noting `list:<its key>`. */
function listCommand(key: string, ran: string[], otherKeys?: readonly string[]) {
    const definition = defineAppCommand({ id: `list.${key}`, title: () => key, key, otherKeys, places: ['list'] });
    return bindCommand(definition, { section: 'view', run: () => void ran.push(`list:${key}`) }, t);
}

/** The app's command on a test definition, noting `app:<its key>`. */
function appCommand(key: string, ran: string[]) {
    const definition = defineAppCommand({ id: `app.${key}`, title: () => key, key, places: ['app'] });
    return bindCommand(definition, { section: 'app', run: () => void ran.push(`app:${key}`) }, t);
}

/** An element put first in the page for the test, `prepare`d once it is there. */
function prepend(tag: string, prepare: (element: HTMLElement) => void) {
    const element = document.createElement(tag);
    element.textContent = tag;
    document.body.prepend(element);
    onTestFinished(() => element.remove());
    prepare(element);
    return element;
}
