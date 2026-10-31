/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { isCurrentIteration } from './isCurrentIteration.js';

test('an iteration is current from its first day to the end of its last', () => {
    const iteration = { startDate: '2026-10-26', duration: 14 };
    expect(isCurrentIteration(iteration, Date.parse('2026-10-25T23:59:59Z'))).toBe(false);
    expect(isCurrentIteration(iteration, Date.parse('2026-10-26T00:00:00Z'))).toBe(true);
    expect(isCurrentIteration(iteration, Date.parse('2026-11-08T23:59:59Z'))).toBe(true);
    expect(isCurrentIteration(iteration, Date.parse('2026-11-09T00:00:00Z'))).toBe(false);
});
