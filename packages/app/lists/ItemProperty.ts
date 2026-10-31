/**
 * What a row or a card of issues and pull requests may show besides its kind, title and number — the
 * "properties shown" of a list's display options (D4).
 */
export type ItemProperty = 'labels' | 'milestone' | 'people' | 'projectField' | 'size' | 'status' | 'updated';

/** The properties in the order the display options list them. */
export const ITEM_PROPERTIES: readonly ItemProperty[] = [
    'status',
    'projectField',
    'labels',
    'milestone',
    'people',
    'size',
    'updated',
];
