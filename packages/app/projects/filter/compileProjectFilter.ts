import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ProjectField, ProjectFieldValue, ProjectIteration } from '@/store/ItemDetailTypes.js';

import type { ProjectEntry } from '../ProjectTypes.js';
import type { ProjectFilterOperator, ProjectFilterTerm, ProjectFilterValue } from './parseProjectFilter.js';
import { parseProjectFilter } from './parseProjectFilter.js';

// What githq evaluates of GitHub's project filter syntax, as GitHub documents it in "Filtering projects"
// (https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/filtering-projects,
// read 2026-10-31) and as GitHub's own answers (`items(query:)`) agreed with it on public projects the same day —
// where they did not, the form is left out. Anything not listed here is "unsupported": the view is answered by
// GitHub instead (K6), never guessed.
//
// - terms are ANDed; `a,b` ORs values of one qualifier; `-` negates a term (`-no:x` is `has:x`);
// - `assignee:` logins or `@me`; `label:` names, `*` wildcards; `milestone:`; `repo:owner/name`; `type:` (issue
//   type); `title:` exact or with `*` wildcards;
// - `is:open|closed|merged|issue|pr` (`is:closed` includes merged pull requests) and `is:draft` for draft issues.
//   In a project holding draft issues, `is:open`, `is:closed` and `is:issue` are GitHub's: whether a draft issue
//   counts as open or as an issue is not documented. In one holding draft pull requests, `is:draft` is: the docs
//   say it matches them, GitHub's answer did not;
// - `no:` / `has:` with `assignee`, `label`, `milestone`, `type` or a project field;
// - a project field by its name, case-insensitive, spaces written as `-`: a single select by option name; text
//   exactly or with `*`; numbers and dates (`YYYY-MM-DD`, `@today`, `@today-7d`, `@today+1w`) equal, compared
//   (`>`, `>=`, `<`, `<=`) or in a range (`a..b`, `*` open); iterations by title, `@current`, `@next`, `@previous`
//   (`@current+2`), compared or in a range by their order.
//
// Values compare case-insensitively, as GitHub's examples do (`status:done` for "Done"). Today is the UTC day,
// as githq reads GitHub's days everywhere (`isCurrentIteration`, `formatShortDate`). GitHub's, among others: free
// text (GitHub matched more items than titles and text fields hold), a quoted field name (GitHub's answer matched
// nothing), `reason:` (GitHub counts closed pull requests as completed), `reviewers:`, `updated:` /
// `last-updated:` (the documented meaning of `>` there contradicts the dates'), `parent-issue:`,
// `linked-pull-requests:`, `sub-issues-progress:`, multi-select fields, and a project field whose name is also a
// qualifier GitHub reserves — one of the above, evaluated or not.

/** What {@link compileProjectFilter} evaluates a filter with. */
export interface CompileProjectFilterParams {
    /** A saved view's filter; `null` or empty for every item. */
    readonly filter: string | null;
    /** The project's own fields. */
    readonly fields: readonly ProjectField[];
    /** For `@me`. */
    readonly viewerLogin: string;
    /** Today's UTC day, `YYYY-MM-DD`: `@today` and the current iteration. */
    readonly today: string;
    /** The project holds draft issues: `is:open`, `is:closed` and `is:issue` are not evaluated then. */
    readonly hasDrafts: boolean;
    /** The project holds draft pull requests: `is:draft` is not evaluated then. */
    readonly hasDraftPullRequests: boolean;
}

/** A filter githq evaluates itself, or one it leaves to GitHub. */
export type CompiledProjectFilter =
    | { readonly kind: 'local'; readonly matches: (entry: ProjectEntry) => boolean }
    /** `term`: the first term githq can't evaluate, as written — what the view says it is answered for. */
    | { readonly kind: 'github'; readonly term: string };

type Predicate = (entry: ProjectEntry) => boolean;

/** What a qualifier's value compares against, for numbers, dates and iterations. */
interface Ordered {
    /** The item's value as an ordered key (a day as epoch ms); `null` when it has none. */
    readonly read: (entry: ProjectEntry) => number | null;
    /** A value as written, as the same kind of key; `null` when githq can't tell what it means. */
    readonly parse: (value: string) => number | null;
}

