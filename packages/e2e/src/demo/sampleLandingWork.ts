import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import type { SampleReviewFile } from '../review/answerReview.js';

import { DEMO_ISSUE, DEMO_PROJECT } from './sampleDemoWork.js';

/** The pull request whose review the landing page shows, in the middle of its stack. */
export const LANDING_REVIEW = { repository: 'fitloop/webapp', number: 1202, title: 'Sync: queue edits made offline' };

/** The files {@link LANDING_REVIEW} changes, as its review reads them. */
export const LANDING_REVIEW_FILES: readonly SampleReviewFile[] = [
    {
        path: 'src/sync/engine.ts',
        before: [
            "import { db } from '../db/client';",
            "import { PendingStore } from './pending';",
            "import type { Workout } from '../types';",
            '',
            'const MAX_BATCH = 20;',
            'const RETRY_DELAY_MS = 2_000;',
            '',
            'export class SyncEngine {',
            '  private pending = new PendingStore(db);',
            '  private conflicts: Workout[] = [];',
            '  private running = false;',
            '',
            '  async flush(): Promise<void> {',
            '    if (this.running) return;',
            '    this.running = true;',
            '    const items = await this.pending.take(MAX_BATCH);',
            '    await this.send(items);',
            '    this.running = false;',
            '  }',
            '}',
            '',
        ].join('\n'),
        after: [
            "import { db } from '../db/client';",
            "import { Outbox } from './outbox';",
            "import { replayQueue } from './replay';",
            "import type { Workout } from '../types';",
            '',
            'const MAX_BATCH = 50;',
            'const RETRY_DELAY_MS = 2_000;',
            '',
            'export class SyncEngine {',
            '  private outbox = new Outbox(db);',
            '  private conflicts: Workout[] = [];',
            '  private running = false;',
            '',
            '  async flush(): Promise<void> {',
            '    if (this.running) return;',
            '    this.running = true;',
            '    const items = await this.outbox.drain(MAX_BATCH);',
            '    await replayQueue(items, { retryAfter: RETRY_DELAY_MS });',
            '    this.running = false;',
            '  }',
            '}',
            '',
        ].join('\n'),
    },
    {
        path: 'src/sync/outbox.ts',
        before: null,
        after: [
            "import type { Database } from '../db/client';",
            '',
            '/** Edits made offline, kept until GitHub has them. */',
            'export class Outbox {',
            '  constructor(private readonly db: Database) {}',
            '',
            '  async drain(limit: number) {',
            "    return this.db.outbox.orderBy('createdAt').limit(limit).toArray();",
            '  }',
            '}',
            '',
        ].join('\n'),
        changeType: 'ADDED',
    },
    {
        path: 'src/sync/pending.ts',
        before: 'export class PendingStore {}\n',
        after: null,
        changeType: 'DELETED',
    },
    {
        path: 'package.json',
        before: '{\n  "name": "webapp",\n  "version": "4.1.0"\n}\n',
        after: '{\n  "name": "webapp",\n  "version": "4.2.0"\n}\n',
    },
    {
        path: 'README.md',
        before: '# webapp\n',
        after: '# webapp\n\nWorks offline: see docs/sync.md.\n',
        viewed: 'VIEWED',
    },
];

/**
 * The landing page's world: a busy "My work" across five repositories — the viewer's `octocat/tasklet` and
 * `octocat/mdlint` (tracked on the first sign-in, with the project {@link DEMO_PROJECT}, shown as a board first) and
 * `fitloop/webapp`, `fitloop/api` and `fitloop/mobile` —, workflows failing on main, pull requests opened by agents and
 * waiting for the viewer's review, and the stack {@link LANDING_REVIEW} is in. {@link DEMO_ISSUE} is assigned to the
 * viewer and "Todo" in the project, as in the README's demo.
 */
