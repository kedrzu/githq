import type { ProjectFieldInput } from '@/edits/EditTypes.js';
import { getProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import type { ProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { getPickedValueId, toPickedInput } from '@/edits/projectFieldValues.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { ItemDetailProject, ProjectField } from '@/store/ItemDetailTypes.js';

import type { CommandOption } from './CommandTypes.js';

/** What {@link ProjectFieldOptions} offers: the keyed field of each project, and what picking a value does. */
export interface ProjectFieldOptionsParams {
    /** The projects the user may write to. */
    readonly places: readonly ItemDetailProject[];
    readonly role: ProjectFieldRole;
    /** Epoch ms: which iteration is current. */
    readonly now: number;
    /** The value of each project's field is marked as chosen (one item); left out for a selection. */
    readonly showChosen?: boolean;
    pick(place: ItemDetailProject, field: ProjectField, value: ProjectFieldInput): void;
}

/** The options of a status, priority or iteration submenu, grouped by project (E2: "Set status in two projects"). */
export type ProjectFieldOptions = (params: ProjectFieldOptionsParams) => CommandOption[];

/**
 * The options of the command menu's project field submenus: each project's status, priority or iteration, the
 * values under the project's name — the same values as the item view's pickers (`usePickerOptions`).
 */
export function useProjectFieldOptions(): ProjectFieldOptions {
    const pickerOptions = usePickerOptions();

    return params => {
        const options: CommandOption[] = [];
        for (const place of params.places) {
            const field = place.fields.find(candidate => getProjectFieldRole(candidate) === params.role);
            if (!field) {
                continue;
            }

            const chosen = getPickedValueId(place.values[field.id]);
            const { kind } = field;
            if (kind !== 'singleSelect' && kind !== 'iteration') {
                continue;
            }

            for (const option of pickerOptions.projectField(field, params.now)) {
                options.push({
                    ...option,
                    value: `${place.itemId}:${option.value}`,
                    group: place.title,
                    chosen: params.showChosen && chosen === option.value,
                    pick: () => params.pick(place, field, toPickedInput(kind, option.value)),
                });
            }
        }

        return options;
    };
}
