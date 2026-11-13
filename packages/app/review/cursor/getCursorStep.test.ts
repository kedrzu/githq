import { expect, test } from 'bun:test';

import { getCursorStep } from './getCursorStep.js';

test('a press moves one stop, and so does a hold until 400 ms; then a stop more every 250 ms, up to six', () => {
    const steps = [0, 30, 399, 400, 649, 650, 900, 1150, 1400, 1650, 10_000].map(getCursorStep);

    expect(steps).toEqual([1, 1, 1, 2, 2, 3, 4, 5, 6, 6, 6]);
});
