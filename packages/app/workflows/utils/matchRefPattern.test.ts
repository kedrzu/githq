/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { matchRefPattern } from './matchRefPattern.js';

test.each([
    ['main', 'main', true],
    ['main', 'main-2', false],
    ['main', 'xmain', false],
    // `*` matches anything but `/`, nothing too.
    ['release/*', 'release/1.2', true],
    ['release/*', 'release/1.2/hotfix', false],
    ['release/*', 'release/', true],
    ['v*', 'v', true],
    ['v*', 'v0.1.0-rc.3', true],
    ['v*', 'v2-experiment', true],
    ['v*', 'feature/v2', false],
    ['*', 'feature/x', false],
    // `**` matches anything.
    ['release/**', 'release/1.2/hotfix', true],
    ['**', 'feature/x/y', true],
    ['**-hotfix', 'release/1.2-hotfix', true],
    // `?` makes the character before it optional, `+` repeats it.
    ['releases?/*', 'release/1', true],
    ['releases?/*', 'releases/1', true],
    ['releases?/*', 'releasess/1', false],
    ['v1+', 'v111', true],
    ['v1+', 'v', false],
    // A character class: one letter or digit listed or in a range.
    ['v[0-9].*', 'v1.0', true],
    ['v[0-9].*', 'vx.0', false],
    ['v[0-9]+.[0-9]+', 'v12.34', true],
    ['[abc]', 'b', true],
    ['[abc]', 'd', false],
    // Literal characters stay literal: a dot is a dot.
    ['v1.0', 'v1x0', false],
    ['v1.0', 'v1.0', true],
    ['(a|b)', '(a|b)', true],
    ['\\*', '*', true],
    ['\\*', 'x', false],
    // Malformed classes and a quantifier with nothing before it are literal.
    ['[', '[', true],
    ['[z-a]', '[z-a]', true],
    ['?', '?', true],
    ['*?', 'x?', true],
] as const)('%p matching %p is %p', (pattern, ref, matches) => {
    expect(matchRefPattern(pattern, ref)).toBe(matches);
});
