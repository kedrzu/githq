// The release rules of the desktop app, pure: PR titles and commit subjects are Conventional Commits, and the next
// version and the release notes are computed from the subjects since the last stable tag. CI runs this with bun
// and without `bun install`, so it imports nothing.

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore'];
// Scopes of work that never reaches the desktop app's users.
const HIDDEN_SCOPES = ['web', 'cloud'];

const SUBJECT = new RegExp(`^(${TYPES.join('|')})(?:\\((${HIDDEN_SCOPES.join('|')})\\))?(!)?: (\\S.*)$`);
const PULL_REQUEST_SUFFIX = / \(#(\d+)\)$/;
const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const CANDIDATE_TAG = /^v(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/;

export type ReleaseMode = 'preview' | 'candidate' | 'stable';

export type TitleCheck = { valid: true } | { valid: false; reason: string };

export type ReleasePlan = { kind: 'nothing' } | { kind: 'release'; tag: string };

export interface PlanReleaseParams {
    /** Commit subjects since the last stable tag. */
    subjects: string[];
    /** Every tag name of the repository. */
    tags: string[];
    /** `preview` plans the stable release without making a candidate of it. */
    mode: ReleaseMode;
}

export interface RenderNotesParams {
    subjects: string[];
    policyUrl: string;
}

type Bump = 'patch' | 'minor' | 'major';

interface Version {
    major: number;
    minor: number;
    patch: number;
}

interface Change {
    type: string;
    breaking: boolean;
    description: string;
    /** The ` (#N)` a squash merge appends, or empty. */
    pullRequest: string;
}

/** Says whether a PR title is a valid Conventional Commit for this repository and, if not, why in one line. */
export function checkTitle(title: string): TitleCheck {
    if (SUBJECT.test(title)) {
        return { valid: true };
    }
    return {
        valid: false,
        reason: `"${title}" is not "<type>[(web|cloud)][!]: <description>" with a type of ${TYPES.join(', ')}`,
    };
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

/**
 * The tag the next release gets. A candidate is the stable version the same subjects would give, plus `-rc.N`;
 * candidates never move that version, so they are not read for it.
 */
export function planRelease({ subjects, tags, mode }: PlanReleaseParams): ReleasePlan {
    const bump = highestBump(subjects.map(parseChange));
    if (!bump) {
        return { kind: 'nothing' };
    }

    const lastStable = findLastStableTag(tags);
    const last = lastStable ? parseStableTag(lastStable) : undefined;
    const version = last ? applyBump(last, bump) : { major: 0, minor: 1, patch: 0 };
    const stableTag = formatTag(version);

    if (mode !== 'candidate') {
        return { kind: 'release', tag: stableTag };
    }
    return { kind: 'release', tag: `${stableTag}-rc.${nextCandidate(tags, version)}` };
}

/** Markdown release notes: the user-visible changes grouped, then the pointer to the code signing policy. */
export function renderNotes({ subjects, policyUrl }: RenderNotesParams): string {
    const changes = subjects.map(parseChange).filter(isUserVisible);
    const groups = [
        { title: 'Breaking changes', entries: changes.filter(change => change.breaking) },
        { title: 'Features', entries: changes.filter(change => !change.breaking && change.type === 'feat') },
        { title: 'Fixes', entries: changes.filter(change => !change.breaking && change.type === 'fix') },
        { title: 'Performance', entries: changes.filter(change => !change.breaking && change.type === 'perf') },
    ];

    const sections: string[] = [];
    for (const { title, entries } of groups) {
        if (entries.length > 0) {
            const lines = entries.map(entry => `- ${capitalise(entry.description)}${entry.pullRequest}`);
            sections.push(`## ${title}\n\n${lines.join('\n')}`);
        }
    }
    sections.push(
        `Installers for macOS, Windows and Linux. How builds are signed, and what the app talks to: [Code signing policy](${policyUrl}).`,
    );
    return `${sections.join('\n\n')}\n`;
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
    return { type, breaking: bang !== undefined, description, pullRequest: suffix?.[0] ?? '' };
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

function nextCandidate(tags: string[], version: Version): number {
    let highest = 0;
    for (const tag of tags) {
        const match = CANDIDATE_TAG.exec(tag);
        if (!match) {
            continue;
        }
        const [, major, minor, patch, candidate] = match.map(Number);
        const same = major === version.major && minor === version.minor && patch === version.patch;
        if (same && candidate !== undefined && candidate > highest) {
            highest = candidate;
        }
    }
    return highest + 1;
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
