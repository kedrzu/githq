/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { isOlderVersion } from './AppUpdate.js';

test.each([
    ['0.2.0', '0.3.0-dev.214', true],
    ['0.1.9', '0.1.10', true],
    ['0.9.0', '0.10.0', true],
    ['0.1.0', '0.1.0-dev.214', false],
    ['0.3.0', '0.3.0-dev.214', false],
    ['1.0.0', '0.9.9', false],
])('%s older than %s: %p', (version, other, older) => {
    expect(isOlderVersion(version, other)).toBe(older);
});
