/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { RepositoryWorkflowState } from '../WorkflowTypes.js';
import { getSidebarWorkflowMarker } from './getSidebarWorkflowMarker.js';

const HEALTHY: RepositoryWorkflowState = {
    status: 'read',
    unavailable: null,
    reading: false,
    workflows: [],
    brokenCount: 0,
    hasNewBreak: false,
};

test('a repository read with nothing broken has no marker', () => {
    expect(getSidebarWorkflowMarker(HEALTHY)).toBeNull();
});

test('a break under a day old is bright, older ones quiet', () => {
    expect(getSidebarWorkflowMarker({ ...HEALTHY, brokenCount: 2, hasNewBreak: true })).toBe('new');
    expect(getSidebarWorkflowMarker({ ...HEALTHY, brokenCount: 1 })).toBe('settled');
});

test('a repository not read yet has a hollow ring', () => {
    expect(getSidebarWorkflowMarker({ ...HEALTHY, status: 'unread' })).toBe('unread');
});

test('a repository GitHub shows nothing of (Actions off, refused) never gets a marker', () => {
    expect(getSidebarWorkflowMarker({ ...HEALTHY, status: 'unavailable' })).toBeNull();
});

test('runs still being read: the ring, unless something is already known broken', () => {
    expect(getSidebarWorkflowMarker({ ...HEALTHY, reading: true })).toBe('unread');
    expect(getSidebarWorkflowMarker({ ...HEALTHY, reading: true, brokenCount: 1 })).toBe('settled');
});
