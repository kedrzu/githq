import { ArrowRight, CircleStop, CircleX, FileCode, Play, Power, RefreshCw, Workflow } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './workflows.loc.js';

/**
 * Opens the repository's settings on Workflow alerts from its Workflows section — on their add field from a workflow
 * failing only where nothing raises alerts (actions W13). `⇧P`, not `P`: with an item open beside the section, `P` is
 * the item's priority.
 */
export const alertSettings = defineAppCommand({
    id: 'alertSettings',
    title: l.alertSettings,
    key: 'Shift+P',
    places: ['workflows'],
});

/**
 * Opens the latest failed run: of the Workflows section's selected workflow, or of the workflow opened on its page (in
 * the panel the section beside it keeps `F`, for the workflow under its cursor).
 */
export const openLatestFailure = defineAppCommand({
    id: 'openLatestFailure',
    title: l.openLatestFailure,
    icon: CircleX,
    key: 'F',
    places: ['workflows', 'workflow'],
});

/**
 * Runs a workflow by hand (actions W36, W37, W46–W48): from anywhere through the tracked repositories, from the
 * Workflows section or an opened workflow straight to that workflow's form, the binding naming it. No key (D10): it
 * starts something in the repository, never one stray keystroke away.
 */
export const runWorkflow = defineAppCommand({
    id: 'runWorkflow',
    title: l.runWorkflow,
    icon: Play,
    keywords: [l.dispatchKeyword, l.actionsKeyword],
    places: ['app', 'workflows', 'workflow'],
});

/** Opens the page of the run a workflow run by hand started (W39): the newest such toast's. */
export const openStartedRun = defineAppCommand({
    id: 'openStartedRun',
    title: l.openStartedRun,
    icon: ArrowRight,
    key: 'Alt+O',
    places: ['app'],
});

/** Turns the opened workflow off, or on again; the binding names the way it goes. No key (D10). */
export const toggleWorkflow = defineAppCommand({
    id: 'toggleWorkflow',
    title: l.toggleWorkflow,
    icon: Power,
    places: ['workflow'],
});

/** Opens the opened workflow's file on github.com, at the default branch. */
export const openWorkflowFile = defineAppCommand({
    id: 'openWorkflowFile',
    title: l.openWorkflowFile,
    icon: FileCode,
    places: ['workflow'],
});

/** A run's next job, its log opening; at the overview, the cursor to it. */
export const nextJob = defineAppCommand({
    id: 'nextJob',
    title: l.nextJob,
    key: 'Alt+J',
    places: ['workflowRun'],
});

/** A run's previous job, as {@link nextJob}. */
export const previousJob = defineAppCommand({
    id: 'previousJob',
    title: l.previousJob,
    key: 'Alt+K',
    places: ['workflowRun'],
});

/** At a run's overview, opens the log of the job under the cursor. */
export const openLog = defineAppCommand({
    id: 'openLog',
    title: l.openLog,
    key: 'Enter',
    places: ['workflowRun'],
    configurable: false,
});

/**
 * Reads or writes again what failed: a run's page its run, jobs or a job's log; a screen GitHub failed to show
 * (`CantBeRead`); syncing the settings that stopped (Sync settings). Enter, fixed: on a focused button or link Enter is
 * its own.
 */
export const tryAgain = defineAppCommand({
    id: 'tryAgain',
    title: l.tryAgain,
    key: 'Enter',
    places: ['workflowRun', 'cantBeRead', 'settings'],
    configurable: false,
});

/** Goes to the page of the run's workflow. */
export const openWorkflow = defineAppCommand({
    id: 'openWorkflow',
    title: l.openWorkflow,
    icon: Workflow,
    places: ['workflowRun'],
});

/** Re-runs a run's failed jobs, with no question asked (W4k). No key (D10). */
export const rerunFailedJobs = defineAppCommand({
    id: 'rerunFailedJobs',
    title: l.rerunFailedJobs,
    icon: RefreshCw,
    places: ['workflowRun'],
});

/** Re-runs every job of a finished run: the run opened, or an opened workflow's selected run. No key (D10). */
export const rerunAllJobs = defineAppCommand({
    id: 'rerunAllJobs',
    title: l.rerunAllJobs,
    icon: RefreshCw,
    places: ['workflowRun', 'workflow'],
});

/** Re-runs the job under a run's cursor; the binding names it. No key (D10). */
export const rerunJob = defineAppCommand({
    id: 'rerunJob',
    title: l.rerunJob,
    icon: RefreshCw,
    places: ['workflowRun'],
});

/** Cancels a run that goes: the run opened, or an opened workflow's selected run. No key (D10). */
export const cancelRun = defineAppCommand({
    id: 'cancelRun',
    title: l.cancelRun,
    icon: CircleStop,
    places: ['workflowRun', 'workflow'],
});
