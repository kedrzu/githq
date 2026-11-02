import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { launch } from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';
import type { Config, RunnerResult } from 'lighthouse';

// Measures a page as PageSpeed Insights does: Lighthouse's own defaults for mobile (a Moto G Power on slow 4G,
// the CPU 4× slower) and its desktop preset — what PSI runs, without PSI's quota. Each form factor runs a few
// times and the medians are printed, since one run is noisy; then the audits that do not pass.
//
//   bun run lighthouse                       the production shape (`bun run preview`, http://localhost:8787/)
//   bun run lighthouse https://githq.dev/    production
//   bun run lighthouse <url> --runs 5
//
// Chrome is the one installed (`CHROME_PATH` picks another). Measured locally, the CPU is faster than PSI's
// machines; the score is comparable between two runs on one machine, not with PSI's to the point.

const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { runs: { type: 'string', default: '3' } },
});

const URL_TO_MEASURE = positionals[0] ?? 'http://localhost:8787/';
const RUNS = Number(values.runs);

const FORM_FACTORS: readonly { name: string; config?: Config }[] = [
    { name: 'mobile' },
    { name: 'desktop', config: desktopConfig },
];

/** The metrics PSI shows, by audit id, with how to print each. */
const METRICS: readonly { id: string; label: string; format: (value: number) => string }[] = [
    { id: 'first-contentful-paint', label: 'FCP', format: inMilliseconds },
    { id: 'largest-contentful-paint', label: 'LCP', format: inMilliseconds },
    { id: 'total-blocking-time', label: 'TBT', format: inMilliseconds },
    { id: 'cumulative-layout-shift', label: 'CLS', format: value => value.toFixed(3) },
    { id: 'speed-index', label: 'SI', format: inMilliseconds },
    { id: 'total-byte-weight', label: 'Bytes', format: value => `${Math.round(value / 1024)} KiB` },
];

async function measure() {
    const reports = await mkdtemp(path.join(tmpdir(), 'githq-lighthouse-'));
    const chrome = await launch({ chromeFlags: ['--headless=new'] });

    try {
        for (const { name, config } of FORM_FACTORS) {
            const runs: RunnerResult['lhr'][] = [];
            for (let run = 1; run <= RUNS; run++) {
                const result = await lighthouse(
                    URL_TO_MEASURE,
                    { port: chrome.port, onlyCategories: ['performance'], output: 'html', logLevel: 'error' },
                    config,
                );
                if (!result) {
                    throw new Error(`Lighthouse returned nothing for ${URL_TO_MEASURE}`);
                }
                runs.push(result.lhr);
                await writeFile(path.join(reports, `${name}-${run}.html`), String(result.report));
            }

            printRuns(name, runs);
        }
    } finally {
        chrome.kill();
    }

    console.info(`\nReports: ${reports}`);
}

function printRuns(name: string, runs: readonly RunnerResult['lhr'][]) {
    const score = median(runs.map(run => scoreOf(run) * 100));
    const metrics = METRICS.map(({ id, label, format }) => {
        const value = median(runs.map(run => run.audits[id]?.numericValue ?? 0));
        return `${label} ${format(value)}`;
    });
    console.info(`\n${name} (median of ${runs.length}): score ${Math.round(score)} · ${metrics.join(' · ')}`);

    // The audits of the median run by score that do not pass, as PSI lists them under "Insights" and "Diagnostics".
    const middle = runs.toSorted((a, b) => scoreOf(a) - scoreOf(b))[runs.length >> 1];
    for (const audit of Object.values(middle?.audits ?? {})) {
        if (
            audit.score !== null &&
            audit.score < 0.9 &&
            ['binary', 'numeric', 'metricSavings'].includes(audit.scoreDisplayMode)
        ) {
            console.info(`  - ${audit.title}${audit.displayValue ? `: ${audit.displayValue}` : ''}`);
        }
    }
}

function scoreOf(run: RunnerResult['lhr']) {
    return run.categories.performance?.score ?? 0;
}

function median(numbers: readonly number[]) {
    const sorted = numbers.toSorted((a, b) => a - b);
    return sorted[sorted.length >> 1] ?? 0;
}

function inMilliseconds(value: number) {
    return `${Math.round(value)} ms`;
}

if (import.meta.main) {
    await measure();
}
