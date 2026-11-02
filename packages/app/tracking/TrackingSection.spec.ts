import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import TrackingSection from './TrackingSection.vue';
import { TrackingStore } from './TrackingStore.js';
import type { TrackedTarget } from './TrackingTypes.js';

/** How the section is opened: what is tracked first, and when GitHub answers what it offers. */
interface OpenParams {
    readonly tracked: readonly string[];
    readonly initialSearch?: string;
    /** Resolves when GitHub may answer `TrackingCandidates`; at once when not given. */
    readonly candidatesAnswered?: Promise<void>;
}

const PLANS = {
    id: 'PVT_me_1',
    title: 'Plans',
    number: 1,
    url: 'https://github.com/users/me/projects/1',
    closed: false,
    updatedAt: '2026-11-01T00:00:00Z',
    items: { totalCount: 3 },
    owner: { __typename: 'User', login: 'me' },
};

const pending = () => page.getByRole('region', { name: 'Changes to save' });

test('Save tracks and untracks exactly what was staged, in one write, onto what is tracked by then', async () => {
    const { tracking } = await open({ tracked: ['acme/web', 'acme/api', 'vitejs/vite'] });
    // `acme/api` is downloading: untracked, its download stops and its copy goes.
    await tracking.updateSyncState({ kind: 'repository', nameWithOwner: 'acme/api' }, { phase: 'openIssues' });
    const untracked: TrackedTarget[] = [];
    tracking.onUntrack(target => untracked.push(target));

    await userEvent.click(row('me/app'));
    await userEvent.click(page.getByRole('checkbox', { name: /^Plans/u }));
    await userEvent.click(row('acme/api'));
    // Tracked meanwhile, elsewhere (another tab, the sidebar): the section never unticks it.
    tracking.track({ repository: { nameWithOwner: 'acme/docs', id: 'R_acme/docs' } });
    await expect.element(row('acme/docs')).toBeChecked();
    expect(tracking.repositories.map(repository => repository.nameWithOwner)).toContain('acme/api');

    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });
    await userEvent.click(pending().getByRole('button', { name: 'Save 3 changes' }));

    expect(writes).toBe(1);
    expect(tracking.repositories).toEqual([
        { nameWithOwner: 'acme/web', id: 'R_acme/web' },
        { nameWithOwner: 'vitejs/vite', id: 'R_vitejs/vite' },
        { nameWithOwner: 'acme/docs', id: 'R_acme/docs' },
        { nameWithOwner: 'me/app', id: 'R_me/app' },
    ]);
    expect(tracking.projects).toEqual([{ id: 'PVT_me_1', owner: 'me', ownerKind: 'user', number: 1, title: 'Plans' }]);
    expect(untracked).toEqual([{ kind: 'repository', nameWithOwner: 'acme/api' }]);
    expect(tracking.getSyncState({ kind: 'repository', nameWithOwner: 'acme/api' })).toBeUndefined();
    await expect.element(pending()).not.toBeInTheDocument();
    await expect.element(row('acme/api')).not.toBeChecked();
    await expect.element(row('me/app')).toBeChecked();
});

test('nothing is written without Save; untouched rows follow what is tracked, a change made true meanwhile is gone, Discard puts the ticks back', async () => {
    const { tracking } = await open({ tracked: ['acme/web', 'acme/api'] });
    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });

    await userEvent.click(row('acme/web'));
    await userEvent.click(row('me/app'));
    await expect.element(pending()).toHaveTextContent('2 changes · start tracking me/app · stop tracking acme/web');
    expect(writes).toBe(0);

    // Elsewhere: `acme/web` untracked, `me/site` tracked — the staged untracking is no longer a change, and the row
    // nobody touched here follows.
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/web' });
    tracking.track({ repository: { nameWithOwner: 'me/site', id: 'R_me/site' } });
    await expect.element(pending()).toHaveTextContent('1 change · start tracking me/app');
    await expect.element(row('me/site')).toBeChecked();
    // And the staged tracking made true elsewhere: nothing left to save.
    tracking.track({ repository: { nameWithOwner: 'me/app', id: 'R_me/app' } });
    await expect.element(pending()).not.toBeInTheDocument();
    // Tracked again elsewhere, it is ticked again: the staged untracking was dropped.
    tracking.track({ repository: { nameWithOwner: 'acme/web', id: 'R_acme/web' } });
    await expect.element(row('acme/web')).toBeChecked();

    writes = 0;
    await userEvent.click(row('acme/api'));
    await userEvent.click(row('acme/more-1'));
    await userEvent.click(pending().getByRole('button', { name: /^Discard/u }));
    await expect.element(pending()).not.toBeInTheDocument();
    await expect.element(row('acme/api')).toBeChecked();
    await expect.element(row('acme/more-1')).not.toBeChecked();
    expect(writes).toBe(0);
    expect(tracking.repositories.map(repository => repository.nameWithOwner).toSorted()).toEqual([
        'acme/api',
        'acme/web',
        'me/app',
        'me/site',
    ]);
});

