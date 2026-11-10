import type { AnchoredListViewport } from '../AnchoredList.vue';

/**
 * Where the diff is being read, as a distance from its viewport's top (D42, D44): a third of the way down what shows
 * under the pinned header. It is never drawn; it decides which way a gap's lines come and which gap E opens.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getReadingLine({ height, covered }: AnchoredListViewport): number {
    return covered + (height - covered) / 3;
}
