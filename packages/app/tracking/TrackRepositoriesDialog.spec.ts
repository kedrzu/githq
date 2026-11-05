import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, ref } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { answerTrackingCandidates } from '@/testing/answerTrackingCandidates.js';
import type { AnswerTrackingCandidatesOptions } from '@/testing/answerTrackingCandidates.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { PendingUntracks } from './PendingUntracks.js';
import { TrackingStore } from './TrackingStore.js';
import TrackRepositoriesDialog from './TrackRepositoriesDialog.vue';

/** How the dialog is opened. */
interface OpenParams {
    readonly tracked?: readonly string[];
    readonly owner?: string;
    readonly search?: string;
    readonly github?: Partial<AnswerTrackingCandidatesOptions>;
    /** Pending untrack by the time it opens. */
    readonly pending?: readonly string[];
}

const dialog = () => page.getByRole('dialog', { name: 'Track repositories' });
const filter = () => dialog().getByRole('textbox', { name: 'Filter repositories' });
const trackButton = () => dialog().getByRole('button', { name: /^Track .*repositor/u });

test("T18: its title and description, the Esc hint on the head; nothing picked it says so and can't track", async () => {
    await open({ tracked: ['acme/web'] });

    // `\s`: the translations keep short words with the next one by no-break spaces.
    await expect
        .element(dialog())
        .toHaveAccessibleDescription(
            /^What\syou\stick\sis\scopied\sinto\sthis\sbrowser\sand\skept\sin\ssync\sfrom\snow\son\.$/u,
        );
    // Shown in the head, after the copy only read out.
    await expect.element(dialog().getByText('What you tick is copied', { exact: false }).last()).toBeVisible();
    await expect.element(dialog().getByText('Esc').first()).toBeVisible();
    await expect.element(dialog().getByRole('region', { name: 'Projects' })).not.toBeInTheDocument();
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');
    await expect.element(trackButton()).toBeDisabled();
    await expect.element(trackButton()).toHaveTextContent('Track repositories');
});

test('the footer names the picks, truncated; tracking is one write, picked after the others, and it closes', async () => {
    const { tracking } = await open({ tracked: ['acme/web', 'vitejs/vite'] });

    await userEvent.click(row('acme/api'));
    await userEvent.click(row('me/app'));
    await expect.element(dialog()).toHaveTextContent('2 picked: acme/api, me/app');
    const summary = dialog().getByText('2 picked:', { exact: false }).element();
    expect(getComputedStyle(summary).textOverflow).toBe('ellipsis');
    await expect.element(trackButton()).toHaveTextContent('Track 2 repositories');

    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });
    await userEvent.click(trackButton());

    expect(writes).toBe(1);
    expect(tracked(tracking)).toEqual(['acme/web', 'vitejs/vite', 'acme/api', 'me/app']);
    await expect.element(dialog()).not.toBeInTheDocument();
});

test('a repository tracked earlier returns to its old place', async () => {
    const { tracking } = await open({ tracked: ['acme/web', 'acme/api', 'vitejs/vite'] });
    tracking.untrack({ kind: 'repository', nameWithOwner: 'acme/api' });

    await userEvent.click(row('acme/api'));
    await userEvent.click(trackButton());

    expect(tracked(tracking)).toEqual(['acme/web', 'acme/api', 'vitejs/vite']);
});

test('one being untracked counts as not tracked: picked and tracked, its untrack is taken back, with no write', async () => {
    const WEB = { kind: 'repository', nameWithOwner: 'acme/web' } as const;
    const { tracking, pending } = await open({ tracked: ['acme/web', 'acme/api'], pending: ['acme/web'] });

    await expect.element(row('acme/web')).not.toBeChecked();
    await expect.element(row('acme/web')).not.toHaveAttribute('aria-readonly');
    await expect.element(row('acme/api')).toBeChecked();
    await userEvent.click(row('acme/web'));
    await expect.element(dialog()).toHaveTextContent('1 picked: acme/web');

    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });
    await userEvent.click(trackButton());

    expect(pending.isPending(WEB)).toBe(false);
    expect(writes).toBe(0);
    expect(tracked(tracking)).toEqual(['acme/web', 'acme/api']);
    await expect.element(dialog()).not.toBeInTheDocument();
});

