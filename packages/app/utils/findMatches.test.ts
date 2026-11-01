import { describe, expect, test } from 'bun:test';

import type { FindMatchesOptions } from './findMatches.js';
import { findMatches, prepareMatchTexts } from './findMatches.js';

/** Each row offers one text, itself. */
function search(query: string, titles: readonly string[], options?: FindMatchesOptions) {
    return findMatches(
        query,
        prepareMatchTexts(titles, title => [title]),
        options,
    );
}

/** The parts of `text` the ranges mark. */
function marked(text: string, ranges: readonly number[]) {
    const parts: string[] = [];
    for (let at = 0; at < ranges.length; at += 2) {
        parts.push(text.slice(ranges[at], ranges[at + 1]));
    }

    return parts;
}

describe('tiers', () => {
    test.each([
        ['in progress', 100],
        ['in prog', 80],
        ['prog in', 60],
        ['rogr', 40],
    ])('%p scores %d on In progress', (query, score) => {
        expect(search(query, ['In progress']).map(match => match.score)).toEqual([score]);
    });

    test('a typo scores by where its hit starts, below a word start and around a part', () => {
        expect(search('reactivty', ['fix reactivity map'])[0]?.score).toBe(50);
        expect(search('ctivty', ['fix reactivity map'])[0]?.score).toBe(30);
    });

    test('best first, in list order among equals', () => {
        const titles = ['the status', 'reactivity', 'a status', 'status', 'status of it'];
        expect(search('status', titles).map(match => match.row)).toEqual([
            'status',
            'status of it',
            'the status',
            'a status',
        ]);
    });
});

describe('what is found', () => {
    test.each([
        ['reactivty', 'feat(reactivity): add a map', ['reactivity']],
        ['slot hydrate', 'hydrate an empty slot', ['hydrate', 'slot']],
        ['zolty', 'Kolor: Żółty', ['Żółty']],
        ['ŻÓŁTY', 'kolor zolty', ['zolty']],
        ['ошбика', 'Ошибка сборки', ['Ошибка']],
        ['fxi', 'a fix', ['fix']],
        ["it's", "so it's fine", ["it's"]],
    ])('%p marks the original characters of %p', (query, title, parts) => {
        const [match] = search(query, [title]);
        expect(marked(title, match?.ranges ?? [])).toEqual(parts);
    });

    test.each([
        ['fx', 'a fix'],
        ['1243', 'pull 1234'],
        ['xyz', 'In progress'],
        ['fix fi', 'fix'],
    ])('%p does not find %p', (query, title) => {
        expect(search(query, [title])).toEqual([]);
    });

    test('nothing typed lists every row in order, unmarked', () => {
        const rows = ['b', 'a'];
        expect(search('  ', rows)).toEqual([
            { row: 'b', score: 0, textIndex: 0, ranges: null },
            { row: 'a', score: 0, textIndex: 0, ranges: null },
        ]);
    });

    test.each([
        ['-', 'compiler-sfc', 40, ['-']],
        ['/', 'kedrzu/githq', 40, ['/']],
        ['-', '-', 100, ['-']],
        ['🚀', '🚀 launch', 80, ['🚀']],
        ['-', 'İİ-x', 40, ['-']],
    ])('punctuation %p is literal in %p', (query, title, score, parts) => {
        const [match] = search(query, [title]);
        expect(match?.score).toBe(score);
        expect(marked(title, match?.ranges ?? [])).toEqual(parts);
    });

    test('a leading minus or quotes are not uFuzzy operators', () => {
        expect(search('-sfc', ['compiler-sfc']).map(match => match.row)).toEqual(['compiler-sfc']);
        expect(search('fix -sfc', ['fix compiler-sfc']).map(match => match.row)).toEqual(['fix compiler-sfc']);
        expect(search('"sfc fix"', ['fix compiler-sfc']).map(match => match.row)).toEqual(['fix compiler-sfc']);
    });

    test('more than 5 words filters by all of them in any order, without ranges', () => {
        const title = 'one two three four five six seven';
        const [match] = search('seven one two three four five', [title, 'one two three four five six']);
        expect(match).toMatchObject({ row: title, ranges: null });
        expect(search('seven one two three four five', ['one two three four five six'])).toEqual([]);
    });
});

describe('scattered letters', () => {
    test('are off by default', () => {
        expect(search('sts', ['Set status…'])).toEqual([]);
    });

    test('rank below the rule and keep the scores of today', () => {
        const titles = ['Set status', 'Set iteration and the status', 'sts'];
        expect(search('sts', titles, { letters: true }).map(({ row, score }) => [row, score])).toEqual([
            ['sts', 100],
            ['Set status', 18],
            ['Set iteration and the status', 1],
        ]);
    });

    test('mark each letter, touching ones as one range', () => {
        const [match] = search('stt', ['Set status'], { letters: true });
        expect(marked('Set status', match?.ranges ?? [])).toEqual(['S', 't', 't']);
        expect(search('ipg', ['In progress'], { letters: true })[0]?.ranges).toEqual([0, 1, 3, 4, 6, 7]);
        expect(search('abd', ['abcd'], { letters: true })[0]?.ranges).toEqual([0, 2, 3, 4]);
    });
});

describe('typos off', () => {
    const titles = ['Reactivity of the map', 'Żółty banner'];

    test('finds no word with a typo, which it does by default', () => {
        expect(search('reactivty', titles)).toHaveLength(1);
        expect(search('reactivty', titles, { typos: false })).toEqual([]);
    });

    test('still finds any word order, without diacritics, and marks what matched', () => {
        const [reordered] = search('map reactivity', titles, { typos: false });
        expect(reordered?.row).toBe('Reactivity of the map');
        expect(marked('Reactivity of the map', reordered?.ranges ?? [])).toEqual(['Reactivity', 'map']);
        expect(search('zolty', titles, { typos: false }).map(match => match.score)).toEqual([80]);
    });
});

describe('several texts', () => {
    const rows = [
        { title: 'Label', keyword: 'tag' },
        { title: 'tag it', keyword: 'tag' },
        { title: 'tag', keyword: 'tag' },
    ];
    const prepared = prepareMatchTexts(rows, row => [row.title, row.keyword]);

    test('one match per row, its best text, the earlier on a tie', () => {
        expect(findMatches('tag', prepared).map(match => [match.row.title, match.textIndex])).toEqual([
            ['Label', 1],
            ['tag it', 1],
            ['tag', 0],
        ]);
    });

    test('ranges point into the text that matched', () => {
        expect(findMatches('tag', prepared)[0]?.ranges).toEqual([0, 3]);
    });
});

describe('hitLimit', () => {
    test('keeps the first hits in list order, however permutations return them', () => {
        const titles = ['beta alpha 1', 'alpha beta 2', 'beta alpha 3', 'alpha beta 4'];
        const matches = search('alpha beta', titles, { hitLimit: 3 });
        expect(matches.map(match => match.row).toSorted()).toEqual(['alpha beta 2', 'beta alpha 1', 'beta alpha 3']);
    });

    test('counts rows, not their texts', () => {
        const prepared = prepareMatchTexts(['a', 'b', 'c'], () => ['match', 'match']);
        expect(findMatches('match', prepared, { hitLimit: 2 }).map(match => match.row)).toEqual(['a', 'b']);
    });

    test('holds for a literal match', () => {
        expect(search('-', ['a-', 'b-', 'c-'], { hitLimit: 1 }).map(match => match.row)).toEqual(['a-']);
    });
});
