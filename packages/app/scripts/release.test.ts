import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
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

function checkTitle(title: string, list: string) {
    const files = path.join(dir, 'files');
    const output = path.join(dir, 'output');
    writeFileSync(files, list);
    const result = run(['check-title', title, '--files', files], { GITHUB_OUTPUT: output });
    return { ...result, output: existsSync(output) ? readFileSync(output, 'utf8') : undefined };
}

function expectOneError(status: number | null, stdout: string) {
    expect(status).not.toBe(0);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toStartWith('::error::');
}

describe('check-title', () => {
    test('accepts a conventional title and outputs that it touches code', () => {
        const result = checkTitle('feat: add things', 'README.md\0src/a.ts\0');
        expect(result.status).toBe(0);
        expect(result.output).toBe('code=true\n');
    });

    test('rejects a bad title with one ::error:: line and no output', () => {
        const result = checkTitle('Add things; $(rm -rf /)', 'src/a.ts\0');
        expectOneError(result.status, result.stdout);
        expect(result.output).toBeUndefined();
    });

    test('reads a NUL-separated list with a non-ASCII path, naming the path whole', () => {
        const result = checkTitle('docs: add things', 'README.md\0packages/zażółć.ts\0');
        expectOneError(result.status, result.stdout);
        expect(result.stdout).toContain('"packages/zażółć.ts"');
        expect(result.stdout).not.toContain('README.md');
    });

    test('outputs no code for a list of only documentation', () => {
        const result = checkTitle('docs: add things', 'README.md\0docs/zażółć.png\0');
        expect(result.status).toBe(0);
        expect(result.output).toBe('code=false\n');
    });

    test('an empty file is an empty list: nothing rejected, counted as code', () => {
        const result = checkTitle('docs: add things', '');
        expect(result.status).toBe(0);
        expect(result.output).toBe('code=true\n');
    });

    test.each([
        [['check-title', 'feat: a']],
        [['check-title', 'feat: a', '--files']],
        [['check-title', '--files', 'x']],
    ])('%p fails with the usage line rather than reading as an empty list', args => {
        const result = run(args);
        expectOneError(result.status, result.stdout);
        expect(result.stdout).toContain('usage:');
    });

    test('a list that cannot be read fails and outputs nothing', () => {
        const output = path.join(dir, 'output');
        const result = run(['check-title', 'feat: a', '--files', path.join(dir, 'missing')], { GITHUB_OUTPUT: output });
        expect(result.status).not.toBe(0);
        expect(existsSync(output)).toBe(false);
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

    test('ignores commits before the last stable tag', () => {
        commit('feat: first');
        git('tag', 'v0.1.0');
        commit('fix: later');
        const result = plan('stable');
        expect(result.output).toBe('tag=v0.1.1\n');
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

    test('nothing to release fails for stable without output or notes', () => {
        commit('feat: first');
        git('tag', 'v0.1.0');
        commit('chore: housekeeping');
        const result = plan('stable');
        expect(result.status).not.toBe(0);
        expect(result.stdout.trim().split('\n')).toHaveLength(1);
        expect(result.stdout).toStartWith('::error::');
        expect(result.output).toBeUndefined();
        expect(result.notes).toBeUndefined();
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

describe('development-plan', () => {
    function developmentPlan(list: string) {
        const files = path.join(dir, 'files');
        const output = path.join(dir, 'output');
        writeFileSync(files, list);
        const result = run(['development-plan', '--files', files], { GITHUB_OUTPUT: output });
        return { ...result, output: existsSync(output) ? readFileSync(output, 'utf8') : undefined };
    }

    test('outputs the next minor with the commit count of HEAD, from the merged tags only', () => {
        commit('feat: first');
        git('tag', 'v0.2.0');
        commit('fix: second');
        git('tag', 'v0.9.0');
        git('reset', '--hard', 'HEAD~1');
        commit('Old style title');
        const result = developmentPlan('a.ts\0');
        expect(result.status).toBe(0);
        expect(result.output).toBe('version=0.3.0-dev.2\nbuild=true\n');
    });

    test('a documentation-only list builds nothing, whatever the commit titles say', () => {
        commit('feat: first');
        const result = developmentPlan('docs/a.md\0README.md\0');
        expect(result.output).toBe('version=0.1.0-dev.1\nbuild=false\n');
    });

    test('a missing list fails with the usage line and outputs nothing', () => {
        commit('feat: first');
        const output = path.join(dir, 'output');
        const result = run(['development-plan'], { GITHUB_OUTPUT: output });
        expectOneError(result.status, result.stdout);
        expect(result.stdout).toContain('usage:');
        expect(existsSync(output)).toBe(false);
    });
});
