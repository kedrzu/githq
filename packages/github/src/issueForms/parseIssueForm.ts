import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/**
 * An issue form (`.github/ISSUE_TEMPLATE/*.yml`) as githq uses it: what it sets on the issue and the fields it
 * asks for. GitHub's own form page validates and renders it; githq only shows it as a pre-filled markdown body
 * (H8) or hands the user off to that page (D14).
 */
export interface IssueForm {
    /** The file's name in `.github/ISSUE_TEMPLATE` — what `?template=` names. */
    readonly filename: string;
    readonly name: string;
    readonly description: string | null;
    /** The title the form pre-fills ("[Bug]: "). */
    readonly title: string | null;
    readonly labels: readonly string[];
    readonly assignees: readonly string[];
    /** The issue type's name. */
    readonly type: string | null;
    /** The fields, in order; markdown blocks (text for the reader only) left out. */
    readonly fields: readonly IssueFormField[];
}

/** A field of an issue form. */
export type IssueFormField =
    | (IssueFormFieldBase & {
          readonly kind: 'input' | 'textarea';
          readonly placeholder: string | null;
          /** What it is pre-filled with. */
          readonly value: string | null;
      })
    | (IssueFormFieldBase & { readonly kind: 'dropdown'; readonly options: readonly string[] })
    | (IssueFormFieldBase & { readonly kind: 'checkboxes'; readonly options: readonly IssueFormCheckbox[] });

/** What every field of an issue form has. */
export interface IssueFormFieldBase {
    readonly label: string;
    readonly description: string | null;
    readonly required: boolean;
}

/** One box of a `checkboxes` field. */
export interface IssueFormCheckbox {
    readonly label: string;
    readonly required: boolean;
}

/**
 * Reads an issue form from its YAML; `null` when it is not one (not YAML, no `name` or `body`). Fields of a kind
 * GitHub may add later are left out. The YAML parser is loaded only when a form is read.
 */
export async function parseIssueForm(filename: string, text: string): Promise<IssueForm | null> {
    const { parse } = await import('yaml');
    let document: unknown;
    try {
        document = parse(text);
    } catch {
        return null;
    }

    if (!isPlainObject(document) || typeof document.name !== 'string' || !Array.isArray(document.body)) {
        return null;
    }

    const fields: IssueFormField[] = [];
    for (const entry of document.body) {
        const field = readField(entry);
        if (field) {
            fields.push(field);
        }
    }

    return {
        filename,
        name: document.name,
        description: readString(document.description),
        title: readString(document.title),
        labels: readNames(document.labels),
        assignees: readNames(document.assignees),
        type: readString(document.type),
        fields,
    };
}

function readField(entry: unknown): IssueFormField | null {
    if (!isPlainObject(entry) || !isPlainObject(entry.attributes)) {
        return null;
    }

    const { attributes } = entry;
    const label = readString(attributes.label);
    if (label === null) {
        return null;
    }

    const base: IssueFormFieldBase = {
        label,
        description: readString(attributes.description),
        required: isPlainObject(entry.validations) && entry.validations.required === true,
    };

    switch (entry.type) {
        case 'input':
        case 'textarea':
            return {
                ...base,
                kind: entry.type,
                placeholder: readString(attributes.placeholder),
                value: readString(attributes.value),
            };
        case 'dropdown':
            return { ...base, kind: 'dropdown', options: readNames(attributes.options) };
        case 'checkboxes': {
            const options: IssueFormCheckbox[] = [];
            for (const option of Array.isArray(attributes.options) ? attributes.options : []) {
                if (isPlainObject(option) && typeof option.label === 'string') {
                    options.push({ label: option.label, required: option.required === true });
                }
            }

            return { ...base, kind: 'checkboxes', options };
        }
        default:
            return null;
    }
}

function readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** A list of names, written as a YAML list or as one comma-separated string (both are allowed in forms). */
function readNames(value: unknown): string[] {
    const entries = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
    const names: string[] = [];
    for (const entry of entries) {
        const name = typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : '';
        if (name) {
            names.push(name);
        }
    }

    return names;
}
