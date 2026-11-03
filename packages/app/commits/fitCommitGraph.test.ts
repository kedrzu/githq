/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { fitCommitGraph, getCommitGraphWidth } from './fitCommitGraph.js';

test('a tenth of the pane: the lanes that fit, those past them folded', () => {
    expect(fitCommitGraph({ share: 0.1, paneWidth: 1200, totalLanes: 14 })).toEqual({
        width: 120,
        lanes: 8,
        maxWidth: getCommitGraphWidth(14),
        maxLanes: 14,
    });
});

test('never wider than every lane needs, whatever the share', () => {
    const fit = fitCommitGraph({ share: 0.9, paneWidth: 1200, totalLanes: 3 });
    expect(fit.width).toBe(getCommitGraphWidth(3));
    expect(fit.lanes).toBe(3);
});

test('never narrower than two lanes, the default branch and the fold, whatever the share or the pane', () => {
    for (const options of [
        { share: 0, paneWidth: 1200, totalLanes: 14 },
        { share: 0.1, paneWidth: 0, totalLanes: 14 },
    ]) {
        const fit = fitCommitGraph(options);
        expect(fit.width).toBe(getCommitGraphWidth(2));
        expect(fit.lanes).toBe(2);
    }
});

test('a repository of one lane has one lane, or none', () => {
    for (const totalLanes of [0, 1]) {
        const fit = fitCommitGraph({ share: 0, paneWidth: 1200, totalLanes });
        expect(fit.width).toBe(getCommitGraphWidth(1));
        expect(fit.lanes).toBe(1);
    }
});

test('in a narrow pane the rows keep their room, every lane or not', () => {
    const fit = fitCommitGraph({ share: 1, paneWidth: 400, totalLanes: 40 });
    expect(fit.width).toBe(160);
    expect(fit.maxLanes).toBe(12);
    expect(fit.lanes).toBe(12);
});

test('a width set from a lane count reads back as that many lanes in any pane', () => {
    for (const paneWidth of [701, 977, 1200, 1283, 1733, 2561]) {
        for (let lanes = 2; lanes <= 30; lanes++) {
            const share = getCommitGraphWidth(lanes) / paneWidth;
            expect(fitCommitGraph({ share, paneWidth, totalLanes: 30 }).lanes).toBe(
                Math.min(lanes, fitCommitGraph({ share: 1, paneWidth, totalLanes: 30 }).maxLanes),
            );
        }
    }
});
