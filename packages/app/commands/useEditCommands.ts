import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CalendarRange, CircleCheckBig, CircleDashed, Milestone, SignalHigh, Tag, UserPlus } from 'lucide-vue-next';

import type { PickerOption } from '@/components/Picker.vue';
import type { EditRequest, ProjectFieldInput } from '@/edits/EditTypes.js';
import type { EditPermissions } from '@/edits/getEditPermissions.js';
import type { ProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { getProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { ItemDetailProject, ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';

import type { Command, CommandOption } from './CommandTypes.js';
import * as l from './useEditCommands.loc.js';
import { useProjectFieldOptions } from './useProjectFieldOptions.js';

/**
 * The keys of the edits of an opened item and of the selection (M3, E1, E4) — the only place they are written:
 * the actions run by them, and the item view and the selection's toolbar draw them from here.
 */
export const EDIT_KEYS = {
    assignees: 'A',
    labels: 'L',
    milestone: 'M',
    status: 'S',
    priority: 'P',
    iteration: 'I',
    state: 'Shift+X',
    reviewers: 'Shift+R',
    comment: 'R',
} as const;

/** An edit with an action of its own here. */
export type EditCommandKind = 'assignees' | 'labels' | 'milestone' | ProjectFieldRole | 'state';

/** An entry of the close / reopen submenu. */
export interface StateOption {
    readonly key: string;
    readonly text: string;
    readonly request: EditRequest;
}

/** What {@link useEditCommands} builds the actions from; read every time they are. */
export interface EditCommandsParams {
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
    /** Makes the change of every item (through the edit engine). */
    edit(request: EditRequest): void;
    /** Sets a project field's value of every item: of one place for one item, of the project for a selection. */
    setField(place: ItemDetailProject, field: ProjectField, value: ProjectFieldInput | null): void;
    /**
     * What a key opens in place of the menu: the item view's or the toolbar's own picker; `false` when it is not
     * shown — the key then opens the menu's submenu.
     */
    readonly inline?: Partial<Record<EditCommandKind, () => boolean>>;
}

/**
 * The edit actions of an opened item or of the items selected together (E1, E2, E4): assign, label, milestone, a
 * project's status, priority and iteration, close or reopen — offered only where the user may make them (D14,
 * K1b; "2 of 3 editable" where only some of the items take it), each with a submenu of the values, made through
 * the edit engine. A value already set on the one item is marked and taken away when picked again.
 */
export function useEditCommands(): (params: EditCommandsParams) => Command[] {
    const t = useTranslate();
    const pickerOptions = usePickerOptions();
    const fieldOptions = useProjectFieldOptions();

    return params =>
        [
            toggleCommand(params, 'assignees', {
                title: t(l.assign),
                icon: UserPlus,
                keywords: [t(l.assignees)],
                options: () => pickerOptions.assignees(params.metadata, params.viewerLogin),
                current: item => item.assignees.map(user => user.login),
            }),
            toggleCommand(params, 'labels', {
                title: t(l.labels),
                icon: Tag,
                keywords: [t(l.label)],
                options: () => pickerOptions.labels(params.metadata),
                current: item => item.labels.map(label => label.name),
            }),
            milestoneCommand(params),
            fieldCommand(params, 'status', t(l.setStatus), CircleDashed),
            fieldCommand(params, 'priority', t(l.setPriority), SignalHigh),
            fieldCommand(params, 'iteration', t(l.setIteration), CalendarRange),
            stateCommand(params),
        ].filter(command => command !== null);

    function toggleCommand(params: EditCommandsParams, kind: 'assignees' | 'labels', spec: ToggleCommandSpec): Command {
        const one = params.items.length === 1 ? params.items[0] : undefined;
        const current = one ? spec.current(one) : [];
        return {
            ...base(params, kind, spec.title, spec.icon),
            keywords: spec.keywords,
            options: () => ({
                loading: params.loading,
                note: note(params, kind),
                options: spec.options().map((option): CommandOption => ({
                    ...option,
                    chosen: current.includes(option.value),
                    pick: () =>
                        params.edit(
                            current.includes(option.value)
                                ? { kind, add: [], remove: [option.value] }
                                : { kind, add: [option.value], remove: [] },
                        ),
                })),
            }),
        };
    }

    function milestoneCommand(params: EditCommandsParams): Command {
        const one = params.items.length === 1 ? params.items[0] : undefined;
        const current = one?.milestone?.title ?? null;
        return {
            ...base(params, 'milestone', t(l.setMilestone), Milestone),
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

    function fieldCommand(
        params: EditCommandsParams,
        role: ProjectFieldRole,
        title: string,
        icon: LucideIcon,
    ): Command | null {
        const places = params.places.filter(place => place.fields.some(field => getProjectFieldRole(field) === role));
        if (places.length === 0) {
            return null;
        }

        return {
            id: `${params.section}.${role}`,
            title,
            section: params.section,
            key: EDIT_KEYS[role],
            icon,
            detail: params.items.length === 1 ? describeFirst(places, role) : undefined,
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
        };
    }

    function stateCommand(params: EditCommandsParams): Command | null {
        if (params.stateOptions.length === 0) {
            return null;
        }

        return {
            id: `${params.section}.state`,
            title: params.stateTitle,
            section: params.section,
            key: EDIT_KEYS.state,
            icon: CircleCheckBig,
            keywords: params.stateOptions.map(option => option.text),
            run: () => params.inline?.state?.() ?? false,
            options: () => ({
                options: params.stateOptions.map(option => ({
                    value: option.key,
                    label: option.text,
                    pick: () => params.edit(option.request),
                })),
            }),
        };
    }

    /**
     * An item property's action: offered where at least one of the items may take it, its key running the inline
     * picker even where none may — the item view then says why (K1b).
     */
    function base(
        params: EditCommandsParams,
        kind: 'assignees' | 'labels' | 'milestone',
        title: string,
        icon: LucideIcon,
    ): Command {
        const editable = countEditable(params, kind);
        return {
            id: `${params.section}.${kind}`,
            title,
            section: params.section,
            key: EDIT_KEYS[kind],
            icon,
            menu: editable > 0,
            detail: editable < params.items.length && editable > 0 ? editableText(params, kind) : undefined,
            // Not run in place: the submenu opens — unless nothing may take it (the inline picker said why).
            run: () => params.inline?.[kind]?.() === true || editable === 0,
        };
    }

    function note(params: EditCommandsParams, kind: 'assignees' | 'labels' | 'milestone') {
        return countEditable(params, kind) < params.items.length ? editableText(params, kind) : undefined;
    }

    function editableText(params: EditCommandsParams, kind: 'assignees' | 'labels' | 'milestone') {
        return t(l.editable, { editable: countEditable(params, kind), total: params.items.length });
    }

    function describeFirst(places: readonly ItemDetailProject[], role: ProjectFieldRole) {
        const [first] = places;
        const field = first?.fields.find(candidate => getProjectFieldRole(candidate) === role);
        const value = field && first?.values[field.id];
        const text = value ? describeValue(value) : null;
        return text && first ? `${text} · ${first.title}` : undefined;
    }
}

/** An action toggling values of several (assignees, labels). */
interface ToggleCommandSpec {
    readonly title: string;
    readonly icon: LucideIcon;
    readonly keywords: readonly string[];
    options(): PickerOption[];
    /** The values the one item has. */
    current(item: Item): string[];
}

function countEditable(params: EditCommandsParams, kind: 'assignees' | 'labels' | 'milestone') {
    return params.items.filter(item => params.getPermissions(item)[kind]).length;
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
