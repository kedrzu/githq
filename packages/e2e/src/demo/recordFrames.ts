import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

/** One frame of a recording: its PNG in `frames/`, and when Chrome painted it, in seconds. */
export interface DemoFrame {
    readonly file: string;
    readonly time: number;
}

/** What {@link recordFrames} writes to `frames.json`: the frames, and when the recording stopped, in seconds. */
export interface DemoRecording {
    readonly frames: readonly DemoFrame[];
    readonly end: number;
}

/**
 * Records what the page paints, losslessly and at the page's device pixels: Chrome's screencast sends a PNG each time
 * the screen changes, so a still screen costs nothing and every frame comes with the time it was painted. Playwright's
 * own video is a low-bitrate VP8, whose blocks show in every dark gradient. The frames and `frames.json`
 * ({@link DemoRecording}) go to the test's output; `encodeDemo.ts` reads them. Returns what stops the recording.
 */
export async function recordFrames(page: Page, testInfo: TestInfo): Promise<() => Promise<void>> {
    const folder = testInfo.outputPath('frames');
    await mkdir(folder, { recursive: true });
    const frames: DemoFrame[] = [];
    const writes: Promise<void>[] = [];
    const session = await page.context().newCDPSession(page);
    session.on('Page.screencastFrame', frame => {
        const file = `f${String(frames.length + 1).padStart(4, '0')}.png`;
        frames.push({ file, time: frame.metadata.timestamp ?? Date.now() / 1000 });
        writes.push(writeFile(path.join(folder, file), Buffer.from(frame.data, 'base64')));
        void session.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
    });
    const viewport = page.viewportSize();
    const scale = await page.evaluate(() => window.devicePixelRatio);
    await session.send('Page.startScreencast', {
        format: 'png',
        ...(viewport && { maxWidth: viewport.width * scale, maxHeight: viewport.height * scale }),
    });

    return async () => {
        const recording: DemoRecording = { frames, end: Date.now() / 1000 };
        await session.send('Page.stopScreencast');
        await Promise.all(writes);
        await writeFile(testInfo.outputPath('frames.json'), JSON.stringify(recording));
    };
}
