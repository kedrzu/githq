import { readFileSync } from 'node:fs';

import { expect, test } from 'bun:test';

import { USAGE_EVENTS } from '@githq/github/usageStatistics.js';

const PRIVACY_PAGE = new URL('../src/how-it-works/privacy-and-permissions.md', import.meta.url);

test('the privacy page lists every counted event in its usage statistics table', () => {
    const page = readFileSync(PRIVACY_PAGE, 'utf8');
    const section = page.split('\n## Usage statistics\n')[1]?.split('\n## ')[0] ?? '';
    const listed = [...section.matchAll(/^\|`([a-z_]+)`\|/gm)].map(match => match[1]);

    expect(listed.toSorted()).toEqual([...USAGE_EVENTS].toSorted());
});
