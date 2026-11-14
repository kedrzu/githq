import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

/** A workflow file (`.github/workflows/*.yml`) as githq uses it: what starts it, and what a dispatch asks for. */
export interface GitHubWorkflowFile {
    /** The events of its `on:`, in the file's order. */
    readonly triggers: readonly GitHubWorkflowTrigger[];
    /** What a manual run asks for; `null` when the workflow cannot be run by hand (no `workflow_dispatch`). */
    readonly dispatch: GitHubWorkflowDispatch | null;
    /** Only other workflows can run it (`workflow_call` is its one trigger): no runs of its own to show. */
    readonly callOnly: boolean;
}

/** One event of a workflow's `on:`. */
export interface GitHubWorkflowTrigger {
    /** `push`, `pull_request`, `schedule`, `workflow_dispatch`, `workflow_call`, … */
    readonly event: string;
    /** The branch patterns it is limited to (`branches:`); absent when it names none. */
    readonly branches?: readonly string[];
    /** The tag patterns it is limited to (`tags:`); absent when it names none. */
    readonly tags?: readonly string[];
    /** The branch patterns it skips (`branches-ignore:`); absent when it names none. */
    readonly branchesIgnore?: readonly string[];
    /** The tag patterns it skips (`tags-ignore:`); absent when it names none. */
    readonly tagsIgnore?: readonly string[];
}

/** What `workflow_dispatch` declares. */
export interface GitHubWorkflowDispatch {
    /** In the file's order. */
    readonly inputs: readonly WorkflowInput[];
}

/** One input of `workflow_dispatch`. */
export interface WorkflowInput {
    readonly name: string;
    /** `string` when the file names none, or a type GitHub does not know. */
    readonly type: WorkflowInputType;
    readonly required: boolean;
    readonly default?: string | number | boolean;
    /** The choices of a `choice` input. */
    readonly options?: readonly string[];
    readonly description?: string;
}

/** The types a `workflow_dispatch` input can be. */
export type WorkflowInputType = 'string' | 'choice' | 'boolean' | 'number' | 'environment';

/** A workflow file read, or why it could not be: no such file, not YAML, or no `on:` to start it. */
export type GitHubWorkflowFileParse =
    | { readonly kind: 'parsed'; readonly file: GitHubWorkflowFile }
    | { readonly kind: 'missing' }
    | { readonly kind: 'notYaml' }
    | { readonly kind: 'noTriggers' };

/**
 * Reads a workflow file's triggers and dispatch inputs from its YAML; `text` is `null` when there is no such file.
 * Never throws: what is not a workflow answers why. The YAML parser is loaded only when a file is read.
 */
export async function parseWorkflowFile(text: string | null): Promise<GitHubWorkflowFileParse> {
    if (text === null) {
        return { kind: 'missing' };
    }

    const { parse } = await import('yaml');
    let document: unknown;
    try {
        document = parse(text);
    } catch {
        return { kind: 'notYaml' };
    }

    if (!isPlainObject(document)) {
        return { kind: 'noTriggers' };
    }

    // A YAML 1.1 parser reads an unquoted `on` key as `true`; the `yaml` package (1.2) keeps it a string.
    const events = readEvents(document.on ?? document.true);
    if (events.length === 0) {
        return { kind: 'noTriggers' };
    }

    const triggers: GitHubWorkflowTrigger[] = [];
    let dispatch: GitHubWorkflowDispatch | null = null;
    for (const { event, config } of events) {
        triggers.push(readTrigger(event, config));
        if (event === 'workflow_dispatch') {
            dispatch = { inputs: readInputs(config) };
        }
    }

    return {
        kind: 'parsed',
        file: { triggers, dispatch, callOnly: triggers.every(trigger => trigger.event === 'workflow_call') },
    };
}

interface WorkflowEvent {
    readonly event: string;
    /** What the event's key holds in the map form; `null` in the string and list forms. */
    readonly config: unknown;
}

/** `on:` as a string (`on: push`), a list (`on: [push, pull_request]`) or a map of events to their settings. */
function readEvents(on: unknown): WorkflowEvent[] {
    if (typeof on === 'string') {
        return on.trim() ? [{ event: on.trim(), config: null }] : [];
    }

    const events: WorkflowEvent[] = [];
    if (Array.isArray(on)) {
        for (const entry of on) {
            if (typeof entry === 'string' && entry.trim()) {
                events.push({ event: entry.trim(), config: null });
            }
        }
    } else if (isPlainObject(on)) {
        for (const [event, config] of Object.entries(on)) {
            events.push({ event, config });
        }
    }

    return events;
}

function readTrigger(event: string, config: unknown): GitHubWorkflowTrigger {
    if (!isPlainObject(config)) {
        return { event };
    }

    const branches = readPatterns(config.branches);
    const tags = readPatterns(config.tags);
    const branchesIgnore = readPatterns(config['branches-ignore']);
    const tagsIgnore = readPatterns(config['tags-ignore']);
    return {
        event,
        ...(branches && { branches }),
        ...(tags && { tags }),
        ...(branchesIgnore && { branchesIgnore }),
        ...(tagsIgnore && { tagsIgnore }),
    };
}

/** A filter's patterns, a list or one string; `undefined` when it names none. */
function readPatterns(value: unknown): string[] | undefined {
    const entries: unknown[] = Array.isArray(value) ? value : [value];
    const patterns: string[] = [];
    for (const entry of entries) {
        if (typeof entry === 'string' || typeof entry === 'number') {
            patterns.push(String(entry));
        }
    }

    return patterns.length > 0 ? patterns : undefined;
}

function readInputs(config: unknown): WorkflowInput[] {
    if (!isPlainObject(config) || !isPlainObject(config.inputs)) {
        return [];
    }

    const inputs: WorkflowInput[] = [];
    for (const [name, declared] of Object.entries(config.inputs)) {
        const settings: Record<string, unknown> = isPlainObject(declared) ? declared : {};
        const type = readInputType(settings.type);
        const value = settings.default;
        const options = type === 'choice' ? readPatterns(settings.options) : undefined;
        inputs.push({
            name,
            type,
            required: settings.required === true,
            ...((typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && {
                default: value,
            }),
            ...(options && { options }),
            ...(typeof settings.description === 'string' && { description: settings.description }),
        });
    }

    return inputs;
}

function readInputType(type: unknown): WorkflowInputType {
    switch (type) {
        case 'choice':
        case 'boolean':
        case 'number':
        case 'environment':
            return type;
        default:
            return 'string';
    }
}
