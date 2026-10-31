import { getOS } from '@nzyme/dom-utils/getOs.js';

/**
 * Whether the platform's primary modifier is ⌘ (macOS, iOS, iPadOS) rather than Ctrl — what `Mod` in a key
 * (`Mod+K`) stands for.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isApplePlatform(): boolean {
    const os = getOS();
    return os === 'macOS' || os === 'iOS';
}
