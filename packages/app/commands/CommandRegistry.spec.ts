import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { CommandRegistry } from './CommandRegistry.js';
import type { Command } from './CommandTypes.js';

// The registry's own rules for whose a key is, with no screen: a screen's command (one with a place but `app`) against
// one not on a definition yet, which keeps behaving as before.

test("a screen's command runs by its other keys too; an unplaced one's other keys stay its component's", async () => {
    const ran: string[] = [];
    register([listCommand('J', ran, { otherKeys: ['ArrowDown'] }), unplaced('U', ran, { otherKeys: ['ArrowUp'] })]);

    await userEvent.keyboard('j{ArrowDown}{ArrowUp}u');
    expect(ran).toEqual(['list:J', 'list:J', 'view:U']);
});

test("a screen's keys yield to a layer over the screen, its Escape to an open picker; an unplaced command's run as before", async () => {
    const ran: string[] = [];
    register([
        listCommand('J', ran),
        listCommand('Escape', ran),
        unplaced('G', ran),
        unplaced('Escape', ran, { section: 'app' }),
    ]);

    const layer = prepend('div', element => {
        element.dataset.layer = '';
    });
    await userEvent.keyboard('jg');
    expect(ran).toEqual(['view:G']);
    layer.remove();

    // A picker's Escape closes it: the screen's yields, to the app's that runs as it did.
    const picker = prepend('div', element => element.setAttribute('data-reka-popper-content-wrapper', ''));
    await userEvent.keyboard('{Escape}j');
    expect(ran).toEqual(['view:G', 'app:Escape', 'list:J']);
    picker.remove();

    await userEvent.keyboard('{Escape}');
    expect(ran).toEqual(['view:G', 'app:Escape', 'list:J', 'list:Escape']);
});

test("Enter and Space are a focused button's own, whoever's command they are", async () => {
    const ran: string[] = [];
    register([listCommand('Enter', ran), listCommand('Space', ran), unplaced('Enter', ran, { section: 'app' })]);
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
function register(commands: readonly Command[]) {
    const registry = createContainer().resolve(CommandRegistry);
    onTestFinished(registry.register({ commands, subject: null }));
}

/** A list's command, noting `list:<its key>`. */
function listCommand(key: string, ran: string[], extra: Partial<Command> = {}): Command {
    return {
        id: `list.${key}`,
        title: key,
        section: 'view',
        place: 'list',
        key,
        run: () => void ran.push(`list:${key}`),
        ...extra,
    };
}

/** A command on no definition, noting `<section>:<its key>`. */
function unplaced(key: string, ran: string[], extra: Partial<Command> = {}): Command {
    const section = extra.section ?? 'view';
    return {
        id: `${section}.${key}`,
        title: key,
        section,
        key,
        run: () => void ran.push(`${section}:${key}`),
        ...extra,
    };
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