/** The qualifiers GitHub itself defines that githq evaluates (unless a project field is named the same). */
const BUILT_IN = new Set(['assignee', 'label', 'milestone', 'repo', 'type', 'title', 'is', 'no', 'has']);
/**
 * Every qualifier GitHub reserves ("Filtering projects", and the ones its answers showed): a term with one githq
 * does not evaluate is GitHub's, even when a project field has that name — GitHub reads it as its own.
 */
const RESERVED = new Set([
    ...BUILT_IN,
    'reason',
    'reviewers',
    'updated',
    'last-updated',
    'parent-issue',
    'sub-issues-progress',
    'linked-pull-requests',
]);

const DAY_MS = 86_400_000;

/**
 * A saved view's filter as a test of the project's entries — or, for one githq can't evaluate the way GitHub does,
 * which term it is (see the supported subset above). Archived items are not its concern: views never show them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function compileProjectFilter(params: CompileProjectFilterParams): CompiledProjectFilter {
    const filter = params.filter?.trim() ?? '';
    const terms = parseProjectFilter(filter);
    if (terms === null) {
        return { kind: 'github', term: filter };
    }

    const predicates: Predicate[] = [];
    for (const term of terms) {
        const predicate = compileTerm(term, params);
        if (!predicate) {
            return { kind: 'github', term: term.text };
        }

        predicates.push(term.negated ? entry => !predicate(entry) : predicate);
    }

    return { kind: 'local', matches: entry => predicates.every(predicate => predicate(entry)) };
}

function compileTerm(term: ProjectFilterTerm, params: CompileProjectFilterParams): Predicate | null {
    // Free text: GitHub matches more than the docs say (titles and text fields) — it is GitHub's.
    if (term.kind === 'text') {
        return null;
    }

    const values = term.values;
    // A quoted field name: GitHub's answer to `"story points":<3` matched nothing where `story-points:<3` did.
    if (term.quotedQualifier || values.length === 0 || values.some(value => isEmpty(value))) {
        return null;
    }

    const qualifier = term.qualifier.toLowerCase();
    if (RESERVED.has(qualifier) && !BUILT_IN.has(qualifier)) {
        return null;
    }

    if (BUILT_IN.has(qualifier)) {
        // A project field of the same name: which of the two GitHub means is unknown.
        return getFieldsNamed(params.fields, qualifier).length > 0 ? null : compileBuiltIn(qualifier, values, params);
    }

    const field = findField(params.fields, qualifier);
    return field ? compileField(field, values, params) : null;
}

function compileBuiltIn(
    qualifier: string,
    values: readonly ProjectFilterValue[],
    params: CompileProjectFilterParams,
): Predicate | null {
    switch (qualifier) {
        case 'assignee':
            return anyOf(values, value => {
                if (value.kind !== 'equals' || value.value.includes('*')) {
                    return null;
                }

                const login = value.value === '@me' ? params.viewerLogin : value.value;
                if (login.startsWith('@')) {
                    return null;
                }

                return entry => getAssignees(entry).some(user => same(user, login));
            });
        case 'label':
            return anyOf(values, value =>
                textMatcher(
                    value,
                    matches => entry => (entry.content?.labels ?? []).some(label => matches(label.name)),
                ),
            );
        case 'milestone':
            return anyOf(values, value =>
                value.kind === 'equals' && !value.value.includes('*')
                    ? entry => same(entry.content?.milestone?.title, value.value)
                    : null,
            );
        case 'repo':
            return anyOf(values, value =>
                value.kind === 'equals' && !value.value.includes('*')
                    ? entry => same(entry.content?.repository.nameWithOwner, value.value)
                    : null,
            );
        case 'type':
            return anyOf(values, value =>
                value.kind === 'equals' && !value.value.includes('*')
                    ? entry => entry.content?.kind === 'issue' && same(entry.content.issueType?.name, value.value)
                    : null,
            );
        case 'title':
            return anyOf(values, value => textMatcher(value, matches => entry => matches(getTitle(entry))));
        case 'is':
            return anyOf(values, value => compileIs(value, params));
        case 'no':
        case 'has': {
            const [value] = values;
            if (values.length !== 1 || value?.kind !== 'equals') {
                return null;
            }

            const present = compilePresence(value.value.toLowerCase(), params.fields);
            if (!present) {
                return null;
            }

            return qualifier === 'has' ? present : entry => !present(entry);
        }
        default:
            return null;
    }
}

function compileIs(value: ProjectFilterValue, params: CompileProjectFilterParams): Predicate | null {
    const { hasDrafts, hasDraftPullRequests } = params;
    if (value.kind !== 'equals') {
        return null;
    }

    switch (value.value.toLowerCase()) {
        case 'open':
            return hasDrafts ? null : entry => entry.content?.state === 'OPEN';
        case 'closed':
            return hasDrafts ? null : entry => entry.content !== null && entry.content.state !== 'OPEN';
        case 'issue':
            return hasDrafts ? null : entry => entry.content?.kind === 'issue';
        case 'merged':
            return entry => entry.content?.kind === 'pullRequest' && entry.content.merged;
        case 'pr':
            return entry => entry.content?.kind === 'pullRequest';
        case 'draft':
            return hasDraftPullRequests ? null : entry => entry.item.draft !== null;
        default:
            return null;
    }
}

/** `has:<name>`: the entry has a value of it. */
function compilePresence(name: string, fields: readonly ProjectField[]): Predicate | null {
    if (RESERVED.has(name) && (!BUILT_IN.has(name) || getFieldsNamed(fields, name).length > 0)) {
        return null;
    }

    switch (name) {
        case 'assignee':
            return entry => getAssignees(entry).length > 0;
        case 'label':
            return entry => (entry.content?.labels.length ?? 0) > 0;
        case 'milestone':
            return entry => entry.content?.milestone != null;
        case 'type':
            return entry => entry.content?.kind === 'issue' && entry.content.issueType !== null;
        default: {
            if (RESERVED.has(name)) {
                return null;
            }

            const field = findField(fields, name);
            return field && field.kind !== 'multiSelect' ? entry => getValue(entry, field) !== undefined : null;
        }
    }
}

