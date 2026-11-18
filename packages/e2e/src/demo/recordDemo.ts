import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { DemoRecording } from './recordFrames.js';

// Records the demo pictures against the mocked GitHub, losslessly, and encodes them once:
// - `readme` (`readme.demo.ts`) into `docs/assets/readme/`: `demo.webp`, an animated WebP, lossless, so no block shows in
//   the dark gradients — it plays and loops by itself in the README, as a video on GitHub does not —, and `demo.mp4`,
//   for where a video goes (a launch post);
// - `landing` (`landing.demo.ts`) into `packages/app/public/landing/`: the hero's recording as `hero.av1.mp4` and, for
//   browsers without AV1, `hero.mp4` (H.264), its first frame as `hero.webp`, the still the page paints first, and the
//   features' screenshots as `<name>.webp`.
// Run with `bun run demo:readme` or `bun run demo:landing`; needs `ffmpeg` and `libwebp` (`brew install ffmpeg webp`).

const E2E_DIR = path.join(import.meta.dirname, '../..');
const RESULTS_DIR = path.join(E2E_DIR, 'demo-results');
const README_DIR = path.join(E2E_DIR, '../../docs/assets/readme');
const LANDING_DIR = path.join(E2E_DIR, '../app/public/landing');

/** How long the last frame, the board, stays before the loop starts again, in seconds. */
const FINAL_HOLD = 3;

/** The video's frame rate: a constant one, which every player takes. */
const VIDEO_FPS = 30;

const target = process.argv[2];
if (target !== 'readme' && target !== 'landing') {
    throw new Error('Usage: bun recordDemo.ts <readme|landing>');
}

for (const tool of ['ffmpeg', 'img2webp', 'cwebp']) {
    if (spawnSync(tool, ['-version']).error) {
        throw new Error(`${tool} is missing: brew install ffmpeg webp`);
    }
}

rmSync(RESULTS_DIR, { recursive: true, force: true });
execFileSync('bunx', ['playwright', 'test', '-c', 'playwright.demo.config.ts', `src/demo/${target}.demo.ts`], {
    cwd: E2E_DIR,
    stdio: 'inherit',
});

const written = target === 'readme' ? encodeReadme() : encodeLanding();
for (const file of written) {
    console.log(`${path.relative(process.cwd(), file)}: ${Math.round(statSync(file).size / 1024)} KB`);
}

/** The README's animated WebP and its video. */
function encodeReadme() {
    const { runDir, recording } = readRecording();
    const webp = path.join(README_DIR, 'demo.webp');
    const end = recording.end + FINAL_HOLD;
    // Each frame for as long as it stayed on the screen.
    const webpArgs = ['-loop', '0', '-lossless', '-m', '6'];
    for (const [index, frame] of recording.frames.entries()) {
        const until = recording.frames[index + 1]?.time ?? end;
        webpArgs.push('-d', String(Math.max(1, Math.round((until - frame.time) * 1000))));
        webpArgs.push(path.join(runDir, 'frames', frame.file));
    }
    execFileSync('img2webp', [...webpArgs, '-o', webp], { stdio: 'inherit' });

    const mp4 = path.join(README_DIR, 'demo.mp4');
    encodeVideo(runDir, recording, sequence => {
        // prettier-ignore
        execFileSync('ffmpeg', [
            '-v', 'error', '-y', '-framerate', String(VIDEO_FPS), '-i', sequence,
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', mp4,
        ]);
    });
    return [webp, mp4];
}

/**
 * The hero's two videos and its still, and the features' screenshots. The videos are lossy, as no loop of this size
 * plays from a WebP: AV1 where the browser has it, H.264 for the rest — Safari without AV1 hardware among them. The
 * still is the videos' first frame, so the page swaps one for the other without a jump.
 */
function encodeLanding() {
    const { runDir, recording } = readRecording();
    const av1 = path.join(LANDING_DIR, 'hero.av1.mp4');
    const h264 = path.join(LANDING_DIR, 'hero.mp4');
    encodeVideo(runDir, recording, sequence => {
        const input = ['-v', 'error', '-y', '-framerate', String(VIDEO_FPS), '-i', sequence];
        // prettier-ignore
        execFileSync('ffmpeg', [
            ...input, '-c:v', 'libsvtav1', '-preset', '4', '-crf', '40', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', '-an', av1,
        ], { stdio: ['ignore', 'ignore', 'inherit'] });
        // prettier-ignore
        execFileSync('ffmpeg', [
            ...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'animation', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', '-an', h264,
        ]);
    });

    const still = path.join(LANDING_DIR, 'hero.webp');
    const first = recording.frames[0];
    if (!first) {
        throw new Error('The hero recording has no frames');
    }
    toWebp(path.join(runDir, 'frames', first.file), still);

    const shotsDir = path.join(RESULTS_DIR, 'landing-shots');
    const shots = readdirSync(shotsDir).map(file => {
        const webp = path.join(LANDING_DIR, `${path.basename(file, '.png')}.webp`);
        toWebp(path.join(shotsDir, file), webp);
        return webp;
    });
    return [av1, h264, still, ...shots];
}

/** The recording of the run's one test that made one ({@link DemoRecording}), and its folder. */
function readRecording() {
    const runDir = readdirSync(RESULTS_DIR)
        .map(entry => path.join(RESULTS_DIR, entry))
        .find(entry => existsSync(path.join(entry, 'frames.json')));
    if (!runDir) {
        throw new Error(`The demo left no recording in ${RESULTS_DIR}`);
    }

    const recording = JSON.parse(readFileSync(path.join(runDir, 'frames.json'), 'utf8')) as DemoRecording;
    return { runDir, recording };
}

/**
 * Lays the frame on the screen at each tick of the video's clock out as a numbered sequence, hands its `ffmpeg` input
 * pattern to `encode`, and removes it again. The last frame stays {@link FINAL_HOLD} seconds.
 */
function encodeVideo(runDir: string, recording: DemoRecording, encode: (sequence: string) => void) {
    const { frames } = recording;
    const end = recording.end + FINAL_HOLD;
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

    encode(path.join(sequence, '%05d.png'));
    rmSync(sequence, { recursive: true, force: true });
}

/** A source for `NuxtImg`, which resizes and re-encodes it: near lossless, so that is the only loss. */
function toWebp(png: string, webp: string) {
    execFileSync('cwebp', ['-quiet', '-q', '92', '-m', '6', png, '-o', webp]);
}
