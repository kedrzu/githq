/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getReasonTitle } from './getReasonTitle.js';

test('PM25: the first line of GitHub’s reason, trimmed; empty for an empty message', () => {
    expect(getReasonTitle('\n Repository rule violations found\n\nAt least 2 approving reviews are required.')).toBe(
        'Repository rule violations found',
    );
    expect(getReasonTitle('Head branch was modified.')).toBe('Head branch was modified.');
    expect(getReasonTitle('  ')).toBe('');
});
