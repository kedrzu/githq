import type { ItemCheck, ItemCheckState } from '@/store/ItemDetailTypes.js';

const ORDER: readonly ItemCheckState[] = ['failing', 'pending', 'passing', 'skipped'];

/**
 * Orders checks as the lists show them: failing first, then running, passed and skipped.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function compareChecks(a: ItemCheck, b: ItemCheck) {
    return ORDER.indexOf(a.state) - ORDER.indexOf(b.state);
}
