import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { GitPullRequest, GitPullRequestDraft } from 'lucide-vue-next';

import type { PickerOption } from '@/components/Picker.vue';
import type { EditRequest, ProjectFieldInput } from '@/edits/EditTypes.js';
import type { EditPermissions } from '@/edits/getEditPermissions.js';
import type { ProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { getProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import { usePullRequestVerdicts } from '@/item/usePullRequestVerdict.js';
import type { MergeCheckCounts } from '@/merge/countMergeChecks.js';
import { isAutoMergeAllowed } from '@/merge/isAutoMergeAllowed.js';
import type { MergeCheck } from '@/merge/MergeTypes.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { ItemDetailProject, ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import { bindCommand } from './bindCommand.js';
import type { Command, CommandOption } from './CommandTypes.js';
import type { AppCommand } from './defineAppCommand.js';
import * as definitions from './definitions/index.js';
import * as l from './useEditCommands.loc.js';
import { useProjectFieldOptions } from './useProjectFieldOptions.js';
import type { PullRequestCommandPlace, PullRequestCommandSource } from './usePullRequestCommands.js';
import { usePullRequestCommands } from './usePullRequestCommands.js';

/** The definitions of a project's fields' edits, by the field's role: their keys are the item view's hints too. */
export const PROJECT_FIELD_COMMANDS: Readonly<Record<ProjectFieldRole, AppCommand<EditPlaces, string>>> = {
    status: definitions.status,
    priority: definitions.priority,
    iteration: definitions.iteration,
};

/** The places an edit is offered in (`definitions/edit.ts`). */
type EditPlaces = typeof definitions.merge.places;

/** An edit with an action of its own here. */
export type EditCommandKind =
    | 'assignees'
    | 'labels'
    | 'milestone'
    | 'issueType'
    | 'reviewers'
    | ProjectFieldRole
    | 'state';

/** A way to close or reopen: an entry of the submenu, or the action itself when it is the only one. */
export interface StateOption {
    readonly key: string;
    readonly text: string;
    readonly icon?: LucideIcon;
    readonly request: EditRequest;
}

/** What {@link useEditCommands} builds the actions from; read every time they are. */
export interface EditCommandsParams {
    /** `list` for the items checked, `item` for the opened one or a list's row (`useItemCommands`), or a review. */
    readonly place: PullRequestCommandPlace;
    readonly section: 'item' | 'selection';
    /** The items edited: the opened one, or the selection. */
    readonly items: readonly Item[];
    /** The metadata of their repositories read so far. */
    readonly metadata: readonly RepositoryMetadata[];
    /** Some repository's metadata is still being read. */
    readonly loading: boolean;
    readonly viewerLogin: string;
    getPermissions(item: Item): EditPermissions;
    /** Their places in projects the user may write to; one per project for a selection. */
    readonly places: readonly ItemDetailProject[];
    /** Epoch ms: which iteration is current. */
    readonly now: number;
    /** The close / reopen entries the user may use; the action is there when there are any. */
    readonly stateOptions: readonly StateOption[];
    readonly stateTitle: string;
    /**
     * The selection's assignees, labels, milestone and project fields (status, priority, iteration) say on their rows
     * the value every item has, or "mixed" when they differ: a phone's command menu, which has no toolbar of pickers
     * showing them (mobile MB118). A project field's row reads each item's value through {@link getPlaces}.
     */
    readonly summarize?: boolean;
    /** Each item's places in projects: what a project field's row summarizes over a selection. */
    readonly getPlaces?: (item: Item) => readonly ItemDetailProject[];
    /** Makes the change of every item (through the edit engine). */
    edit(request: EditRequest): void;
    /** Sets a project field's value of every item: of one place for one item, of the project for a selection. */
    setField(place: ItemDetailProject, field: ProjectField, value: ProjectFieldInput | null): void;
    /**
     * What a key opens in place of the menu: the item view's or the toolbar's own picker; `false` when it is not
     * shown — the key then opens the menu's submenu.
     */
    readonly inline?: Partial<Record<EditCommandKind, () => boolean>>;
    /**
     * Opens the merge panel for the one pull request (merging D7); without it merging is not offered here. A screen
     * that moves on once the merge is sent (a list, PM32a) says so in it.
     */
    readonly merge?: (pr: PullRequestItem) => void;
    /** `merge` leaves for github.com: a phone, which has no merge panel yet (mobile D4, D11). */
    readonly mergeExternal?: boolean;
    /**
     * The one pull request's checks counted by whether they are required, once its merge options are read: `⇧M` then
     * says the same way forward as its standing (PM38). Without them, as its row holds it.
     */
    readonly mergeChecks?: MergeCheckCounts | null;
    /** The viewer may turn auto-merge on, as its merge options said; not known until they are read. */
    readonly viewerCanEnableAutoMerge?: boolean | null;
    /** Its ordinary commands (merging D16); without them they are not offered here. */
    readonly pullRequestCommands?: PullRequestCommandSource | null;
    /** The one pull request's checks, once its merge options are read: which `⇧E` re-runs (PM39). */
    readonly checks?: readonly MergeCheck[] | null;
}

/** An edit made of items one by one, by the user's permission for each. */
type ItemPermission = 'assignees' | 'labels' | 'milestone' | 'issueType';

/**
 * The edit actions of an opened item or of the items selected together (E1, E2, E4): assign, label, milestone, an
 * issue's type, a project's status, priority and iteration, close or reopen — and of one pull request, ask for
 * reviews and switch it between draft and ready — offered only where the user may make them (D14, K1b; "2 of 3
 * editable" where only some of the items take it), each with a submenu of the values, made through the edit engine.
 * A value every item has is marked and taken away when picked again; one only some of them have is half-marked,
 * "1 of 3", and given to all of them when picked.
 */
export function useEditCommands(): (params: EditCommandsParams) => Command[] {
    const t = useTranslate();
    const pickerOptions = usePickerOptions();
    const fieldOptions = useProjectFieldOptions();
    const getVerdict = usePullRequestVerdicts();
    const pullRequestCommands = usePullRequestCommands();

    return params =>
        [
            mergeCommand(params),
            ...ordinaryCommands(params),
            toggleCommand(params, 'assignees', {
                definition: definitions.assignees,
                options: () => pickerOptions.assignees(params.metadata, params.viewerLogin),
                current: item => item.assignees.map(user => user.login),
            }),
            toggleCommand(params, 'labels', {
                definition: definitions.labels,
                options: () => pickerOptions.labels(params.metadata),
                current: item => item.labels.map(label => label.name),
            }),
            milestoneCommand(params),
            issueTypeCommand(params),
            fieldCommand(params, 'status'),
            fieldCommand(params, 'priority'),
            fieldCommand(params, 'iteration'),
            reviewersCommand(params),
            draftCommand(params),
            stateCommand(params),
        ].filter(command => command !== null);

    function toggleCommand(params: EditCommandsParams, kind: 'assignees' | 'labels', spec: ToggleCommandSpec): Command {
        const total = params.items.length;
        const counts = new Map<string, number>();
        for (const item of params.items) {
            for (const value of new Set(spec.current(item))) {
                counts.set(value, (counts.get(value) ?? 0) + 1);
            }
        }

        const command = base(params, kind, spec.definition);
        return {
            ...command,
            detail:
                command.detail ??
                summarize(params, item =>
                    spec
                        .current(item)
                        .toSorted((a, b) => a.localeCompare(b))
                        .join(', '),
                ),
            options: () => ({
                loading: params.loading,
                note: note(params, kind),
                options: spec.options().map((option): CommandOption => {
                    const count = counts.get(option.value) ?? 0;
                    const all = count === total;
                    return {
                        ...option,
                        detail: total > 1 && count > 0 ? t(l.together, { count, total }) : option.detail,
                        chosen: all,
                        mixed: count > 0 && !all,
                        pick: () =>
                            params.edit(
                                all
                                    ? { kind, add: [], remove: [option.value] }
                                    : { kind, add: [option.value], remove: [] },
                            ),
                    };
                }),
            }),
        };
    }

    function milestoneCommand(params: EditCommandsParams): Command {
        const one = params.items.length === 1 ? params.items[0] : undefined;
        const current = one?.milestone?.title ?? null;
        const command = base(params, 'milestone', definitions.milestone);
        return {
            ...command,
            detail: current ?? command.detail ?? summarize(params, item => item.milestone?.title ?? ''),
            options: () => ({
                loading: params.loading,
                note: note(params, 'milestone'),
                options: [
                    {
                        value: '\u0000none',
                        label: t(l.noMilestone),
                        chosen: one !== undefined && current === null,
                        pick: () => params.edit({ kind: 'milestone', title: null }),
                    },
                    ...pickerOptions.milestones(params.metadata).map((option): CommandOption => ({
                        ...option,
                        chosen: option.value === current,
                        pick: () => params.edit({ kind: 'milestone', title: option.value }),
                    })),
                ],
            }),
        };
    }

    /** Issues only, of repositories that have types. */
    function issueTypeCommand(params: EditCommandsParams): Command | null {
        const issues = params.items.flatMap(item => (item.kind === 'issue' ? [item] : []));
        const offered = params.metadata.some(repository => repository.issueTypes.length > 0);
        if (issues.length < params.items.length || (!offered && !params.loading)) {
            return null;
        }

        const one = issues.length === 1 ? issues[0] : undefined;
        const current = one?.issueType?.name ?? null;
        const command = base(params, 'issueType', definitions.issueType);
        return {
            ...command,
            detail: current ?? command.detail,
            options: () => ({
                loading: params.loading,
                note: note(params, 'issueType'),
                options: [
                    {
                        value: '\u0000none',
                        label: t(l.noIssueType),
                        chosen: one !== undefined && current === null,
                        pick: () => params.edit({ kind: 'issueType', name: null }),
                    },
                    ...pickerOptions.issueTypes(params.metadata).map((option): CommandOption => ({
                        ...option,
                        chosen: option.value === current,
                        pick: () => params.edit({ kind: 'issueType', name: option.value }),
                    })),
                ],
            }),
        };
    }

    function fieldCommand(params: EditCommandsParams, role: ProjectFieldRole): Command | null {
        const places = params.places.filter(place => place.fields.some(field => getProjectFieldRole(field) === role));
        if (places.length === 0) {
            return null;
        }

        return bindCommand(
            PROJECT_FIELD_COMMANDS[role],
            {
                place: params.place,
                section: params.section,
                detail:
                    params.items.length === 1 ? describePlace(places[0], role) : summarizeField(params, places, role),
                run: () => params.inline?.[role]?.() ?? false,
                options: () => ({
                    options: fieldOptions({
                        places,
                        role,
                        now: params.now,
                        showChosen: params.items.length === 1,
                        pick: (place, field, value) => params.setField(place, field, value),
                    }),
                }),
            },
            t,
        );
    }

    /**
     * Who is asked to review one pull request: those asked and waiting marked, those who reviewed with what they
     * said — picking them asks again. Never its author. Its key opens the item view's own picker where it is shown.
     */
    function reviewersCommand(params: EditCommandsParams): Command | null {
        const pr = getOnePullRequest(params);
        if (!pr) {
            return null;
        }

        const allowed = params.getPermissions(pr).reviewers;
        const asked = new Set(pr.reviewRequests.flatMap(request => (request.kind === 'user' ? [request.login] : [])));
        return bindCommand(
            definitions.reviewers,
            {
                place: params.place,
                section: params.section,
                menu: allowed,
                run: () => params.inline?.reviewers?.() === true || !allowed,
                options: () => ({
                    loading: params.loading,
                    options: pickerOptions
                        .assignees(params.metadata, params.viewerLogin)
                        .filter(option => option.value !== pr.author?.login)
                        .map((option): CommandOption => {
                            const review = pr.latestReviews.find(candidate => candidate.author === option.value);
                            const waiting = asked.has(option.value);
                            return {
                                ...option,
                                detail: describeReview(waiting, review?.state) ?? option.detail,
                                chosen: waiting,
                                pick: () => params.edit({ kind: 'requestReviewers', logins: [option.value] }),
                            };
                        }),
                }),
            },
            t,
        );
    }

    /**
     * "Merge…" (merging D9, PM39): the merge panel for one pull request the user may merge — also while it is being
     * merged, for the panel to say so (PM24) — the first of the actions; never for several items, which merge one at
     * a time. Its title is the way forward the panel leads to, as the standing's button says (PM38): "Update branch",
     * "Resolve on GitHub", "Mark ready…", "Queue…", "Auto-merge…".
     */
    function mergeCommand(params: EditCommandsParams): Command | null {
        const pr = getOnePullRequest(params);
        const { merge } = params;
        if (!pr || !merge || !params.getPermissions(pr).mergePanel) {
            return null;
        }

        const settings = params.metadata.find(entry => entry.nameWithOwner === pr.repository.nameWithOwner);
        const autoMergeAllowed = isAutoMergeAllowed(settings, params.viewerCanEnableAutoMerge);
        return bindCommand(
            definitions.merge,
            {
                place: params.place,
                title: getVerdict({ pr, checks: params.mergeChecks ?? null, autoMergeAllowed }).forwardTitle,
                section: params.section,
                external: params.mergeExternal,
                run: () => merge(pr),
            },
            t,
        );
    }

    function ordinaryCommands(params: EditCommandsParams): Command[] {
        const pr = getOnePullRequest(params);
        const source = params.pullRequestCommands;
        return pr && source
            ? pullRequestCommands({ place: params.place, section: params.section, pr, source, checks: params.checks })
            : [];
    }

    /** One open pull request: back to a draft, or a draft ready for review. */
    function draftCommand(params: EditCommandsParams): Command | null {
        const pr = getOnePullRequest(params);
        if (!pr || !params.getPermissions(pr).draft) {
            return null;
        }

        return bindCommand(
            definitions.draft,
            {
                place: params.place,
                title: pr.isDraft ? t(l.readyForReview) : t(l.convertToDraft),
                section: params.section,
                icon: pr.isDraft ? GitPullRequest : GitPullRequestDraft,
                run: () => params.edit({ kind: 'draft', draft: !pr.isDraft }),
            },
            t,
        );
    }

    function stateCommand(params: EditCommandsParams): Command | null {
        const { stateOptions } = params;
        const [first] = stateOptions;
        if (!first) {
            return null;
        }

        const where = { place: params.place, title: params.stateTitle, section: params.section };

        // Nothing to choose between (a pull request has no reason to close for, reopening is one thing): it just runs.
        if (stateOptions.length === 1) {
            return bindCommand(
                definitions.state,
                { ...where, icon: first.icon, run: () => params.edit(first.request) },
                t,
            );
        }

        return bindCommand(
            definitions.state,
            {
                ...where,
                keywords: stateOptions.map(option => option.text),
                run: () => params.inline?.state?.() ?? false,
                options: () => ({
                    options: stateOptions.map(option => ({
                        value: option.key,
                        label: option.text,
                        icon: option.icon,
                        pick: () => params.edit(option.request),
                    })),
                }),
            },
            t,
        );
    }

    /**
     * An item property's action: offered where at least one of the items may take it, its key running the inline
     * picker even where none may — the item view then says why (K1b).
     */
    function base(params: EditCommandsParams, kind: ItemPermission, definition: AppCommand<EditPlaces>): Command {
        const editable = countEditable(params, kind);
        return bindCommand(
            definition,
            {
                place: params.place,
                section: params.section,
                menu: editable > 0,
                detail: editable < params.items.length && editable > 0 ? editableText(params, kind) : undefined,
                // Not run in place: the submenu opens — unless nothing may take it (the inline picker said why).
                run: () => params.inline?.[kind]?.() === true || editable === 0,
            },
            t,
        );
    }

    /**
     * With `summarize`, of several items: the value all of them have (none when it is empty), else "mixed" — the row's
     * detail of the assignees, the labels, the milestone and a project field.
     */
    function summarize(params: EditCommandsParams, valueOf: (item: Item) => string) {
        if (!params.summarize || params.items.length < 2) {
            return undefined;
        }

        const values = new Set(params.items.map(valueOf));
        const [value] = values;
        if (values.size > 1) {
            return t(l.mixed);
        }

        return value === '' ? undefined : value;
    }

    function note(params: EditCommandsParams, kind: ItemPermission) {
        return countEditable(params, kind) < params.items.length ? editableText(params, kind) : undefined;
    }

    function editableText(params: EditCommandsParams, kind: ItemPermission) {
        return t(l.editable, { editable: countEditable(params, kind), total: params.items.length });
    }

    /** Of several items, the field's value in the first of the projects, shared or "mixed" ({@link summarize}). */
    function summarizeField(params: EditCommandsParams, places: readonly ItemDetailProject[], role: ProjectFieldRole) {
        const [first] = places;
        const { getPlaces } = params;
        if (!first || !getPlaces) {
            return undefined;
        }

        return summarize(params, item => {
            const place = getPlaces(item).find(candidate => candidate.projectId === first.projectId);
            return describePlace(place, role) ?? '';
        });
    }

    function describeReview(waiting: boolean, state: PullRequestItem['latestReviews'][number]['state'] | undefined) {
        if (waiting) {
            return t(l.reviewPending);
        }

        switch (state) {
            case undefined:
            case 'DISMISSED':
            case 'PENDING':
                return undefined;
            case 'APPROVED':
                return `${t(l.reviewApproved)} · ${t(l.reRequest)}`;
            case 'CHANGES_REQUESTED':
                return `${t(l.reviewChangesRequested)} · ${t(l.reRequest)}`;
            case 'COMMENTED':
                return `${t(l.reviewCommented)} · ${t(l.reRequest)}`;
            default:
                return assertNever(state);
        }
    }
}

/** An action toggling values of several (assignees, labels). */
interface ToggleCommandSpec {
    readonly definition: AppCommand<EditPlaces>;
    options(): PickerOption[];
    /** The values an item has. */
    current(item: Item): string[];
}

function countEditable(params: EditCommandsParams, kind: ItemPermission) {
    return params.items.filter(item => params.getPermissions(item)[kind]).length;
}

function getOnePullRequest(params: EditCommandsParams) {
    const [one] = params.items;
    return params.items.length === 1 && one?.kind === 'pullRequest' ? one : null;
}

/** "In progress · Platform Q4": the field's value in the place, and the project's name. */
function describePlace(place: ItemDetailProject | undefined, role: ProjectFieldRole) {
    const field = place?.fields.find(candidate => getProjectFieldRole(candidate) === role);
    const value = field && place?.values[field.id];
    const text = value ? describeValue(value) : null;
    return text && place ? `${text} · ${place.title}` : undefined;
}

function describeValue(value: ProjectFieldValue) {
    switch (value.kind) {
        case 'singleSelect':
            return value.name;
        case 'iteration':
            return value.title;
        default:
            return null;
    }
}
