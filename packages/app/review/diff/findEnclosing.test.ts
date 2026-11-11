import { expect, test } from 'bun:test';

import { findEnclosing } from './findEnclosing.js';

const LINES = [
    'import { a } from "a";',
    '',
    'export class SyncEngine {',
    '    first() {',
    '        one();',
    '    }',
    '',
    '    second() {',
    '        two();',
    '    }',
    '}',
    '',
    'const top = 1;',
];

test('the nearest earlier line indented less is what a line sits in', () => {
    expect(findEnclosing(LINES, 4)).toBe('first() {');
    expect(findEnclosing(LINES, 8)).toBe('second() {');
});

test('closing brackets and what is deeper on the way up do not count', () => {
    expect(findEnclosing(LINES, 7)).toBe('export class SyncEngine {');
});

test('a blank line is read as the first line after it', () => {
    expect(findEnclosing(LINES, 6)).toBe('export class SyncEngine {');
});

test('the top level, or past the last line, sits in nothing', () => {
    expect(findEnclosing(LINES, 12)).toBeNull();
    expect(findEnclosing(LINES, 40)).toBeNull();
    expect(findEnclosing(['    indented with nothing above'], 0)).toBeNull();
});

test('a comment opener, a decorator, a lone brace or bracket is passed over for the declaration it sits in', () => {
    const lines = [
        'export class SyncEngine {',
        '    /**',
        '     * Flushes the outbox.',
        '     */',
        '    @logged()',
        '    run() {',
        '        const options = {',
        '            retries: 3,',
        '        };',
        '        // A note',
        '        #   hash-commented',
        '        [',
        '            one,',
        '        ];',
        '        {',
        '            scoped();',
        '        }',
        '    }',
        '}',
    ];

    expect(findEnclosing(lines, 2)).toBe('export class SyncEngine {');
    expect(findEnclosing(lines, 7)).toBe('run() {');
    expect(findEnclosing(lines, 12)).toBe('run() {');
    expect(findEnclosing(lines, 15)).toBe('run() {');
    expect(findEnclosing(['{', '    "name": "githq"', '}'], 1)).toBeNull();
    expect(findEnclosing(['# Title', '  text'], 1)).toBeNull();
});

test('a class, interface, type, function or method signature is what a line sits in, a branch or a statement is not', () => {
    const inside = (line: string) => findEnclosing([line, '    body();'], 1);

    expect(inside('export default abstract class Engine extends Base {')).toBe(
        'export default abstract class Engine extends Base {',
    );
    expect(inside('interface Options {')).toBe('interface Options {');
    expect(inside('export type Row = {')).toBe('export type Row = {');
    expect(inside('export async function load(id: string): Promise<void> {')).toBe(
        'export async function load(id: string): Promise<void> {',
    );
    expect(inside('public static void main(String[] args) {')).toBe('public static void main(String[] args) {');
    expect(inside('export const load = async (id: string) => {')).toBe('export const load = async (id: string) => {');
    expect(inside('def flush(self, items):')).toBe('def flush(self, items):');
    expect(inside('pub fn flush(&mut self) -> usize {')).toBe('pub fn flush(&mut self) -> usize {');
    expect(inside('func (e *Engine) Flush() error {')).toBe('func (e *Engine) Flush() error {');

    expect(inside('if (ready) {')).toBeNull();
    expect(inside('for (const item of items) {')).toBeNull();
    expect(inside('const options = {')).toBeNull();
    expect(inside('type: "module",')).toBeNull();
    expect(inside('return [')).toBeNull();
    expect(inside('elif ready(x):')).toBeNull();
    expect(inside('when (state) {')).toBeNull();
    expect(inside('else if (ready) {')).toBeNull();
});

test('a signature broken over several lines is what its body sits in, not what its parameters do', () => {
    const lines = [
        'export class Store {',
        '    async load(',
        '        id: string,',
        '    ): Promise<void> {',
        '        body();',
        '    }',
        '}',
        'export const load = async (',
        '    id: string,',
        ') => {',
        '    body();',
        '};',
        'function foo(',
        '    id,',
        ') {',
        '    body();',
        '}',
    ];

    expect(findEnclosing(lines, 4)).toBe('async load(');
    expect(findEnclosing(lines, 2)).toBe('export class Store {');
    expect(findEnclosing(lines, 10)).toBe('export const load = async (');
    expect(findEnclosing(lines, 15)).toBe('function foo(');
});

test("of calls only a test's describe, it and test are what a line sits in", () => {
    const inside = (line: string) => findEnclosing([line, '    body();'], 1);

    expect(inside("describe('sync', () => {")).toBe("describe('sync', () => {");
    expect(inside("it('flushes', async () => {")).toBe("it('flushes', async () => {");
    expect(inside("test.only('flushes', () => {")).toBe("test.only('flushes', () => {");
    expect(inside('it.each(cases)(')).toBe('it.each(cases)(');

    expect(inside('watch(x, () => {')).toBeNull();
    expect(inside('useEffect(() => {')).toBeNull();
    expect(inside('foo.then(() => {')).toBeNull();
    expect(findEnclosing(['    sendMessage(', '        id,', '    );', '    next();'], 1)).toBeNull();
    expect(findEnclosing(['export function run() {', '    sendMessage(', '        id,', '    );', '}'], 2)).toBe(
        'export function run() {',
    );
});
