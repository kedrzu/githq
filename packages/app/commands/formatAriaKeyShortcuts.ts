import { isApplePlatform } from '@/utils/isApplePlatform.js';

/**
 * A key in the app's notation (`Mod+K`) as `aria-keyshortcuts` names what is pressed: `Meta+K` on Apple's platforms,
 * `Control+K` elsewhere.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatAriaKeyShortcuts(key: string): string {
    return key.replaceAll(/\bMod\+/gu, isApplePlatform() ? 'Meta+' : 'Control+');
}
