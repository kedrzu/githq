// The release rules of the desktop app, pure: PR titles and commit subjects are Conventional Commits, a title's type
// agrees with the paths the PR changes, and the next version and the release notes are computed from the subjects
// since the last stable tag. CI runs this with bun and without `bun install`, so it imports nothing.

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore'];
// Scopes of work that never reaches the desktop app's users.
const HIDDEN_SCOPES = ['web', 'cloud'];

const SUBJECT = new RegExp(`^(${TYPES.join('|')})(?:\\((${HIDDEN_SCOPES.join('|')})\\))?(!)?: (\\S.*)$`);
const PULL_REQUEST_SUFFIX = / \(#(\d+)\)$/;
const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
// What a scope's PR has to touch: a scope says the work never reaches the desktop app, so it must at least be that work.
const SCOPE_PATHS: Record<string, string[]> = {
    web: ['packages/app/landing/', 'packages/worker/'],
    cloud: ['packages/worker/'],
};
// How many offending paths a title rejection names.
const LISTED_PATHS = 3;
const GROUP_TITLES: Record<ChangeGroupKind, string> = {
    breaking: 'Breaking changes',
    features: 'Features',
    fixes: 'Fixes',
    performance: 'Performance',
};

export type ReleaseMode = 'preview' | 'stable';

export type TitleCheck = { valid: true } | { valid: false; reason: string };

export type ReleasePlan = { kind: 'nothing' } | { kind: 'release'; tag: string };

export interface PlanReleaseParams {
    /** Commit subjects since the last stable tag. */
    subjects: string[];
    /** The `v*` tags merged into HEAD. */
    tags: string[];
}

export interface DevelopmentVersionParams {
    /** The `v*` tags merged into HEAD. */
    tags: string[];
    /** The number of commits reachable from HEAD. */
    commitCount: number;
}

export interface RenderNotesParams {
    subjects: string[];
    policyUrl: string;
}

type Bump = 'patch' | 'minor' | 'major';

/** Which heading of the release notes a change goes under. */
export type ChangeGroupKind = 'breaking' | 'features' | 'fixes' | 'performance';

/** A change users notice, as the release notes say it. */
export interface UserVisibleChange {
    /** Capitalised, without its pull request. */
    description: string;
    /** The number a squash merge appended, if any. */
    pullRequest: number | undefined;
}

/** The changes of one heading of the release notes, never empty. */
export interface UserVisibleChangeGroup {
    kind: ChangeGroupKind;
    changes: UserVisibleChange[];
}

interface Version {
    major: number;
    minor: number;
    patch: number;
}

interface Change {
    type: string;
    breaking: boolean;
    description: string;
    /** The number in the ` (#N)` a squash merge appends. */
    pullRequest: number | undefined;
}

/**
 * Says whether a PR title is valid for this repository and, if not, why in one line: a Conventional Commit whose type
 * tells the truth about the PR's changed paths. An empty list fires no rule on the paths.
 */
export function checkTitle(title: string, files: string[]): TitleCheck {
    const match = SUBJECT.exec(title);
    if (!match) {
        return {
            valid: false,
            reason: `"${title}" is not "<type>[(web|cloud)][!]: <description>" with a type of ${TYPES.join(', ')}`,
        };
    }

    const [, type, scope] = match;
    const scopePaths = scope === undefined ? undefined : SCOPE_PATHS[scope];
    if (scopePaths && files.length > 0 && !files.some(file => scopePaths.some(path => file.startsWith(path)))) {
        return {
            valid: false,
            reason: `the scope ${scope} says this never reaches the desktop app, but this PR touches nothing under ${scopePaths.join(' or ')}`,
        };
    }

    const code = files.filter(isCodePath);
    if (type === 'docs' && code.length > 0) {
        return { valid: false, reason: `a docs PR cannot touch code, but this one changes ${listPaths(code)}` };
    }
    if ((type === 'feat' || type === 'fix' || type === 'perf') && hasNoCode(files)) {
        return {
            valid: false,
            reason: `${type} promises a user-visible change and must touch code, but this PR changes only documentation`,
        };
    }
    return { valid: true };
}

/** Says whether a PR changes only documentation. An empty list is a list we know nothing about, so it does not. */
export function hasNoCode(files: string[]): boolean {
    return files.length > 0 && !files.some(isCodePath);
}

/** The highest stable tag (exact `vX.Y.Z`, compared numerically), or undefined before the first release. */
export function findLastStableTag(tags: string[]): string | undefined {
    let last: { tag: string; version: Version } | undefined;
    for (const tag of tags) {
        const version = parseStableTag(tag);
        if (version && (!last || compareVersions(version, last.version) > 0)) {
            last = { tag, version };
        }
    }
    return last?.tag;
}

/** The tag the next stable release gets, from the subjects since the last stable tag. */
export function planRelease({ subjects, tags }: PlanReleaseParams): ReleasePlan {
    const bump = highestBump(subjects.map(parseChange));
    if (!bump) {
        return { kind: 'nothing' };
    }

    const lastStable = findLastStableTag(tags);
    const last = lastStable ? parseStableTag(lastStable) : undefined;
    const version = last ? applyBump(last, bump) : { major: 0, minor: 1, patch: 0 };
    return { kind: 'release', tag: formatTag(version) };
}

/**
 * The version of a Development build, without the `v`: the next minor after the last stable tag, plus `-dev.N` with N
 * the commit count of HEAD. It sorts above the last stable and below the next minor, and reads no commit title.
 */
export function developmentVersion({ tags, commitCount }: DevelopmentVersionParams): string {
    const lastStable = findLastStableTag(tags);
    const last = lastStable ? parseStableTag(lastStable) : undefined;
    const { major, minor } = last ?? { major: 0, minor: 0 };
    return `${major}.${minor + 1}.0-dev.${commitCount}`;
}

/**
 * What users notice among commit subjects, under the headings of the release notes and in their order: the one rule of
 * what the notes list, which the app's Changelog applies to a Development build's commits too.
 */
export function userVisibleChanges(subjects: string[]): UserVisibleChangeGroup[] {
    const changes = subjects.map(parseChange).filter(isUserVisible);
    const groups: { kind: ChangeGroupKind; entries: Change[] }[] = [
        { kind: 'breaking', entries: changes.filter(change => change.breaking) },
        { kind: 'features', entries: changes.filter(change => !change.breaking && change.type === 'feat') },
        { kind: 'fixes', entries: changes.filter(change => !change.breaking && change.type === 'fix') },
        { kind: 'performance', entries: changes.filter(change => !change.breaking && change.type === 'perf') },
    ];

    return groups
        .filter(({ entries }) => entries.length > 0)
        .map(({ kind, entries }) => ({
            kind,
            changes: entries.map(({ description, pullRequest }) => ({
                description: capitalise(description),
                pullRequest,
            })),
        }));
}

/** Markdown release notes: the user-visible changes grouped, then the pointer to the code signing policy. */
export function renderNotes({ subjects, policyUrl }: RenderNotesParams): string {
    const sections = userVisibleChanges(subjects).map(({ kind, changes }) => {
        const lines = changes.map(
            ({ description, pullRequest }) =>
                `- ${description}${pullRequest === undefined ? '' : ` (#${pullRequest})`}`,
        );
        return `## ${GROUP_TITLES[kind]}\n\n${lines.join('\n')}`;
    });
    sections.push(
        `Installers for macOS, Windows and Linux. How builds are signed, and what the app talks to: [Code signing policy](${policyUrl}).`,
    );
    return `${sections.join('\n\n')}\n`;
}

function isCodePath(file: string): boolean {
    return !file.endsWith('.md') && !file.endsWith('.pen') && !file.startsWith('docs/');
}

// JSON-quoted, because a path may hold a newline and a reason is one line.
function listPaths(files: string[]): string {
    const named = files.slice(0, LISTED_PATHS).map(file => JSON.stringify(file));
    const rest = files.length - named.length;
    return rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(', ');
}

/** A subject with no valid form (a merge commit, a title from before the rules) is no change at all. */
function parseChange(subject: string): Change | undefined {
    const suffix = PULL_REQUEST_SUFFIX.exec(subject);
    const match = SUBJECT.exec(suffix ? subject.slice(0, suffix.index) : subject);
    if (!match) {
        return undefined;
    }
    const [, type, scope, bang, description] = match;
    if (type === undefined || description === undefined || scope !== undefined) {
        return undefined;
    }
    return {
        type,
        breaking: bang !== undefined,
        description,
        pullRequest: suffix?.[1] === undefined ? undefined : Number(suffix[1]),
    };
}

function isUserVisible(change: Change | undefined): change is Change {
    if (!change) {
        return false;
    }
    return change.breaking || change.type === 'feat' || change.type === 'fix' || change.type === 'perf';
}

function highestBump(changes: (Change | undefined)[]): Bump | undefined {
    let bump: Bump | undefined;
    for (const change of changes) {
        if (!isUserVisible(change)) {
            continue;
        }
        if (change.breaking) {
            return 'major';
        }
        bump = change.type === 'feat' ? 'minor' : (bump ?? 'patch');
    }
    return bump;
}

// A breaking change is a minor bump while the app is 0.x, because 1.0 is a decision and not an accident.
function applyBump(version: Version, bump: Bump): Version {
    const { major, minor, patch } = version;
    if (bump === 'major' && major > 0) {
        return { major: major + 1, minor: 0, patch: 0 };
    }
    if (bump === 'major' || bump === 'minor') {
        return { major, minor: minor + 1, patch: 0 };
    }
    return { major, minor, patch: patch + 1 };
}

function parseStableTag(tag: string): Version | undefined {
    const match = STABLE_TAG.exec(tag);
    if (!match) {
        return undefined;
    }
    const [, major, minor, patch] = match.map(Number);
    if (major === undefined || minor === undefined || patch === undefined) {
        return undefined;
    }
    return { major, minor, patch };
}

function compareVersions(a: Version, b: Version): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function formatTag({ major, minor, patch }: Version): string {
    return `v${major}.${minor}.${patch}`;
}

function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
