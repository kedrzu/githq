import type { EditVerdict } from './EditTypes.js';

/** GitHub answered without the change: it silently drops what the user may not do (D14). */
export function toDroppedVerdict(): EditVerdict {
    return { kind: 'rejected', reason: { kind: 'dropped' } };
}
