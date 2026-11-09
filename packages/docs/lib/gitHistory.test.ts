import { expect, test } from 'bun:test';

import { assertFullGitHistory } from './gitHistory.js';

test('a shallow clone fails the build', () => {
    const asked: string[][] = [];
    const runGit = (args: string[]) => {
        asked.push(args);
        return 'true\n';
    };

    expect(() => assertFullGitHistory(runGit)).toThrow(/full git history/);
    expect(asked).toEqual([['rev-parse', '--is-shallow-repository']]);
});

test('a full clone passes', () => {
    expect(() => assertFullGitHistory(() => 'false\n')).not.toThrow();
});
