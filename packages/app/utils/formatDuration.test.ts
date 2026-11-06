/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { formatDuration } from './formatDuration.js';

test('a duration reads in its largest unit and the next, seconds two wide after minutes', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(134_000)).toBe('2m 14s');
    expect(formatDuration(362_000)).toBe('6m 02s');
    expect(formatDuration(3_900_000)).toBe('1h 5m');
    expect(formatDuration(-5)).toBe('0s');
});

test('floored, a duration moves to the next unit only once it holds a whole one', () => {
    expect(formatDuration(59_999)).toBe('59s');
    expect(formatDuration(60_000)).toBe('1m 00s');
    expect(formatDuration(3_599_999)).toBe('59m 59s');
    expect(formatDuration(3_600_000)).toBe('1h 0m');
    expect(formatDuration(59_999, { units: 1 })).toBe('59s');
    expect(formatDuration(3_599_999, { units: 1 })).toBe('59m');
});

test('rounded to one unit, the unit is chosen after rounding: never 60 sec or 60 min', () => {
    const timeLeft = (seconds: number) =>
        formatDuration(seconds * 1000, { units: 1, display: 'short', rounding: 'round' });
    expect(timeLeft(45)).toBe('45 sec');
    expect(timeLeft(59.4)).toBe('59 sec');
    expect(timeLeft(59.5)).toBe('1 min');
    expect(timeLeft(89)).toBe('1 min');
    expect(timeLeft(90)).toBe('2 min');
    expect(timeLeft(1800)).toBe('30 min');
    expect(timeLeft(3569)).toBe('59 min');
    expect(timeLeft(3570)).toBe('1 hr');
    expect(timeLeft(3599)).toBe('1 hr');
    expect(timeLeft(3600)).toBe('1 hr');
    expect(timeLeft(5399)).toBe('1 hr');
    expect(timeLeft(5400)).toBe('2 hr');
    expect(formatDuration(3570_000, { units: 1, rounding: 'round' })).toBe('1h');
});

test('rounded up and held to minutes, a duration counts whole minutes past the hour', () => {
    const minutes = (ms: number) =>
        formatDuration(ms, { units: 1, display: 'short', rounding: 'ceil', largestUnit: 'minute' });
    expect(minutes(60_000)).toBe('1 min');
    expect(minutes(61_000)).toBe('2 min');
    expect(minutes(18 * 60_000)).toBe('18 min');
    expect(minutes(3_600_000)).toBe('60 min');
    expect(minutes(75 * 60_000)).toBe('75 min');
});
