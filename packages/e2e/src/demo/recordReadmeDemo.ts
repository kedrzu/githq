import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { DemoRecording } from './readme.demo.js';

// Records the README's demo (`readme.demo.ts`) against the mocked GitHub, frame by frame and losslessly, and encodes it
// once into each of:
// - `docs/assets/readme/demo.webp`, the README's: an animated WebP, lossless, so no block shows in the dark gradients;
//   it plays and loops by itself, as a video on GitHub does not;
// - `docs/assets/readme/demo.mp4`, for where a video goes (a launch post, the landing page): H.264 at 30 frames a
//   second.
// Run with `bun run demo:readme`; needs `ffmpeg` and `img2webp` (`brew install ffmpeg webp`).

const E2E_DIR = path.join(import.meta.dirname, '../..');
const RESULTS_DIR = path.join(E2E_DIR, 'demo-results');
const ASSETS_DIR = path.join(E2E_DIR, '../../docs/assets/readme');

/** How long the last frame, the board, stays before the loop starts again, in seconds. */
const FINAL_HOLD = 3;

/** The video's frame rate: a constant one, which every player takes. */
const VIDEO_FPS = 30;

for (const tool of ['ffmpeg', 'img2webp']) {
    if (spawnSync(tool, ['-version']).error) {
        throw new Error(`${tool} is missing: brew install ffmpeg webp`);
    }
}

rmSync(RESULTS_DIR, { recursive: true, force: true });
execFileSync('bunx', ['playwright', 'test', '-c', 'playwright.demo.config.ts'], { cwd: E2E_DIR, stdio: 'inherit' });

const run = readdirSync(RESULTS_DIR).find(entry => statSync(path.join(RESULTS_DIR, entry)).isDirectory());
if (!run) {
    throw new Error(`The demo left no recording in ${RESULTS_DIR}`);
}

const runDir = path.join(RESULTS_DIR, run);
const recording = JSON.parse(readFileSync(path.join(runDir, 'frames.json'), 'utf8')) as DemoRecording;
const { frames } = recording;
const end = recording.end + FINAL_HOLD;

// Each frame for as long as it stayed on the screen.
const webp = path.join(ASSETS_DIR, 'demo.webp');
const webpArgs = ['-loop', '0', '-lossless', '-m', '6'];
for (const [index, frame] of frames.entries()) {
    const until = frames[index + 1]?.time ?? end;
    webpArgs.push('-d', String(Math.max(1, Math.round((until - frame.time) * 1000))));
    webpArgs.push(path.join(runDir, 'frames', frame.file));
}
execFileSync('img2webp', [...webpArgs, '-o', webp], { stdio: 'inherit' });

// The frame on the screen at each tick of the video's clock, as a numbered sequence for ffmpeg.
const sequence = mkdtempSync(path.join(tmpdir(), 'githq-demo-'));
const start = frames[0]?.time ?? 0;
let shown = 0;
for (let tick = 0; start + tick / VIDEO_FPS < end; tick++) {
    while ((frames[shown + 1]?.time ?? Infinity) <= start + tick / VIDEO_FPS) {
        shown++;
    }

    const file = frames[shown]?.file;
    if (file) {
        symlinkSync(path.join(runDir, 'frames', file), path.join(sequence, `${String(tick).padStart(5, '0')}.png`));
    }
}

const mp4 = path.join(ASSETS_DIR, 'demo.mp4');
// prettier-ignore
execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-framerate', String(VIDEO_FPS), '-i', path.join(sequence, '%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', mp4,
]);
rmSync(sequence, { recursive: true, force: true });

for (const file of [webp, mp4]) {
    console.log(`${file}: ${Math.round(statSync(file).size / 1024)} KB`);
}
