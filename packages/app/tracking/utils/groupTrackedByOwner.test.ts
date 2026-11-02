/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { groupTrackedByOwner } from './groupTrackedByOwner.js';
import type { GroupTrackedByOwnerParams } from './groupTrackedByOwner.js';

const TRACKED = [
    'nuxt/nuxt',
    'fitloop/webapp',
    'mlaine/tasklet',
    'acme/web',
    'fitloop/api',
    'mlaine/Blog',
    'vitejs/vite',
];

function group(params: Partial<GroupTrackedByOwnerParams<string>> = {}) {
    return groupTrackedByOwner<string>({
        entries: TRACKED,
        getOwner: name => parseRepositoryName(name).owner,
        getName: name => parseRepositoryName(name).name,
        login: 'mlaine',
        listed: new Map([
            ['mlaine', 2],
            ['fitloop', 312],
            ['acme', null],
        ]),
        ...params,
    });
}

test('own first, then organisations, then owners the user is not in, alphabetical; rows alphabetical', () => {
    const groups = group();

    expect(groups.map(entry => [entry.login, entry.relation])).toEqual([
        ['mlaine', 'own'],
        ['acme', 'organization'],
        ['fitloop', 'organization'],
        ['nuxt', 'notMember'],
        ['vitejs', 'notMember'],
    ]);
    expect(groups[0]?.rows).toEqual(['mlaine/Blog', 'mlaine/tasklet']);
    expect(groups[2]?.rows).toEqual(['fitloop/api', 'fitloop/webapp']);
    expect(groups.map(entry => entry.ownerKind)).toEqual(['user', 'org', 'org', 'org', 'org']);
});

test('Track more only where the owner is listed and has more than what is tracked', () => {
    const groups = group();

    // Every one of the user's own tracked; acme can't be listed; nuxt and vitejs aren't the user's to list.
    expect(groups.map(entry => [entry.login, entry.total, entry.canTrackMore])).toEqual([
        ['mlaine', 2, false],
        ['acme', null, false],
        ['fitloop', 312, true],
        ['nuxt', null, false],
        ['vitejs', null, false],
    ]);
});

test('before the lists are read: the own group first, every other owner after it, alphabetical, no totals', () => {
    const groups = group({ listed: null });

    expect(groups.map(entry => [entry.login, entry.relation, entry.total, entry.canTrackMore])).toEqual([
        ['mlaine', 'own', null, false],
        ['acme', 'unknown', null, false],
        ['fitloop', 'unknown', null, false],
        ['nuxt', 'unknown', null, false],
        ['vitejs', 'unknown', null, false],
    ]);
});

test('logins match whatever their case; an owner kind is taken from the entry', () => {
    const groups = groupTrackedByOwner({
        entries: [
            { owner: 'MLaine', title: 'Roadmap', kind: 'user' as const },
            { owner: 'octocat', title: 'Ideas', kind: 'user' as const },
        ],
        getOwner: entry => entry.owner,
        getName: entry => entry.title,
        getOwnerKind: entry => entry.kind,
        login: 'mlaine',
        listed: new Map([['mlaine', 1]]),
    });

    expect(groups.map(entry => [entry.login, entry.relation, entry.ownerKind, entry.total])).toEqual([
        ['MLaine', 'own', 'user', 1],
        ['octocat', 'notMember', 'user', null],
    ]);
});
