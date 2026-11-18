import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Records the README's demo (`readme.demo.ts`) against the mocked GitHub and writes it to
// `docs/assets/readme/demo.webp`, an animated WebP: full colour where a GIF's 256 would grey out the status colours, and
// about a tenth of a GIF's size. Run with `bun run demo:readme`; needs `ffmpeg` and `img2webp` (`brew install ffmpeg
// webp`).

const E2E_DIR = path.join(import.meta.dirname, '../..');
const RESULTS_DIR = path.join(E2E_DIR, 'demo-results');
const OUTPUT = path.join(E2E_DIR, '../../docs/assets/readme/demo.webp');

/** Frames per second taken from the video; frames that barely differ from the last are dropped and held instead. */
const FPS = 20;

/** How long the last frame, the board, stays before the loop starts again, in milliseconds. */
const FINAL_HOLD_MS = 3000;

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

const video = path.join(RESULTS_DIR, run, 'video.webm');
const start = readFileSync(path.join(RESULTS_DIR, run, 'demo-start.txt'), 'utf8').trim();
const frames = mkdtempSync(path.join(tmpdir(), 'githq-demo-'));

// `showinfo` prints each kept frame's time, which becomes its duration in the WebP.
const extraction = spawnSync(
    'ffmpeg',
    [
        '-hide_banner',
        '-ss',
        start,
        '-i',
        video,
        '-vf',
        `fps=${FPS},mpdecimate=hi=64*24:lo=64*8:frac=0.2,showinfo`,
        '-fps_mode',
        'vfr',
        path.join(frames, 'f%04d.png'),
    ],
    { encoding: 'utf8' },
);
if (extraction.status !== 0) {
    throw new Error(`ffmpeg failed:\n${extraction.stderr}`);
}

const times = [...extraction.stderr.matchAll(/pts_time:([\d.]+)/g)].map(match => Number(match[1]));
const args = ['-loop', '0', '-lossy', '-q', '80', '-m', '6', '-mixed'];
for (const [index, time] of times.entries()) {
    const next = times[index + 1];
    const duration = next == null ? FINAL_HOLD_MS : Math.max(20, Math.round((next - time) * 1000));
    args.push('-d', String(duration), path.join(frames, `f${String(index + 1).padStart(4, '0')}.png`));
}

execFileSync('img2webp', [...args, '-o', OUTPUT], { stdio: 'inherit' });
rmSync(frames, { recursive: true, force: true });
console.log(`${OUTPUT}: ${times.length} frames, ${Math.round(statSync(OUTPUT).size / 1024)} KB`);
