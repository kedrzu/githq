/** The width of one lane of the graph. */
export const COMMIT_GRAPH_LANE_WIDTH = 12;
/** The room left of the first lane and right of the last. */
export const COMMIT_GRAPH_PADDING = 8;
/** The share of the pane the graph takes until the user drags it (git-client D17). */
export const COMMIT_GRAPH_DEFAULT_SHARE = 0.1;
/** What the rows keep of the pane however far the graph is dragged, so its divider stays within reach. */
const MIN_ROWS_WIDTH = 240;

/** What {@link fitCommitGraph} fits. */
export interface FitCommitGraphOptions {
    /** The share of the pane asked for; any range, the fit keeps it to what can be drawn. */
    readonly share: number;
    readonly paneWidth: number;
    /** How many lanes the whole graph needs. */
    readonly totalLanes: number;
}

/** How the graph is drawn in a pane: never narrower than one lane, nor wider than every lane. */
export interface CommitGraphFit {
    /** Whole pixels, so a width set from a lane count reads back as that many lanes. */
    readonly width: number;
    /** How many lanes fit; those past the last fold onto it. */
    readonly lanes: number;
    /** The widest it can be dragged. */
    readonly maxWidth: number;
    /** The lanes fitting at `maxWidth`. */
    readonly maxLanes: number;
}

/** The fewest lanes shown: the default branch's and the fold, so the default branch always stands apart (D17). */
export function getMinLanes(totalLanes: number) {
    return Math.min(2, Math.max(1, totalLanes));
}

/**
 * The graph's width in a pane and the lanes fitting it (git-client D17).
 * @__NO_SIDE_EFFECTS__
 */
export function fitCommitGraph(options: FitCommitGraphOptions): CommitGraphFit {
    const minWidth = getCommitGraphWidth(getMinLanes(options.totalLanes));
    const maxWidth = Math.max(
        minWidth,
        Math.min(getCommitGraphWidth(Math.max(1, options.totalLanes)), options.paneWidth - MIN_ROWS_WIDTH),
    );
    const width = Math.min(maxWidth, Math.max(minWidth, Math.round(options.share * options.paneWidth)));

    return { width, lanes: getFittingLanes(width), maxWidth, maxLanes: getFittingLanes(maxWidth) };
}

/**
 * The width that holds exactly `lanes` lanes.
 * @__NO_SIDE_EFFECTS__
 */
export function getCommitGraphWidth(lanes: number): number {
    return lanes * COMMIT_GRAPH_LANE_WIDTH + COMMIT_GRAPH_PADDING * 2;
}

function getFittingLanes(width: number) {
    return Math.floor((width - COMMIT_GRAPH_PADDING * 2) / COMMIT_GRAPH_LANE_WIDTH);
}
