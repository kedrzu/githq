import { test } from '../fixtures.js';

import { openDemo, playDemo } from './playDemo.js';
import { recordFrames } from './recordFrames.js';
import { createSampleDemoWork } from './sampleDemoWork.js';

// The README's demo ({@link playDemo}), recorded by `recordDemo.ts readme` from the frames this writes.
test('README demo', async ({ page, github }, testInfo) => {
    test.setTimeout(120_000);
    const world = createSampleDemoWork();
    await openDemo(page, github, world);
    const stopRecording = await recordFrames(page, testInfo);
    await playDemo(page, world);
    await stopRecording();
});