export function createSampleLandingWork(): GitHubWorld {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const project = world.project({
        title: DEMO_PROJECT,
        number: 1,
        views: [{ name: 'Board', layout: 'BOARD_LAYOUT' }, { name: 'Backlog' }],
    });
    const triage = world.project({ title: 'Bug triage', number: 2 });
    world.repository('octocat/tasklet', { milestones: ['v0.4', 'v0.5'] });
    world.repository('octocat/mdlint');
    world.repository('fitloop/webapp', { milestones: ['v4.2 — November'] });

    world.workflow({
        repository: 'octocat/tasklet',
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 600 },
            { conclusion: 'failure', minutesAgo: 240 },
            { conclusion: 'failure', minutesAgo: 180 },
        ],
    });
    world.workflow({
        repository: 'octocat/mdlint',
        name: 'CI',
        runs: [
            { conclusion: 'success', minutesAgo: 900 },
            { conclusion: 'failure', minutesAgo: 540 },
        ],
    });
    world.workflow({ repository: 'octocat/tasklet', name: 'CI', runs: [{ conclusion: 'success', minutesAgo: 30 }] });

    world.pullRequest({
        repository: 'fitloop/api',
        number: 491,
        title: 'Add rate-limit backoff to the webhook worker',
        author: 'claude',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        minutesAgo: 9,
    });
    world.pullRequest({
        repository: 'octocat/tasklet',
        number: 22,
        title: 'Cache project fields between syncs',
        author: 'codex',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        minutesAgo: 24,
    });
    world.pullRequest({
        repository: 'fitloop/mobile',
        number: 97,
        title: 'Upgrade Expo SDK to 53',
        author: 'copilot',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        failingChecks: 1,
        minutesAgo: 41,
    });
    world.pullRequest({
        repository: 'octocat/mdlint',
        number: 36,
        title: 'Lint rule for nested emphasis',
        author: 'claude',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        reviewDecision: 'APPROVED',
        minutesAgo: 60,
    });
    world.stack({
        repository: LANDING_REVIEW.repository,
        number: 3,
        pullRequests: [
            {
                number: 1201,
                title: 'Store workouts in IndexedDB',
                author: 'monalisa',
                reviewDecision: 'APPROVED',
                minutesAgo: 200,
            },
            {
                number: LANDING_REVIEW.number,
                title: LANDING_REVIEW.title,
                author: 'monalisa',
                foundBy: ['reviewRequested'],
                reviewRequests: [world.viewer],
                minutesAgo: 120,
            },
            { number: 1203, title: 'Replay the queue on reconnect', author: 'monalisa', minutesAgo: 100 },
        ],
    });

    world.pullRequest({
        repository: 'octocat/tasklet',
        number: 15,
        title: 'IndexedDB store for issues and pull requests',
        foundBy: ['authored'],
        failingChecks: 2,
        reviewDecision: 'CHANGES_REQUESTED',
        projects: [{ project, status: 'In Progress' }],
        minutesAgo: 12,
    });
    world.pullRequest({
        repository: 'fitloop/api',
        number: 477,
        title: 'Retry Stripe webhook delivery on 5xx',
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        projects: [{ project, status: 'In Progress' }],
        minutesAgo: 180,
    });

    world.issue({
        repository: 'fitloop/webapp',
        number: 1187,
        title: DEMO_ISSUE,
        author: 'monalisa',
        foundBy: ['assigned'],
        labels: ['bug'],
        issueType: 'Bug',
        milestone: 'v4.2 — November',
        bodyHtml:
            '<p>A weekly class at 7:00 in Warsaw shows at 6:00 for every week after the switch to winter time. The series stores its first start as UTC and adds whole weeks to it.</p><p>Expected: the same wall-clock time in the studio’s timezone, every week.</p>',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 20,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 12,
        title: 'Background sync with conditional requests',
        foundBy: ['assigned'],
        labels: ['enhancement'],
        milestone: 'v0.4',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 1440,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 9,
        title: 'Command palette: jump to issue by number',
        foundBy: ['assigned'],
        labels: ['enhancement'],
        projects: [{ project, status: 'In Progress' }],
        minutesAgo: 2880,
    });
    world.issue({
        repository: 'fitloop/api',
        number: 455,
        title: 'Document webhook retry policy',
        author: 'hubot',
        foundBy: ['assigned'],
        labels: ['documentation'],
        projects: [{ project: triage, status: 'Todo' }],
        minutesAgo: 5760,
    });
    world.issue({
        repository: 'octocat/mdlint',
        number: 31,
        title: 'cli: support glob patterns in --ignore',
        author: 'monalisa',
        foundBy: ['mentioned'],
        projects: [{ project, status: 'Done' }],
        minutesAgo: 4320,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 21,
        title: 'Keyboard shortcut cheat sheet',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 7200,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 18,
        title: 'Offline banner when GitHub is unreachable',
        labels: ['enhancement'],
        projects: [{ project, status: 'Done' }],
        minutesAgo: 8000,
    });
    world.issue({
        repository: 'octocat/mdlint',
        number: 29,
        title: 'Autofix for trailing spaces',
        projects: [{ project, status: 'Done' }],
        minutesAgo: 9000,
    });
    world.draft({ project, title: 'Decide on retention policy for audit logs', status: 'Todo', minutesAgo: 3000 });

    return world;
}
