import type { RepositoryBrowseSearchQuery } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { BookMarked, Lock, Search } from 'lucide-vue-next';
import { ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';

import type { Command, CommandOptions } from './CommandTypes.js';
import * as l from './useRepositorySearchCommand.loc.js';

/** What the search answers with, without the union's other kinds of result. */
type FoundRepository = Extract<
    NonNullable<NonNullable<RepositoryBrowseSearchQuery['search']['nodes']>[number]>,
    { nameWithOwner: string }
>;

/** Where the search stands for what is typed now. */
type RepositorySearch =
    | { readonly kind: 'tooShort' }
    | { readonly kind: 'asking' }
    | { readonly kind: 'failed' }
    | { readonly kind: 'answered'; readonly repositories: readonly FoundRepository[] };

/** Fewer typed characters ask GitHub nothing. */
const MIN_LENGTH = 2;

/** How long what is typed must stay as it is before GitHub is asked. */
const SEARCH_DELAY_MS = 300;

/**
 * "Search repositories…" (D32, E6–E10): its submenu sends what is typed to GitHub's repository search, as typed so
 * its qualifiers work, once typing pauses; picking a repository goes to its screen. Latest wins: a change cancels the
 * wait, and what was asked before it, or for an account no longer signed in, is dropped when it answers.
 */
export function useRepositorySearchCommand(): () => Command {
    const t = useTranslate();
    const accounts = useService(AccountSession);
    const repositoryTabs = useService(LastRepositoryTab);
    const router = useRouter();
    const typed = ref('');
    const state = shallowRef<RepositorySearch>({ kind: 'tooShort' });

    // Synchronous, so nothing can answer between the change and the older question being dropped.
    watch(
        [typed, () => accounts.current],
        ([text, account], _before, onCleanup) => {
            if (!account || text.length < MIN_LENGTH) {
                state.value = { kind: 'tooShort' };
                return;
            }

            state.value = { kind: 'asking' };
            let stale = false;
            const timer = setTimeout(() => void ask(account, text, () => stale), SEARCH_DELAY_MS);
            onCleanup(() => {
                stale = true;
                clearTimeout(timer);
            });
        },
        { flush: 'sync' },
    );

    return () => ({
        id: 'app.searchRepositories',
        title: t(l.title),
        detail: t(l.detail),
        section: 'app',
        icon: Search,
        options: getOptions,
        search: text => {
            typed.value = text.trim();
        },
    });

    async function ask(account: Account, text: string, isStale: () => boolean) {
        const answered = await account.sdk
            .RepositoryBrowseSearch({ query: text })
            .then((answer): RepositorySearch => ({
                kind: 'answered',
                repositories: (answer.search.nodes ?? []).filter(isRepository),
            }))
            .catch((): RepositorySearch => ({ kind: 'failed' }));
        if (!isStale()) {
            state.value = answered;
        }
    }

    function getOptions(): CommandOptions {
        const shared = { placeholder: t(l.placeholder), hint: t(l.hint) };
        const search = state.value;
        switch (search.kind) {
            case 'tooShort':
                return { ...shared, options: [], message: t(l.typeMore) };
            case 'asking':
                return { ...shared, options: [], heading: t(l.heading), message: t(l.asking) };
            case 'failed':
                return { ...shared, options: [], heading: t(l.heading), message: t(l.failed) };
            case 'answered':
                return {
                    ...shared,
                    heading: t(l.heading),
                    message: t(l.nothing, { text: typed.value }),
                    options: search.repositories.map(repository => ({
                        value: repository.nameWithOwner,
                        label: repository.nameWithOwner,
                        detail: repository.description ?? undefined,
                        aside: repository.isPrivate ? t(l.private) : t(l.public),
                        icon: repository.isPrivate ? Lock : BookMarked,
                        pick: () => {
                            void router.push(repositoryTabs.getPath(repository.nameWithOwner));
                        },
                    })),
                };
            default:
                return assertNever(search);
        }
    }
}

function isRepository(
    node: NonNullable<RepositoryBrowseSearchQuery['search']['nodes']>[number],
): node is FoundRepository {
    return node != null && 'nameWithOwner' in node;
}
