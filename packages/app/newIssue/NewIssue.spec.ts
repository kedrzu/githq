import type { RepositorySearchQuery } from '@githq/github/generated.gen.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';
import { ItemStore } from '@/store/ItemStore.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import NewIssue from './NewIssue.vue';
import { NewIssueComposer } from './NewIssueComposer.js';

/** What the capture chooses from, and what GitHub's search answers. */
interface ChooserParams {
    readonly tracked?: readonly string[];
    /** Repositories of the local copy's items: "From your work". */
    readonly work?: readonly string[];
    readonly found?: readonly FoundOnGitHub[];
}

/** A repository GitHub's search answers with. */
interface FoundOnGitHub {
    readonly nameWithOwner: string;
    readonly isArchived?: boolean;
}

test('words in another order and a name without its diacritics find the same repository', async () => {
    await openChooser({ tracked: ['acme/Żółty-theme', 'acme/web'] });

    await chooserFilter('zolty');
    await expect.poll(sections).toEqual([expect.stringMatching(/^Tracked.*Żółty-theme/u)]);

    await chooserFilter('theme zolty');
    await expect.poll(sections).toEqual([expect.stringMatching(/^Tracked.*Żółty-theme/u)]);
});

test('scattered letters still find a repository', async () => {
    await openChooser({ tracked: ['acme/payments', 'acme/web'] });

    await chooserFilter('apy');
    await expect.poll(sections).toEqual([expect.stringMatching(/^Tracked.*payments/u)]);
});

test('sections come best first, each ranked; a repository stays in the first that offers it; GitHub’s stay after ours', async () => {
    const composer = await openChooser({
        tracked: ['zeta/keyacme', 'zeta/acme-tools'],
        // `zeta/acme-tools` is tracked too, and listed there though this section comes first.
        work: ['acme/web', 'zeta/acme-tools'],
        found: [{ nameWithOwner: 'acme/acme' }, { nameWithOwner: 'acme/old', isArchived: true }],
    });

    await expect.poll(headings).toEqual(['Tracked', 'From your work']);

    await chooserFilter('acme');
    await expect
        .poll(sections)
        .toEqual([
            expect.stringMatching(/^From your work.*acme\/web/u),
            expect.stringMatching(/^Tracked.*zeta\/acme-tools.*zeta\/keyacme/u),
            expect.stringMatching(/^Other repositories.*acme\/acme/u),
            expect.stringMatching(/^Won.t\s+take\s+an\s+issue.*acme\/old/u),
        ]);
    expect(page.getByRole('option', { name: /^zeta\/acme-tools/u }).elements()).toHaveLength(1);

    await userEvent.keyboard('{Enter}');
    await expect.poll(() => composer.draft.repository).toBe('acme/web');
});

test('a typed owner/name is offered though GitHub’s search does not rank it, and finds ours in full', async () => {
    await openChooser({ tracked: ['acme/web'] });

    await chooserFilter('vitejs/vite');
    await expect.poll(sections).toEqual([expect.stringMatching(/^Other repositories.*vitejs\/vite/u)]);

    await chooserFilter('https://github.com/acme/web');
    await expect.poll(headings).toEqual(['Tracked']);
});

/** The capture of a user with nothing chosen yet, so it opens on the chooser. */
async function openChooser(params: ChooserParams) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser(params.found ?? []));
    setIndexedDbPersistence(container);

    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    for (const nameWithOwner of params.tracked ?? []) {
        tracking.track({ repository: { nameWithOwner, id: `R_${nameWithOwner}` } });
    }

    const items = container.resolve(ItemStore);
    await items.ready();
    items.upsertMany(
        (params.work ?? []).map(nameWithOwner => ({
            ...sampleIssue(`I_${nameWithOwner}`),
            repository: {
                nameWithOwner,
                owner: parseRepositoryName(nameWithOwner).owner,
                isPrivate: false,
                viewerPermission: 'WRITE',
            },
        })),
    );

    const composer = container.resolve(NewIssueComposer);
    composer.start({ repository: null, project: null, parent: null });

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(NewIssue);
    app.use(IocPlugin, { container });
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
        }),
    );
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    await expect.element(repositoryField()).toHaveFocus();
    return composer;
}

/**
 * The browser with a user of their own signed in, keeping nothing between tests, and a GitHub that answers only the
 * search for repositories (`createTestSession()` runs under `bun test`, not in a browser).
 */
function createSignedInBrowser(found: readonly FoundOnGitHub[]): BrowserShape {
    const login = `user-${crypto.randomUUID()}`;
    const stored = new Map([
        [TOKEN_KEY, `gho_${login}`],
        [VIEWER_KEY, JSON.stringify({ login, name: null, avatarUrl: 'https://avatars.test/user' })],
    ]);
    return {
        ...createContainer().resolve(Browser),
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem: (key, value) => {
                stored.set(key, value);
            },
            removeItem: key => {
                stored.delete(key);
            },
            key: index => [...stored.keys()][index] ?? null,
            get length() {
                return stored.size;
            },
        },
        writeCookie: () => {},
        fetch: (_input, init) => {
            if (typeof init?.body === 'string' && init.body.includes('query RepositorySearch')) {
                return Promise.resolve(Response.json({ data: searchAnswer(found) }));
            }

            return Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 }));
        },
    };
}

function searchAnswer(found: readonly FoundOnGitHub[]): RepositorySearchQuery {
    return {
        search: {
            nodes: found.map(repository => ({
                nameWithOwner: repository.nameWithOwner,
                isPrivate: false,
                isArchived: repository.isArchived ?? false,
                hasIssuesEnabled: true,
                viewerPermission: 'WRITE',
                pushedAt: null,
            })),
        },
    };
}

function repositoryField() {
    return page.getByRole('textbox', { name: 'Repository' });
}

/** Types into the chooser, in place of what was there. */
async function chooserFilter(text: string) {
    await userEvent.clear(repositoryField());
    await userEvent.type(repositoryField(), text);
}

/** The list's sections in order, each its heading followed by its rows' text. */
function sections() {
    return page
        .getByRole('listbox')
        .getByRole('group')
        .elements()
        .map(group => group.textContent);
}

function headings() {
    return page
        .getByRole('listbox')
        .getByRole('group')
        .elements()
        .map(group => group.firstElementChild?.textContent);
}
