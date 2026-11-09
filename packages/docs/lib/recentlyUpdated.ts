import type { GitRunner } from './gitHistory.js';

/** What the home page's "Recently updated" needs of a section: its title and its pages. */
export interface RecentSection {
    title: string;
    pages: { title: string; link: string }[];
}

/** A page in "Recently updated": its title and section, its address and when its file last changed. */
export interface RecentPage {
    title: string;
    section: string;

    /** The page's address without the `/docs` base, as in `sections.ts`. */
    link: string;

    /** When the page's last commit was made, in milliseconds since the epoch. */
    updated: number;
}

export interface RecentPagesOptions {
    /** Runs `git` in the repository holding the pages. */
    runGit: GitRunner;

    /** Whether a file exists: `git log` still dates a deleted file, by the commit that deleted it. */
    fileExists: (file: string) => boolean;

    /** The Markdown file of a page's address, e.g. `/x/y` → `<srcDir>/x/y.md`. */
    fileOf: (link: string) => string;

    /** How many pages to list. */
    limit: number;
}

/**
 * The pages of the sidebar that changed last, newest first. Only pages listed in `sections` and present on the disk
 * are taken, so the list never links to a page that's gone; a page git has no commit for yet (a new file not committed)
 * has no date to show and is left out.
 */
export function recentPages(sections: RecentSection[], options: RecentPagesOptions): RecentPage[] {
    const { runGit, fileExists, fileOf, limit } = options;
    const pages: RecentPage[] = [];

    for (const section of sections) {
        for (const page of section.pages) {
            const file = fileOf(page.link);
            if (!fileExists(file)) {
                continue;
            }
            const seconds = Number.parseInt(runGit(['log', '-1', '--format=%at', '--', file]).trim(), 10);
            if (!Number.isFinite(seconds)) {
                continue;
            }
            pages.push({ title: page.title, section: section.title, link: page.link, updated: seconds * 1000 });
        }
    }

    // `toSorted` is stable: pages of one commit keep the sidebar's order.
    return pages.toSorted((a, b) => b.updated - a.updated).slice(0, limit);
}
