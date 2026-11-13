/**
 * The diff's line cursor (D44): the key of the stop holding it, a row {@link isCursorStop} accepts. A split row is one
 * stop, both halves; the line C takes on it is the row's own (`getCommentLine`), not the cursor's.
 */
export interface ReviewCursor {
    readonly key: string;
}
