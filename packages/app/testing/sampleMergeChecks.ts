import type { MergeCheck } from '@/merge/MergeTypes.js';

/** The checks the base branch requires in the samples, as `workflow / name`. */
const SAMPLE_REQUIRED_CHECKS = [
    'ci / test (node 20)',
    'ci / lint',
    'ci / typecheck',
    'ci / build',
    'ci / e2e (chromium)',
];

/** The checks that aren't required in the samples. */
const SAMPLE_OTHER_CHECKS = ['CircleCI / nightly-smoke', 'CodeQL', 'Vercel / preview', 'codecov/patch'];

/** Nine checks that passed, five of them required. */
export const SAMPLE_PASSED_CHECKS: readonly MergeCheck[] = [
    ...SAMPLE_REQUIRED_CHECKS.map(name => sampleMergeCheck(name, { isRequired: true })),
    ...SAMPLE_OTHER_CHECKS.map(name => sampleMergeCheck(name, {})),
];

/**
 * A check as the merge panel's read brings it: passed, run by GitHub Actions in a hundred seconds, not required.
 * `fullName` is `workflow / name`, or the name alone.
 */
export function sampleMergeCheck(fullName: string, overrides: Partial<MergeCheck>): MergeCheck {
    const [workflow, name] = fullName.includes(' / ') ? fullName.split(' / ') : [null, fullName];
    return {
        id: `CR_${fullName}`,
        kind: 'checkRun',
        name: name ?? fullName,
        workflow: workflow ?? null,
        state: 'passing',
        cancelled: false,
        url: `https://github.com/fitloop/api/actions/runs/1/${encodeURIComponent(fullName)}`,
        startedAt: '2026-11-02T11:50:00Z',
        completedAt: '2026-11-02T11:51:40Z',
        isRequired: false,
        appSlug: 'github-actions',
        workflowRunId: 1,
        ...overrides,
    };
}
