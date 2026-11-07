/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { Browser } from '@/services/Browser.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { DesktopHandOff } from './DesktopHandOff.js';

/** A tab with its own `sessionStorage`, recording the addresses it was sent to. */
function openTab(options: { optedIn: boolean; stayHere?: boolean }) {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const base = session.container.resolve(Browser);
    const kept = new Map<string, string>(options.stayHere ? [['githq.stayHere', 'true']] : []);
    const navigated: string[] = [];
    session.container.set(Browser, {
        ...base,
        sessionStorage: {
            getItem: key => kept.get(key) ?? null,
            setItem: (key, value) => void kept.set(key, value),
            removeItem: key => void kept.delete(key),
        },
        navigate: url => void navigated.push(url),
    });
    const preferences = session.container.resolve(LocalPreferences);
    preferences.openLinksInDesktop.value = options.optedIn;
    return { handOff: session.container.resolve(DesktopHandOff), preferences, navigated };
}

test('a first address on a shell screen is handed to the app once, however often the shell is mounted', () => {
    const { handOff, navigated } = openTab({ optedIn: true });

    handOff.recordFirstRoute('/acme/web/issues/12?x=1#c');
    handOff.handOffIfDue();
    handOff.handOffIfDue();

    expect(navigated).toEqual(['githq://acme/web/issues/12?x=1#c']);
    expect(handOff.shown).toBe(true);
});

test('a first address that was no shell screen, or none recorded, is never handed off', () => {
    const { handOff, navigated } = openTab({ optedIn: true });

    handOff.recordFirstRoute(null);
    handOff.handOffIfDue();
    handOff.handOffIfDue();

    expect(navigated).toEqual([]);
    expect(handOff.shown).toBe(false);
});

test('without the opt-in, or in a tab that chose to stay, nothing is handed off', () => {
    const off = openTab({ optedIn: false });
    off.handOff.recordFirstRoute('/');
    off.handOff.handOffIfDue();
    expect(off.navigated).toEqual([]);

    const stayed = openTab({ optedIn: true, stayHere: true });
    stayed.handOff.recordFirstRoute('/');
    stayed.handOff.handOffIfDue();
    expect(stayed.navigated).toEqual([]);
});

test('"Open here instead" is kept by the tab, and "Don\'t open links in the app" turns the opt-in off', () => {
    const first = openTab({ optedIn: true });
    first.handOff.recordFirstRoute('/');
    first.handOff.handOffIfDue();
    first.handOff.stayHere();
    expect(first.handOff.shown).toBe(false);
    expect(first.preferences.openLinksInDesktop.value).toBe(true);

    const second = openTab({ optedIn: true });
    second.handOff.recordFirstRoute('/');
    second.handOff.handOffIfDue();
    second.handOff.turnOff();
    expect(second.handOff.shown).toBe(false);
    expect(second.preferences.openLinksInDesktop.value).toBe(false);
});
