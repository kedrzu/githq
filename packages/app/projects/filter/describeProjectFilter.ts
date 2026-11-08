import type { Language } from '@nzyme/i18n/Language.js';
import { translateToString } from '@nzyme/i18n/translateToString.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ProjectField } from '@/store/ItemDetailTypes.js';

import * as l from './describeProjectFilter.loc.js';
import { getProjectFieldsNamed } from './getProjectFieldsNamed.js';
import type { ProjectFilterOperator, ProjectFilterTerm, ProjectFilterValue } from './parseProjectFilter.js';
import { parseProjectFilter } from './parseProjectFilter.js';

/** What {@link describeProjectFilter} puts in words. */
export interface DescribeProjectFilterParams {
    /** A view's filter as written. */
    readonly filter: string;
    /** The project's own fields, named as the project names them. */
    readonly fields: readonly ProjectField[];
    readonly lang: Language;
}

/**
 * A project filter in words, one phrase per term, for a sentence (first run and loading ES19): `iteration:"Sprint 15"
 * is:open repo:fitloop/mobile` is "Iteration is Sprint 15", "State is open" and "Repository is fitloop/mobile". A
 * filter that is not well formed is its one phrase, as written.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function describeProjectFilter({ filter, fields, lang }: DescribeProjectFilterParams): string[] {
    const terms = parseProjectFilter(filter);
    if (terms === null) {
        return [filter];
    }

    const either = new Intl.ListFormat(lang, { type: 'disjunction' });
    const phrases: string[] = [];
    for (const term of terms) {
        phrases.push(...describeTerm(term));
    }

    return phrases;

    function describeTerm(term: ProjectFilterTerm): string[] {
        if (term.kind === 'text') {
            return [translateToString(term.negated ? l.notText : l.text, lang, { text: term.value })];
        }

        const qualifier = term.qualifier.toLowerCase();
        if (qualifier === 'no' || qualifier === 'has') {
            const empty = (qualifier === 'no') !== term.negated;
            return term.values.map(value =>
                translateToString(empty ? l.empty : l.set, lang, { subject: nameSubject(formatValue(value)) }),
            );
        }

        const values = either.format(term.values.map(value => formatValue(value)));
        return [
            translateToString(term.negated ? l.notEquals : l.equals, lang, {
                subject: nameSubject(term.qualifier),
                values,
            }),
        ];
    }

    /** A project field by its own name, one of GitHub's qualifiers by its name, anything else as written. */
    function nameSubject(qualifier: string): string {
        const lower = qualifier.toLowerCase();
        const [field] = getProjectFieldsNamed(fields, lower);
        if (field) {
            return field.name;
        }

        switch (lower) {
            case 'assignee':
            case 'label':
            case 'milestone':
            case 'repo':
            case 'type':
            case 'title':
            case 'is':
                return translateToString(l[lower], lang);
            default: {
                const words = qualifier.replaceAll('-', ' ');
                return words.charAt(0).toUpperCase() + words.slice(1);
            }
        }
    }
}

/** A value as the sentence says it: `Done`, `> 3`, `3–5`, `≤ 5` for `*..5`. */
function formatValue(value: ProjectFilterValue): string {
    switch (value.kind) {
        case 'equals':
            return value.value;
        case 'compare':
            return `${formatOperator(value.operator)} ${value.value}`;
        case 'range':
            if (value.from === '*') {
                return `≤ ${value.to}`;
            }

            return value.to === '*' ? `≥ ${value.from}` : `${value.from}–${value.to}`;
        default:
            return assertNever(value);
    }
}

function formatOperator(operator: ProjectFilterOperator) {
    switch (operator) {
        case '<=':
            return '≤';
        case '>=':
            return '≥';
        default:
            return operator;
    }
}
