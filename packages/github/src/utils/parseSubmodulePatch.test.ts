import { expect, test } from 'bun:test';

import { parseSubmodulePatch } from './parseSubmodulePatch.js';
import type { SubmodulePointers } from './parseSubmodulePatch.js';

const OLD = 'a3eadfaf9fff361ddb426fc8e7b0674553cbd06b';
const NEW = '7e8461f875e0be7b57c8a2d2c6afa05ff4cc47ef';

test('reads a moved, an added and a removed submodule pointer', () => {
    const moved: SubmodulePointers = { before: OLD, after: NEW };
    const added: SubmodulePointers = { before: null, after: NEW };
    const removed: SubmodulePointers = { before: OLD, after: null };

    expect(parseSubmodulePatch(`@@ -1 +1 @@\n-Subproject commit ${OLD}\n+Subproject commit ${NEW}`)).toEqual(moved);
    expect(parseSubmodulePatch(`@@ -1 +1 @@\r\n-Subproject commit ${OLD}\r\n+Subproject commit ${NEW}\n`)).toEqual(
        moved,
    );
    expect(parseSubmodulePatch(`@@ -0,0 +1 @@\n+Subproject commit ${NEW}`)).toEqual(added);
    expect(parseSubmodulePatch(`@@ -1 +0,0 @@\n-Subproject commit ${OLD}`)).toEqual(removed);
});

test('anything more or less than a gitlink change is not one', () => {
    const patches = [
        '',
        '@@ -1 +1 @@\n-a\n+b',
        // A text file that happens to hold the line, with more around it.
        `@@ -1,2 +1,2 @@\n-Subproject commit ${OLD}\n+Subproject commit ${NEW}\n context`,
        `-Subproject commit ${OLD}\n+Subproject commit ${NEW}`,
        `@@ -1 +1 @@\n+Subproject commit ${NEW}\n-Subproject commit ${OLD}`,
        `@@ -1 +1 @@\n+Subproject commit ${NEW}\n+Subproject commit ${OLD}`,
        `@@ -1 +1 @@\n-Subproject commit ${OLD.slice(1)}\n+Subproject commit ${NEW}`,
        '@@ -1 +1 @@',
    ];

    for (const patch of patches) {
        expect(parseSubmodulePatch(patch)).toBeNull();
    }
});
