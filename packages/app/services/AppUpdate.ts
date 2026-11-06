import { defineInterface } from '@nzyme/ioc/Interface.js';

/** Which releases the desktop app follows. */
export type UpdateStream = 'stable' | 'development';

/** What the updater is doing, or how the last thing it did ended (`src-tauri/src/updater.rs`). */
export type UpdateActivity =
    | { readonly kind: 'idle' }
    | { readonly kind: 'checking' }
    | { readonly kind: 'upToDate' }
    | { readonly kind: 'downloading'; readonly version: string; readonly percent: number | null }
    | { readonly kind: 'ready'; readonly version: string }
    | { readonly kind: 'failed'; readonly reason: 'offline' | 'unreachable' }
    | { readonly kind: 'noRelease' }
    | { readonly kind: 'installing'; readonly version: string }
    | { readonly kind: 'installFailed'; readonly version: string };

/** Everything the native side knows about updates, sent whole on every change. */
export interface UpdateState {
    /** The running version. */
    readonly version: string;
    /** The commit it was built from; `null` for a local build. */
    readonly commit: string | null;
    readonly stream: UpdateStream;
    /** Whether the user may change the stream. Windows has no Development builds. */
    readonly canChoose: boolean;
    /** Whether the check under way or waiting its turn, or the last finished one, was asked for by the user. */
    readonly manual: boolean;
    /** When the last check finished, in epoch milliseconds. */
    readonly checkedAt: number | null;
    readonly activity: UpdateActivity;
}

/**
 * What the status bar says about updates (U22, U40, U50, U51). Only what the user asked about or has to decide: a check
 * nobody asked for says nothing until an update is ready. A ready or failed install is said there only once its toast
 * was dismissed ({@link UpdateOffer}), quietly.
 */
export type UpdateNotice =
    | { readonly kind: 'checking' }
    | { readonly kind: 'upToDate'; readonly version: string }
    | { readonly kind: 'downloading'; readonly version: string; readonly percent: number | null }
    | { readonly kind: 'ready'; readonly version: string }
    | { readonly kind: 'failed'; readonly reason: 'offline' | 'unreachable' }
    /** The stream that has none. */
    | { readonly kind: 'noRelease'; readonly stream: UpdateStream }
    | { readonly kind: 'installing'; readonly version: string }
    | { readonly kind: 'installFailed'; readonly version: string };

/**
 * An update waiting on the user's word, offered in a toast that stays until dismissed: ready to restart into (U49), or
 * its install on Restart failed (U51).
 */
export type UpdateOffer = Extract<UpdateActivity, { readonly kind: 'ready' | 'installFailed' }>;

/** The version the app now runs and the one it replaced, the first time it runs after they changed. */
export interface VersionChange {
    readonly version: string;
    readonly previousVersion: string;
}

/**
 * The app's own updates, the seam between the app and the desktop app's updater. Nothing restarts without the user's
 * word.
 */
export interface AppUpdateShape {
    /** All the native side says; `null` on the web and before its first answer; reactive. */
    readonly state: UpdateState | null;
    /** What the status bar shows, if anything; reactive. */
    readonly notice: UpdateNotice | null;
    /** What the update toast offers, until {@link later} dismisses it; reactive. */
    readonly offer: UpdateOffer | null;
    /**
     * The version the user had before this update, kept until the next one; `null` until the app has updated once, on the
     * web and before the native side's first answer; reactive.
     */
    readonly previousVersion: string | null;
    /** The update the user hasn't been told of yet; reactive. {@link markUpdateTold} ends it for good. */
    readonly untoldChange: VersionChange | null;
    /** Remembers the update as told, across reloads. */
    markUpdateTold(): void;
    /** Checks now, at the user's word: its outcome is noticed. */
    check(): void;
    /**
     * Follows `stream` from now on and checks it. Leaving a Development build for Stable can install an older version,
     * so the caller has asked first ({@link isPrereleaseVersion}).
     */
    setStream(stream: UpdateStream): void;
    /** Restarts into the ready version, or tries installing it again. */
    restart(): void;
    /**
     * Dismisses the toast of the {@link offer} until the app next starts, or until the user checks again; the status bar
     * keeps it, quietly.
     */
    later(): void;
    /** Closes the outcome of a check; the next check the user asks for can notice again. */
    dismiss(): void;
}

/** The app's updates: none on the web, where every load is the latest; the desktop app sets its own (`desktop/`). */
export const AppUpdate = defineInterface<AppUpdateShape>({
    name: 'AppUpdate',
    default: () => ({
        state: null,
        notice: null,
        offer: null,
        previousVersion: null,
        untoldChange: null,
        markUpdateTold: () => {},
        check: () => {},
        setStream: () => {},
        restart: () => {},
        later: () => {},
        dismiss: () => {},
    }),
});

/**
 * Whether a version has a prerelease part (`0.3.0-dev.214`), which makes it a Development build: switching it to Stable
 * asks first (D5). A hyphen in build metadata (`1.0.0+build-1`) is not one.
 * @__NO_SIDE_EFFECTS__
 */
export function isPrereleaseVersion(version: string) {
    return /^[^+]*-/.test(version);
}

/**
 * Whether `version` comes before `other` by its numbers alone. `0.1.0` is not older than `0.1.0-dev.214`: it is what that
 * build led up to.
 * @__NO_SIDE_EFFECTS__
 */
export function isOlderVersion(version: string, other: string) {
    const [major = 0, minor = 0, patch = 0] = parseCore(version);
    const [otherMajor = 0, otherMinor = 0, otherPatch = 0] = parseCore(other);
    return (major - otherMajor || minor - otherMinor || patch - otherPatch) < 0;
}

/**
 * Whether `version` comes after `other`, a prerelease part counting as semver has it: `0.1.0` is newer than
 * `0.1.0-dev.214`, the build that led up to it. Two prereleases of one core aren't told apart.
 * @__NO_SIDE_EFFECTS__
 */
export function isNewerVersion(version: string, other: string) {
    return (
        isOlderVersion(other, version) ||
        (isPrereleaseVersion(other) && !isPrereleaseVersion(version) && !isOlderVersion(version, other))
    );
}

function parseCore(version: string) {
    return version.split(/[-+]/, 1).join('').split('.').map(Number);
}
