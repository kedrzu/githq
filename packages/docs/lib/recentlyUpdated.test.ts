import { expect, test } from 'bun:test';

import type { RecentPagesOptions, RecentSection } from './recentlyUpdated.js';
import { recentPages } from './recentlyUpdated.js';

const sections: RecentSection[] = [
    {
        title: 'Getting started',
        pages: [
            { title: 'One', link: '/a/one' },
            { title: 'Two', link: '/a/two' },
        ],
    },
    {
        title: 'How it works',
        pages: [
            { title: 'Three', link: '/b/three' },
            { title: 'Four', link: '/b/four' },
        ],
    },
];

/** Options over a fake repository: each file's last commit time in seconds, or none for a file not committed. */
function options(commits: Record<string, number | undefined>, overrides: Partial<RecentPagesOptions> = {}) {
    const asked: string[][] = [];
    const result: RecentPagesOptions = {
        runGit: args => {
            asked.push(args);
            const time = commits[args.at(-1) ?? ''];
            return time === undefined ? '' : `${time}\n`;
        },
        fileExists: file => file in commits,
        fileOf: link => `src${link}.md`,
        limit: 5,
        ...overrides,
    };
    return { options: result, asked };
}

test('lists the pages newest first, with their section and date', () => {
    const { options: opts, asked } = options({
        'src/a/one.md': 100,
        'src/a/two.md': 300,
        'src/b/three.md': 200,
        'src/b/four.md': 50,
    });

    expect(recentPages(sections, opts)).toEqual([
        { title: 'Two', section: 'Getting started', link: '/a/two', updated: 300_000 },
        { title: 'Three', section: 'How it works', link: '/b/three', updated: 200_000 },
        { title: 'One', section: 'Getting started', link: '/a/one', updated: 100_000 },
        { title: 'Four', section: 'How it works', link: '/b/four', updated: 50_000 },
    ]);
    expect(asked[0]).toEqual(['log', '-1', '--format=%at', '--', 'src/a/one.md']);
});

test('takes no more than the limit', () => {
    const { options: opts } = options(
        { 'src/a/one.md': 1, 'src/a/two.md': 2, 'src/b/three.md': 3, 'src/b/four.md': 4 },
        { limit: 2 },
    );

    expect(recentPages(sections, opts).map(page => page.title)).toEqual(['Four', 'Three']);
});

test('leaves out a page whose file is gone, though git still dates it', () => {
    const { options: opts } = options(
        { 'src/a/one.md': 100, 'src/a/two.md': 300 },
        // git dates a deleted file by the commit that deleted it.
        { runGit: args => (args.at(-1) === 'src/b/three.md' ? '999\n' : '100\n') },
    );

    expect(recentPages(sections, opts).map(page => page.link)).toEqual(['/a/one', '/a/two']);
});

test('leaves out a page not committed yet', () => {
    const { options: opts } = options({ 'src/a/one.md': 100, 'src/a/two.md': undefined });

    expect(recentPages(sections, opts).map(page => page.link)).toEqual(['/a/one']);
});

test('keeps the sidebar order for pages changed in one commit', () => {
    const { options: opts } = options({
        'src/a/one.md': 100,
        'src/a/two.md': 100,
        'src/b/three.md': 100,
    });

    expect(recentPages(sections, opts).map(page => page.title)).toEqual(['One', 'Two', 'Three']);
});