function compileField(
    field: ProjectField,
    values: readonly ProjectFilterValue[],
    params: CompileProjectFilterParams,
): Predicate | null {
    switch (field.kind) {
        case 'singleSelect':
            return anyOf(values, value =>
                value.kind === 'equals' && !value.value.includes('*')
                    ? entry => {
                          const held = getValue(entry, field);
                          return held?.kind === 'singleSelect' && same(held.name, value.value);
                      }
                    : null,
            );
        case 'text':
            return anyOf(values, value =>
                textMatcher(value, matches => entry => {
                    const held = getValue(entry, field);
                    return held?.kind === 'text' && matches(held.text);
                }),
            );
        case 'number':
            return compileOrdered(values, {
                read: entry => {
                    const held = getValue(entry, field);
                    return held?.kind === 'number' ? held.number : null;
                },
                parse: parseNumber,
            });
        case 'date':
            return compileOrdered(values, {
                read: entry => {
                    const held = getValue(entry, field);
                    return held?.kind === 'date' ? toDayMs(held.date.slice(0, 10)) : null;
                },
                parse: value => {
                    const day = parseDate(value, params.today);
                    return day === null ? null : toDayMs(day);
                },
            });
        case 'iteration': {
            const iterations = [...field.completedIterations, ...field.iterations].toSorted((a, b) =>
                a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
            );
            return compileOrdered(values, {
                read: entry => {
                    const held = getValue(entry, field);
                    return held?.kind === 'iteration' ? toDayMs(held.startDate) : null;
                },
                parse: value => {
                    const iteration = findIteration(iterations, value, params.today);
                    return iteration ? toDayMs(iteration.startDate) : null;
                },
            });
        }
        case 'multiSelect':
            return null;
        default:
            return assertNever(field);
    }
}

/** Equal, compared or in a range: each value as the field's ordered key. */
function compileOrdered(values: readonly ProjectFilterValue[], ordered: Ordered): Predicate | null {
    return anyOf(values, value => {
        switch (value.kind) {
            case 'equals': {
                const wanted = ordered.parse(value.value);
                return wanted === null ? null : entry => ordered.read(entry) === wanted;
            }
            case 'compare': {
                const wanted = ordered.parse(value.value);
                const { operator } = value;
                return wanted === null
                    ? null
                    : entry => {
                          const held = ordered.read(entry);
                          return held !== null && compare(held, operator, wanted);
                      };
            }
            case 'range': {
                const from = value.from === '*' ? undefined : ordered.parse(value.from);
                const to = value.to === '*' ? undefined : ordered.parse(value.to);
                if (from === null || to === null) {
                    return null;
                }

                return entry => {
                    const held = ordered.read(entry);
                    return (
                        held !== null &&
                        (from === undefined || compare(held, '>=', from)) &&
                        (to === undefined || compare(held, '<=', to))
                    );
                };
            }
            default:
                return assertNever(value);
        }
    });
}

