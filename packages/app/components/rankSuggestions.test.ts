import { expect, test } from 'bun:test';

import { rankPeople, rankReferences } from './rankSuggestions.js';
import type { PersonSuggestion, ReferenceSuggestion } from './SuggestionTypes.js';

test("people: the login first, then a word of the name, then anything holding it; a thread's people first among equals", () => {
    const thread = [person('jason', 'Jason Moss'), person('mlaine', 'Mikko Laine')];
    const repository = [person('sofiab', 'Sofia Berg'), person('ksoren', 'Søren Holm'), person('mlaine', null)];

    expect(logins(rankPeople('so', [...thread, ...repository]))).toEqual(['sofiab', 'jason', 'ksoren']);
    expect(logins(rankPeople('berg', [...thread, ...repository]))).toEqual(['sofiab']);
    expect(logins(rankPeople('SOFIAB', [...thread, ...repository]))).toEqual(['sofiab']);
    // Nothing typed: everyone, the thread's first, each once.
    expect(logins(rankPeople('', [...thread, ...repository]))).toEqual(['jason', 'mlaine', 'sofiab', 'ksoren']);
});

test('people: a handful at most', () => {
    const many = Array.from({ length: 20 }, (_, index) => person(`user${index}`, null));
    expect(rankPeople('user', many)).toHaveLength(6);
});

test('references: digits find that number, then the numbers starting with them, then titles holding them', () => {
    const items = [
        reference(120, 'Lists flash empty'),
        reference(7, 'Upgrade to v12'),
        reference(12, 'Sub-issue links are lost'),
        reference(312, 'Rebuild links'),
    ];

    expect(numbers(rankReferences('12', items))).toEqual([12, 120, 7]);
});

test('references: words find by a word of the title, then by the title holding them; nothing typed keeps the order given', () => {
    const items = [
        reference(14, 'Store project items'),
        reference(11, 'Lists restore their scroll'),
        reference(10, 'Rebuild links'),
    ];

    expect(numbers(rankReferences('sto', items))).toEqual([14, 11]);
    expect(numbers(rankReferences('LINK', items))).toEqual([10]);
    expect(numbers(rankReferences('', items))).toEqual([14, 11, 10]);
});

function person(login: string, name: string | null): PersonSuggestion {
    return { login, name, avatarUrl: `https://avatars.test/${login}` };
}

function reference(number: number, title: string): ReferenceSuggestion {
    return { kind: 'issue', state: 'OPEN', stateReason: null, number, title };
}

function logins(people: readonly PersonSuggestion[]) {
    return people.map(({ login }) => login);
}

function numbers(items: readonly ReferenceSuggestion[]) {
    return items.map(({ number }) => number);
}