test('a pick tracked meanwhile elsewhere is no longer a pick', async () => {
    const { tracking } = await open({ tracked: [] });

    await userEvent.click(row('acme/api'));
    await expect.element(dialog()).toHaveTextContent('1 picked: acme/api');
    tracking.track({ repository: { nameWithOwner: 'acme/api', id: 'R_acme/api' } });

    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');
    await expect.element(row('acme/api')).toHaveAttribute('aria-readonly', 'true');
});

test('Esc clears the filter first, wherever the focus is, then closes without asking; picks and the filter are gone on opening again', async () => {
    const { tracking, setOpen } = await open({ tracked: [] });

    await userEvent.click(row('acme/api'));
    await userEvent.keyboard('/web');
    await expect.element(filter()).toHaveValue('web');
    await userEvent.keyboard('{Escape}');
    await expect.element(filter()).toHaveValue('');
    await expect.element(dialog()).toBeInTheDocument();

    // On a row, not in the field.
    await userEvent.keyboard('/web{ArrowDown}');
    await expect.element(row('acme/web')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect.element(filter()).toHaveValue('');
    await expect.element(dialog()).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(tracked(tracking)).toEqual([]);

    setOpen(true);
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');
    await expect.element(row('acme/api')).not.toBeChecked();
});

test('Cancel closes without tracking', async () => {
    const { tracking } = await open({ tracked: [] });

    await userEvent.click(row('acme/api'));
    await userEvent.click(dialog().getByRole('button', { name: /^Cancel/u }));

    await expect.element(dialog()).not.toBeInTheDocument();
    expect(tracked(tracking)).toEqual([]);
});

test('J and K and the arrows move from the moment it opens, Space ticks, / filters, ⌘↵ tracks', async () => {
    const { tracking } = await open({ tracked: [] });

    await userEvent.keyboard('j');
    await expect.element(row('me/app')).toHaveFocus();
    await userEvent.keyboard('j');
    await expect.element(row('me/site')).toHaveFocus();
    await userEvent.keyboard('k');
    await expect.element(row('me/app')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(row('me/site')).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(row('me/site')).toBeChecked();

    await userEvent.keyboard('/');
    await expect.element(filter()).toHaveFocus();
    // In the field a letter is text.
    await userEvent.keyboard('j');
    await expect.element(filter()).toHaveValue('j');
    await userEvent.keyboard('{Backspace}');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(tracked(tracking)).toEqual(['me/site']);
    await expect.element(dialog()).not.toBeInTheDocument();
});

test('⌘↵ with nothing picked neither tracks nor closes', async () => {
    const { tracking } = await open({ tracked: [] });
    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(writes).toBe(0);
    await expect.element(dialog()).toBeInTheDocument();
});

test("the keys of the screen beneath don't run while it is open, even after a click on nothing in particular", async () => {
    const screenKey = vi.fn();
    await open({ tracked: [], screenKey });

    for (const key of ['a', '1', '{Backspace}']) {
        await userEvent.keyboard(key);
    }

    await userEvent.click(dialog().getByText('your repositories', { exact: false }));
    for (const key of ['a', '1', '{Backspace}']) {
        await userEvent.keyboard(key);
    }

    expect(screenKey).not.toHaveBeenCalled();
    await expect.element(dialog()).toBeInTheDocument();
});

test('it opens on an owner (Track more)', async () => {
    await open({ tracked: [], owner: 'acme' });

    await expect.element(dialog().getByRole('radio', { name: /^acme/u })).toBeChecked();
    await expect.element(dialog().getByRole('heading', { name: 'me', exact: true })).not.toBeInTheDocument();
    await expect.element(row('acme/web')).toBeInTheDocument();
});

test("it opens with a search (`?q=`): someone else's repository is looked up, picked and tracked", async () => {
    const { tracking } = await open({
        tracked: ['acme/web'],
        search: 'rust-lang/rust',
        github: { lookups: ['rust-lang/rust'] },
    });

    await expect.element(filter()).toHaveValue('rust-lang/rust');
    await userEvent.click(row('rust-lang/rust'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(tracked(tracking)).toEqual(['acme/web', 'rust-lang/rust']);
});

test('while the repositories are read it says so; failed, a name can still be looked up and tracked', async () => {
    let answer = () => {};
    const answered = new Promise<void>(resolve => {
        answer = resolve;
    });
    const reading = await open({ tracked: [], github: { answered }, waitForRows: false });
    await expect.element(dialog().getByRole('status')).toHaveTextContent('Reading your repositories…');
    answer();
    await expect.element(row('me/app')).toBeInTheDocument();
    reading.close();

    const { tracking } = await open({
        tracked: [],
        github: { failing: true, lookups: ['acme/web'] },
        waitForRows: false,
    });
    await expect.element(dialog().getByRole('alert')).toHaveTextContent("GitHub didn't list your repositories.");
    await userEvent.fill(filter(), 'acme/web');
    await userEvent.click(row('acme/web'));
    await userEvent.click(trackButton());
    expect(tracked(tracking)).toEqual(['acme/web']);
});

function tracked(tracking: TrackingStore) {
    return tracking.repositories.map(repository => repository.nameWithOwner);
}

function row(nameWithOwner: string) {
    const [owner, name] = nameWithOwner.split('/');
    return dialog().getByRole('checkbox', { name: new RegExp(`^${owner}/${name}(?: |$)`, 'u') });
}

/**
 * The dialog open over a real tracking store, GitHub offering `me`'s and `acme`'s repositories, on a screen whose own
 * keys (`A`, `1`, ⌫) report to `screenKey`.
 */
async function open(params: OpenParams & { screenKey?: () => void; waitForRows?: boolean }) {
    // A desktop window: the dialog is 880 wide, and narrower in a narrower one.
    await page.viewport(1280, 900);
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(
        Browser,
        createSignedInBrowser(
            answerTrackingCandidates({
                login: 'me',
                repositories: { names: ['me/app', 'me/site'] },
                organizations: { acme: { names: ['acme/web', 'acme/api'] } },
                ...params.github,
            }),
        ),
    );
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    const pending = container.resolve(PendingUntracks);
    await tracking.ready();
    for (const nameWithOwner of params.tracked ?? []) {
        tracking.track({ repository: { nameWithOwner, id: `R_${nameWithOwner}` } });
    }

    for (const nameWithOwner of params.pending ?? []) {
        pending.untrack({ kind: 'repository', nameWithOwner }, nameWithOwner);
    }

    const opened = ref(true);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
        defineComponent({
            setup() {
                useCommands(() =>
                    ['A', '1', 'Backspace'].map(key => ({
                        id: `screen.${key}`,
                        title: key,
                        section: 'view',
                        key,
                        run: () => params.screenKey?.(),
                    })),
                );
                return () =>
                    h(TrackRepositoriesDialog, {
                        open: opened.value,
                        owner: params.owner,
                        search: params.search,
                        'onUpdate:open': value => {
                            opened.value = value;
                        },
                    });
            },
        }),
    );
    app.use(IocPlugin, { container });
    app.mount(host);
    const close = () => {
        app.unmount();
        host.remove();
    };
    onTestFinished(close);

    if (params.waitForRows !== false && !params.search) {
        await expect.element(row('me/app').or(row('acme/web')).first()).toBeInTheDocument();
    }

    return {
        tracking,
        pending,
        close,
        setOpen: (value: boolean) => {
            opened.value = value;
        },
    };
}