test('`?q=` fills the filter; what GitHub offers is read once on opening, said so meanwhile, the next page as needed', async () => {
    let answerCandidates = () => {};
    const candidatesAnswered = new Promise<void>(resolve => {
        answerCandidates = resolve;
    });
    const { operations } = await open({ tracked: ['acme/web'], initialSearch: 'more', candidatesAnswered });

    await expect.element(page.getByRole('textbox', { name: 'Filter repositories' })).toHaveValue('more');
    await expect.element(page.getByRole('status')).toHaveTextContent('Reading your repositories…');
    answerCandidates();
    await expect.element(page.getByText('Reading your repositories…')).not.toBeInTheDocument();
    // The filter looks through all of acme's repositories: its next page is read.
    await expect.element(row('acme/more-2')).toBeInTheDocument();
    expect(operations.filter(operation => operation === 'TrackingCandidates')).toHaveLength(1);
    expect(operations).toContain('OrganizationRepositories');
});

/** The section over a real tracking store, GitHub offering `me`'s and `acme`'s repositories and `me`'s project. */
async function open(params: OpenParams) {
    const operations: string[] = [];
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser(answer(operations, params.candidatesAnswered)));
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    for (const nameWithOwner of params.tracked) {
        tracking.track({ repository: { nameWithOwner, id: `R_${nameWithOwner}` } });
    }

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ setup: () => () => h(TrackingSection, { initialSearch: params.initialSearch }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    if (!params.candidatesAnswered) {
        await expect.element(row('me/app')).toBeInTheDocument();
    }

    return { tracking, operations };
}

function answer(operations: string[], candidatesAnswered?: Promise<void>): BrowserShape['fetch'] {
    return async (_input, init) => {
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        const query = typeof body === 'object' && body !== null && 'query' in body ? String(body.query) : '';
        const operation = /query\s+(\w+)/u.exec(query)?.[1] ?? '';
        operations.push(operation);
        switch (operation) {
            case 'TrackingCandidates':
                await candidatesAnswered;
                return Response.json({
                    data: {
                        viewer: {
                            login: 'me',
                            repositories: pageOf(['me/app', 'me/site'], null),
                            organizations: {
                                nodes: [
                                    {
                                        login: 'acme',
                                        avatarUrl: '',
                                        repositories: pageOf(['acme/web', 'acme/api', 'acme/more-1'], 'cursor-2'),
                                    },
                                ],
                            },
                        },
                    },
                });
            case 'TrackingProjects':
                return Response.json({
                    data: { viewer: { projectsV2: { totalCount: 1, nodes: [PLANS] }, organizations: { nodes: [] } } },
                });
            case 'OrganizationRepositories':
                return Response.json({ data: { organization: { repositories: pageOf(['acme/more-2'], null) } } });
            default:
                return Response.json({ message: 'Server Error' }, { status: 502 });
        }
    };
}

function pageOf(names: readonly string[], endCursor: string | null) {
    return {
        totalCount: names.length + (endCursor ? 1 : 0),
        pageInfo: { hasNextPage: endCursor !== null, endCursor },
        nodes: names.map(nameWithOwner => ({
            id: `R_${nameWithOwner}`,
            nameWithOwner,
            isPrivate: false,
            isArchived: false,
            pushedAt: '2026-11-01T00:00:00Z',
            viewerPermission: 'ADMIN',
            owner: { login: nameWithOwner.split('/')[0] },
            issues: { totalCount: 0 },
            pullRequests: { totalCount: 0 },
        })),
    };
}

/** A repository's checkbox, by its full name, as its accessible name starts. */
function row(nameWithOwner: string) {
    const [owner, name] = nameWithOwner.split('/');
    return page.getByRole('checkbox', { name: new RegExp(`^${owner}/${name}(?: |$)`, 'u') });
}
