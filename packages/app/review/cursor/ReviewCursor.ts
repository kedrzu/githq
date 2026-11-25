/**
 * The diff's line cursor (D44): the key of the stop holding it, a row {@link isCursorStop} accepts. A split row is one
 * stop, both halves; the line C takes on it is the row's own (`getCommentLine`), not the cursor's. A thread shown whole is
 * a stop per comment ({@link listCursorStops}).
 */
export interface ReviewCursor {
    readonly key: string;
    /**
     * The comment it is on, GitHub's id of one of the thread's comments: set exactly when `key` is a thread shown whole. A
     * folded thread is one stop; replies on their way and the reply box are never stops.
     */
    readonly comment?: string;
}
