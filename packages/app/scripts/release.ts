import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

import type { ReleaseMode } from './releasePlan.js';
import { checkTitle, findLastStableTag, hasNoCode, planRelease, renderNotes } from './releasePlan.js';

// The release CLI that CI runs with plain bun, without `bun install`:
//   release.ts check-title <title> --files <file>
//     <file> is the PR's changed paths, the output of `git diff -z --name-only --no-renames`. Outputs `code=true|false`.
//   release.ts plan --mode <preview|candidate|stable> --notes <file>
// It reads local git, its arguments and the file it is given only. Git is spawned with an argument array, never through
// a shell, so a title or a commit subject stays data.

const MODES: string[] = ['preview', 'candidate', 'stable'];
const USAGE =
    'usage: release.ts check-title <title> --files <file> | plan --mode <preview|candidate|stable> --notes <file>';

function git(...args: string[]): string[] {
    const output = execFileSync('git', args, { encoding: 'utf8' });
    return output.split('\n').filter(line => line !== '');
}

/** One line in the form GitHub Actions reports as an error, and a non-zero exit. */
function fail(message: string): never {
    console.info(`::error::${message}`);
    process.exit(1);
}

/** Prints the outcome, and shows it on the run's summary page too. */
function report(text: string) {
    console.info(text);
    if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
    }
}

function option(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
}

function isMode(value: string | undefined): value is ReleaseMode {
    return value !== undefined && MODES.includes(value);
}

function plan(args: string[]) {
    const mode = option(args, '--mode');
    const notesFile = option(args, '--notes');
    if (!isMode(mode)) {
        fail(`--mode must be one of ${MODES.join(', ')}`);
    }
    if (!notesFile) {
        fail('--notes <file> is required');
    }

    // The version grows from the last stable tag HEAD contains; candidate numbers count across every tag.
    const allTags = git('tag', '-l', 'v*');
    const mergedTags = git('tag', '-l', 'v*', '--merged', 'HEAD');
    const lastStable = findLastStableTag(mergedTags);
    const subjects = git('log', '--format=%s', lastStable ? `${lastStable}..HEAD` : 'HEAD');
    const tags = [...mergedTags, ...allTags.filter(tag => tag.includes('-'))];

    const result = planRelease({ subjects, tags, mode });
    if (result.kind === 'nothing') {
        const reason = 'Nothing to release: no feature, fix, performance or breaking change since the last stable tag.';
        if (mode === 'preview') {
            report(reason);
            return;
        }
        fail(reason);
    }

    const policyUrl = `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'kedrzu/githq'}#code-signing-policy`;
    const notes = renderNotes({ subjects, policyUrl });
    writeFileSync(notesFile, notes);

    report(`Next release: ${result.tag}\n\n${notes}`);
    // A preview outputs no tag: the jobs that build and publish key off its absence.
    if (mode !== 'preview' && process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\n`);
    }
}

function main(args: string[]) {
    const [command, ...rest] = args;
    if (command === 'check-title') {
        checkTitleCommand(rest);
    } else if (command === 'plan') {
        plan(rest);
    } else {
        fail(USAGE);
    }
}

function checkTitleCommand([title, ...options]: string[]) {
    const listFile = option(options, '--files');
    // A list that was lost must not read as an empty one, which passes.
    if (!listFile) {
        fail(USAGE);
    }

    const files = readFileSync(listFile, 'utf8')
        .split('\0')
        .filter(file => file !== '');
    const check = checkTitle(title ?? '', files);
    if (!check.valid) {
        fail(check.reason);
    }
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `code=${!hasNoCode(files)}\n`);
    }
}

if (import.meta.main) {
    main(process.argv.slice(2));
}
