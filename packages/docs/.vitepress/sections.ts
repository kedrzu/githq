/** A page of the docs, as the sidebar lists it. */
export interface DocsPage {
    title: string;

    /** The page's address without the `/docs` base, e.g. `/getting-started/sign-in-and-install`; `/` for the first. */
    link: string;

    /** The page's Markdown file under `src/`, e.g. `getting-started/sign-in-and-install.md`. */
    file: string;
}

/** A group of pages: one block of the sidebar, one link of the top bar. */
export interface DocsSection {
    /** The folder under `src/` holding the section's pages, e.g. `getting-started`. */
    id: string;

    title: string;

    /** The section's pages, in reading order. */
    pages: DocsPage[];
}

/** A section as written below: its folder, title, and each page's title and file name without `.md`. */
type SectionInput = [id: string, title: string, pages: [title: string, slug: string][]];

const SECTIONS: SectionInput[] = [
    [
        'getting-started',
        'Getting started',
        [
            ['What is githq', 'what-is-githq'],
            ['Sign in and install', 'sign-in-and-install'],
            ['Choose what to track', 'choose-what-to-track'],
        ],
    ],
    [
        'using-githq',
        'Using githq',
        [
            ['My work', 'my-work'],
            ['Repositories', 'repositories'],
            ['Projects', 'projects'],
            ['Pull requests and reviews', 'pull-requests-and-reviews'],
            ['The command menu', 'command-menu'],
            ['Open GitHub links in githq', 'open-github-links-in-githq'],
        ],
    ],
    [
        'how-it-works',
        'How it works',
        [
            ['GitHub is the source of truth', 'github-is-the-source-of-truth'],
            ['Privacy and permissions', 'privacy-and-permissions'],
        ],
    ],
];

/**
 * The docs' sections in order: the one source for the sidebar and the top bar. There is no home page: the sidebar's
 * first page is the docs' address itself, `/` (`/docs/`), and the config serves its file as `index.md` (`rewrites`).
 */
export const sections: DocsSection[] = SECTIONS.map(([id, title, pages], sectionIndex) => ({
    id,
    title,
    pages: pages.map(([pageTitle, slug], pageIndex) => ({
        title: pageTitle,
        link: sectionIndex === 0 && pageIndex === 0 ? '/' : `/${id}/${slug}`,
        file: `${id}/${slug}.md`,
    })),
}));

/** The page `/docs/` opens: the sidebar's first. */
export const firstPage = sections[0]!.pages[0]!;
