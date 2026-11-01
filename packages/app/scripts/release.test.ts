import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CLI = path.join(import.meta.dirname, 'release.ts');

// Never inherit anything that could point git at the real repository.
function cleanEnv(extra: Record<string, string> = {}): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && !key.startsWith('GIT_') && !key.startsWith('GITHUB_')) {
            env[key] = value;
        }
    }
    return { ...env, ...extra };
}

let dir: string;

beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'release-cli-'));
    git('init', '--initial-branch=main');
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

function git(...args: string[]) {
    const result = spawnSync(
        'git',
        [
            '-c',
            'user.name=Test',
            '-c',
            'user.email=test@example.com',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'tag.gpgsign=false',
            ...args,
        ],
        { cwd: dir, env: cleanEnv(), encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
}

function commit(subject: string) {
    git('commit', '--allow-empty', '--no-verify', '-m', subject);
}

function run(args: string[], extra: Record<string, string> = {}) {
    const result = spawnSync('bun', [CLI, ...args], { cwd: dir, env: cleanEnv(extra), encoding: 'utf8' });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function plan(mode: string) {
    const notes = path.join(dir, '..', `${path.basename(dir)}-notes.md`);
    const output = path.join(dir, '..', `${path.basename(dir)}-output`);
    const result = run(['plan', '--mode', mode, '--notes', notes], { GITHUB_OUTPUT: output });
    const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);
    const files = { notes: read(notes), output: read(output) };
    rmSync(notes, { force: true });
    rmSync(output, { force: true });
    return { ...result, ...files };
}

describe('check-title', () => {
    test('accepts a conventional title', () => {
        expect(run(['check-title', 'feat: add things']).status).toBe(0);
    });

    test('rejects a bad title with one ::error:: line', () => {
        const result = run(['check-title', 'Add things; $(rm -rf /)']);
        expect(result.status).not.toBe(0);
        const lines = result.stdout.trim().split('\n');
        expect(lines).toHaveLength(1);
        expect(lines[0]).toStartWith('::error::');
    });
});

describe('plan', () => {
    test('reads conventional and old-style subjects and outputs the tag', () => {
        commit('Old style title');
        commit('feat: add search (#3)');
        commit('fix: crash on start');
        const result = plan('stable');
        expect(result.status).toBe(0);
        expect(result.output).toBe('tag=v0.1.0\n');
        expect(result.notes).toContain('- Add search (#3)');
        expect(result.notes).toContain('- Crash on start');
        expect(result.notes).not.toContain('Old style');
        expect(result.notes).toContain('https://github.com/kedrzu/githq#code-signing-policy');
        expect(result.stdout).toContain('v0.1.0');
    });

    test('counts candidates across the tags and ignores commits before the last stable tag', () => {
        commit('feat: first');
        git('tag', 'v0.1.0');
        commit('fix: later');
        git('tag', 'v0.1.1-rc.1');
        const result = plan('candidate');
        expect(result.output).toBe('tag=v0.1.1-rc.2\n');
        expect(result.notes).toContain('Later');
        expect(result.notes).not.toContain('First');
    });

    test('preview prints the tag and notes but outputs no tag', () => {
        commit('feat: first');
        const result = plan('preview');
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('v0.1.0');
        expect(result.notes).toContain('First');
        expect(result.output).toBeUndefined();
    });

    test('nothing to release fails for stable and candidate without output or notes', () => {
        commit('feat: first');
        git('tag', 'v0.1.0');
        commit('chore: housekeeping');
        for (const mode of ['stable', 'candidate']) {
            const result = plan(mode);
            expect(result.status).not.toBe(0);
            expect(result.stdout.trim().split('\n')).toHaveLength(1);
            expect(result.stdout).toStartWith('::error::');
            expect(result.output).toBeUndefined();
            expect(result.notes).toBeUndefined();
        }
    });

    test('nothing to release in a preview says so and exits zero', () => {
        commit('chore: housekeeping');
        const result = plan('preview');
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Nothing to release');
        expect(result.output).toBeUndefined();
        expect(result.notes).toBeUndefined();
    });

    test('rejects an unknown mode and a missing notes file', () => {
        commit('feat: first');
        const mode = run(['plan', '--mode', 'bogus', '--notes', 'x.md']);
        expect(mode.status).not.toBe(0);
        expect(mode.stdout).toStartWith('::error::');
        const notes = run(['plan', '--mode', 'stable']);
        expect(notes.status).not.toBe(0);
        expect(notes.stdout).toStartWith('::error::');
    });
});
