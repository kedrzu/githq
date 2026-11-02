/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { WorkflowTotals } from '../WorkflowStore.js';
import { getSidebarBrokenWorkflows } from './getSidebarBrokenWorkflows.js';

const NOTHING: WorkflowTotals = { brokenCount: 0, hasNewBreak: false, hasUnread: false, hasUnavailable: false };

test('with nothing known broken the entry is hidden, and shown on its own screen', () => {
    expect(getSidebarBrokenWorkflows(NOTHING, false)).toBeNull();
    expect(getSidebarBrokenWorkflows({ ...NOTHING, hasUnread: true }, false)).toBeNull();
    expect(getSidebarBrokenWorkflows({ ...NOTHING, hasUnavailable: true }, false)).toBeNull();

    expect(getSidebarBrokenWorkflows(NOTHING, true)).toEqual({ count: '0', tone: 'none' });
});

test('a zero is never shown before every tracked repository was read', () => {
    expect(getSidebarBrokenWorkflows({ ...NOTHING, hasUnread: true }, true)).toEqual({ count: '–', tone: 'none' });
});

test('while some repository is not read yet, the total says it can still grow', () => {
    expect(getSidebarBrokenWorkflows({ ...NOTHING, brokenCount: 1, hasUnread: true }, false)).toEqual({
        count: '1+',
        tone: 'settled',
    });
    expect(getSidebarBrokenWorkflows({ ...NOTHING, brokenCount: 3, hasUnread: true, hasNewBreak: true }, true)).toEqual(
        { count: '3+', tone: 'new' },
    );
});

test('every repository read: the plain total, red while a break is under a day old', () => {
    expect(getSidebarBrokenWorkflows({ ...NOTHING, brokenCount: 3, hasNewBreak: true }, false)).toEqual({
        count: '3',
        tone: 'new',
    });
    expect(getSidebarBrokenWorkflows({ ...NOTHING, brokenCount: 2 }, false)).toEqual({ count: '2', tone: 'settled' });
});

test('a repository GitHub shows nothing of neither adds to the total nor makes it partial', () => {
    expect(getSidebarBrokenWorkflows({ ...NOTHING, brokenCount: 2, hasUnavailable: true }, false)).toEqual({
        count: '2',
        tone: 'settled',
    });
});
