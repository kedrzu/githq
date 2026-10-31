import { expect, test } from 'bun:test';

import { scoreText } from './scoreText.js';

test('ranks the whole text over its start over word starts over a part over letters in order', () => {
    const scores = [
        scoreText('in progress', 'In progress'),
        scoreText('in prog', 'In progress'),
        scoreText('prog in', 'In progress'),
        scoreText('rogr', 'In progress'),
        scoreText('ipg', 'In progress'),
    ];

    expect(scores).toEqual([100, 80, 60, 40, expect.any(Number)]);
    expect(scores[4]).toBeLessThan(40);
    expect(scoreText('xyz', 'In progress')).toBeNull();
});

test('letters close together score above letters far apart', () => {
    expect(scoreText('sts', 'Set status')).toBe(18);
    expect(scoreText('sts', 'Set iteration and the status')).toBe(1);
});