/** A value matched as text: exactly, or with `*` standing for anything. */
function textMatcher(
    value: ProjectFilterValue,
    build: (matches: (text: string) => boolean) => Predicate,
): Predicate | null {
    if (value.kind !== 'equals') {
        return null;
    }

    if (!value.value.includes('*')) {
        return build(text => same(text, value.value));
    }

    const pattern = value.value
        .split('*')
        .map(part => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
    const regex = new RegExp(`^${pattern}$`, 'iu');
    return build(text => regex.test(text));
}

/** Any of the values; `null` when githq can't evaluate one of them. */
function anyOf(
    values: readonly ProjectFilterValue[],
    compileValue: (value: ProjectFilterValue) => Predicate | null,
): Predicate | null {
    const predicates: Predicate[] = [];
    for (const value of values) {
        const predicate = compileValue(value);
        if (!predicate) {
            return null;
        }

        predicates.push(predicate);
    }

    return entry => predicates.some(predicate => predicate(entry));
}

/** The field a qualifier names: by name, case-insensitive, spaces written as `-` or the name quoted. */
function findField(fields: readonly ProjectField[], qualifier: string) {
    const matching = getFieldsNamed(fields, qualifier);
    // Two fields answering to the name: which one GitHub means is unknown.
    return matching.length === 1 ? (matching[0] ?? null) : null;
}

function getFieldsNamed(fields: readonly ProjectField[], qualifier: string) {
    return fields.filter(field => {
        const name = field.name.toLowerCase();
        return name === qualifier || name.replaceAll(/\s+/g, '-') === qualifier;
    });
}

/**
 * An iteration as a filter names it: its title, or `@current`, `@next`, `@previous` with an offset (`@current+2`).
 * `null` when there is none such — e.g. no iteration runs today.
 */
function findIteration(iterations: readonly ProjectIteration[], value: string, today: string) {
    const keyword = /^@(current|next|previous)([+-]\d+)?$/i.exec(value);
    if (!keyword) {
        return iterations.find(iteration => same(iteration.title, value)) ?? null;
    }

    const current = iterations.findIndex(
        iteration => iteration.startDate <= today && today < addDays(iteration.startDate, iteration.duration),
    );
    if (current === -1) {
        return null;
    }

    const base = { current: 0, next: 1, previous: -1 }[(keyword[1] ?? 'current').toLowerCase()] ?? 0;
    return iterations[current + base + Number(keyword[2] ?? 0)] ?? null;
}

/** `YYYY-MM-DD`, `@today`, `@today-7d`, `@today+1w` (days when no unit is written). */
function parseDate(value: string, today: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const relative = /^@today(?:([+-])(\d+)([dw])?)?$/i.exec(value);
    if (!relative) {
        return null;
    }

    const [, sign, amount, unit] = relative;
    const days = Number(amount ?? 0) * (unit?.toLowerCase() === 'w' ? 7 : 1);
    return addDays(today, sign === '-' ? -days : days);
}

function parseNumber(value: string) {
    return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null;
}

function addDays(day: string, days: number) {
    return new Date(toDayMs(day) + days * DAY_MS).toISOString().slice(0, 10);
}

function toDayMs(day: string) {
    return Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
}

function compare(held: number, operator: ProjectFilterOperator, wanted: number) {
    switch (operator) {
        case '<':
            return held < wanted;
        case '<=':
            return held <= wanted;
        case '>':
            return held > wanted;
        case '>=':
            return held >= wanted;
        default:
            return assertNever(operator);
    }
}

function getValue(entry: ProjectEntry, field: ProjectField): ProjectFieldValue | undefined {
    return entry.item.values[field.id];
}

function getTitle(entry: ProjectEntry) {
    return entry.content?.title ?? entry.item.draft?.title ?? '';
}

function getAssignees(entry: ProjectEntry) {
    return (entry.content?.assignees ?? entry.item.draft?.assignees ?? []).map(user => user.login);
}

function same(a: string | null | undefined, b: string) {
    return a != null && a.toLowerCase() === b.toLowerCase();
}

function isEmpty(value: ProjectFilterValue) {
    switch (value.kind) {
        case 'equals':
        case 'compare':
            return value.value === '';
        case 'range':
            return value.from === '' || value.to === '';
        default:
            return assertNever(value);
    }
}
