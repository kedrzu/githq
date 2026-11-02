/** The user's own edits of what a status bar segment shows (`FreshnessSegment.vue`), said instead of its freshness. */
export interface SegmentEdits {
    /** `unanswered`: a merge GitHub has not said the end of — neither failed nor done. */
    readonly kind: 'failed' | 'sending' | 'unanswered';
    /** "Sending 2 changes · portal#1187". */
    readonly text: string;
}
