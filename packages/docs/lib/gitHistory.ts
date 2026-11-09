import { execFileSync } from 'node:child_process';

/** Runs `git` with the given arguments and returns what it prints. */
export type GitRunner = (args: string[]) => string;

/**
 * Throws when the repository is a shallow clone. Every page's "Updated" date comes from its last commit, and a shallow
 * clone has one commit for every file, so the site would claim every page changed on the same day.
 */
export function assertFullGitHistory(runGit: GitRunner): void {
    if (runGit(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
        throw new Error(
            'The docs need the full git history: "Updated" dates come from each page\'s last commit, and this is a ' +
                'shallow clone. Run `git fetch --unshallow`, or check out with `fetch-depth: 0` in CI.',
        );
    }
}

/** A {@link GitRunner} running `git` in `cwd`. */
export function gitIn(cwd: string): GitRunner {
    return args => execFileSync('git', args, { cwd, encoding: 'utf8' });
}
