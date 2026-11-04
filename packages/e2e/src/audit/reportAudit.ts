/**
 * Turns the output of `auditStories.ts` (or the e2e sweep) into what a person reads: failing color pairs by token, and
 * axe's results by rule. `bun packages/e2e/src/audit/reportAudit.ts [stories.json] [--all-pairs]`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PaintSample } from './measurePaint.js';

interface AxeResult {
    id: string;
    tags: string[];
    help: string;
    nodes: { html: string; target: string[]; any: { message: string }[] }[];
}

interface Audit {
    story: string;
    violations: AxeResult[];
    incomplete: AxeResult[];
    paint: (PaintSample & { state: string })[];
}

const REPO = path.join(import.meta.dirname, '../../../..');
const WCAG_TAGS = ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const input = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'));
const audits = JSON.parse(readFileSync(input ?? path.join(REPO, '.context/a11y/stories.json'), 'utf8')) as Audit[];
const tokens = readTokens();

interface Pair {
    kind: string;
    fg: string;
    bg: string;
    ratio: number;
    required: number;
    disabled: boolean;
    states: Set<string>;
    stories: Set<string>;
    classes: Map<string, number>;
    samples: Set<string>;
    sizes: Set<number>;
}

const pairs = new Map<string, Pair>();
for (const audit of audits) {
    for (const sample of audit.paint) {
        if (sample.overImage) {
            continue;
        }
        const required = requiredRatio(sample);
        const key = `${sample.kind}|${sample.fg}|${sample.bg}|${required}|${sample.disabled}`;
        const pair: Pair = pairs.get(key) ?? {
            kind: sample.kind,
            fg: sample.fg,
            bg: sample.bg,
            ratio: sample.ratio,
            required,
            disabled: sample.disabled,
            states: new Set(),
            stories: new Set(),
            classes: new Map(),
            samples: new Set(),
            sizes: new Set(),
        };
        pair.states.add(sample.state);
        pair.stories.add(audit.story);
        const className = sample.className.split(/\s+/).find(part => part.startsWith('_')) ?? sample.className;
        const component = /^_(.+?)_[a-z0-9]{5}_\d+$/.exec(className)?.[1] ?? className;
        pair.classes.set(component, (pair.classes.get(component) ?? 0) + 1);
        if (sample.sample) {
            pair.samples.add(sample.sample);
        }
        pair.sizes.add(sample.fontSize);
        pairs.set(key, pair);
    }
}

const sorted = [...pairs.values()].toSorted((a, b) => a.ratio - b.ratio);
const failing = sorted.filter(pair => pair.ratio < pair.required);
console.log(`\n## Paint: ${sorted.length} distinct pairs, ${failing.length} under their threshold\n`);
for (const pair of failing) {
    const where = [...pair.classes.entries()]
        .toSorted((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name)
        .join(', ');
    console.log(
        `${pair.ratio.toFixed(2).padStart(5)} /${pair.required} ${pair.kind.padEnd(11)} ${pair.disabled ? 'DISABLED ' : ''}${nameOf(pair.fg)} on ${nameOf(pair.bg)} [${[...pair.states].join(',')}] ${pair.stories.size} stories, ${[...pair.sizes].join('/')}px — ${where}${pair.samples.size ? ` — "${[...pair.samples].slice(0, 2).join('", "')}"` : ''}`,
    );
}

if (process.argv.includes('--all-pairs')) {
    console.log('\n## All pairs that pass\n');
    for (const pair of sorted.filter(item => item.ratio >= item.required)) {
        console.log(
            `${pair.ratio.toFixed(2).padStart(5)} /${pair.required} ${pair.kind.padEnd(11)} ${nameOf(pair.fg)} on ${nameOf(pair.bg)}`,
        );
    }
}

for (const type of ['violations', 'incomplete'] as const) {
    const rules = new Map<string, { rule: AxeResult; stories: Set<string>; nodes: number }>();
    for (const audit of audits) {
        for (const rule of audit[type]) {
            const entry = rules.get(rule.id) ?? { rule, stories: new Set(), nodes: 0 };
            entry.stories.add(audit.story);
            entry.nodes += rule.nodes.length;
            rules.set(rule.id, entry);
        }
    }
    console.log(`\n## axe ${type}, ${audits.length} stories\n`);
    for (const { rule, stories, nodes } of [...rules.values()].toSorted((a, b) => b.nodes - a.nodes)) {
        const inTags = rule.tags.some(tag => WCAG_TAGS.includes(tag));
        console.log(
            `${rule.id} ${inTags ? '[WCAG tags]' : '[outside tags]'} ${stories.size} stories, ${nodes} nodes — ${rule.help}`,
        );
    }
}

function requiredRatio(sample: PaintSample) {
    if (sample.kind !== 'text' && sample.kind !== 'placeholder') {
        return 3;
    }
    const large = sample.fontSize >= 24 || (sample.fontSize >= 18.66 && sample.fontWeight >= 700);
    return large ? 3 : 4.5;
}

function nameOf(color: string) {
    return tokens.has(color) ? `${tokens.get(color)} ${color}` : color;
}

function readTokens() {
    const source = readFileSync(path.join(REPO, 'packages/app/styles/tokens.scss'), 'utf8');
    const map = new Map<string, string>();
    for (const match of source.matchAll(/^\$color-([\w-]+):\s*(#[0-9a-f]{6});/gim)) {
        if (!map.has(match[2]!.toLowerCase())) {
            map.set(match[2]!.toLowerCase(), match[1]!);
        }
    }
    return map;
}
