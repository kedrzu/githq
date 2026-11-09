/** A page of the docs, as the sidebar and the home page's cards list it. */
export interface DocsPage {
    title: string;

    /** The page's address without the `/docs` base, e.g. `/getting-started/what-is-githq`. */
    link: string;
}

/** A group of pages: one block of the sidebar, one link of the top bar, one card on the home page. */
export interface DocsSection {
    /** The folder under `src/` holding the section's pages, e.g. `getting-started`. */
    id: string;

    title: string;

    /** A lucide icon name (https://lucide.dev/icons), e.g. `rocket`. */
    icon: string;

    /** One sentence for the section's card on the home page. */
    description: string;

    /** The section's pages, in reading order. */
    pages: DocsPage[];
}

/** The docs' sections in order: the one source for the sidebar, the top bar and the home page. */
export const sections: DocsSection[] = [
    section({
        id: 'getting-started',
        title: 'Getting started',
        icon: 'rocket',
        description: 'Sign in, install the app and pick the repositories githq keeps in sync.',
        pages: [
            ['What is githq', 'what-is-githq'],
            ['Sign in and install', 'sign-in-and-install'],
            ['Choose what to track', 'choose-what-to-track'],
        ],
    }),
    section({
        id: 'using-githq',
        title: 'Using githq',
        icon: 'layout-list',
        description: 'Your work, repositories, projects and reviews, all from the keyboard.',
        pages: [
            ['My work', 'my-work'],
            ['Repositories', 'repositories'],
            ['Projects', 'projects'],
            ['Pull requests and reviews', 'pull-requests-and-reviews'],
            ['The command menu', 'command-menu'],
        ],
    }),
    section({
        id: 'how-it-works',
        title: 'How it works',
        icon: 'cog',
        description: 'Where your data lives and what githq is allowed to do with it.',
        pages: [
            ['GitHub is the source of truth', 'github-is-the-source-of-truth'],
            ['Privacy and permissions', 'privacy-and-permissions'],
        ],
    }),
];

function section(input: Omit<DocsSection, 'pages'> & { pages: [title: string, slug: string][] }): DocsSection {
    return {
        ...input,
        pages: input.pages.map(([title, slug]) => ({ title, link: `/${input.id}/${slug}` })),
    };
}
