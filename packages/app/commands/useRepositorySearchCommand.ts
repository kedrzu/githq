import type { RepositoryBrowseSearchQuery } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { BookMarked, Lock, Search } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { LastRepositoryTab } from '@/repository/LastRepositoryTab.js';
import { useGitHubSearch } from '@/utils/useGitHubSearch.js';

import type { Command, CommandOptions } from './CommandTypes.js';
import * as l from './useRepositorySearchCommand.loc.js';

/** What the search answers with, without the union's other kinds of result. */
type FoundRepository = Extract<
    NonNullable<NonNullable<RepositoryBrowseSearchQuery['search']['nodes']>[number]>,
    { nameWithOwner: string }
>;

/**
 * "Search repositories…" (D34, E6–E10): its submenu sends what is typed to GitHub's repository search, as typed so
 * its qualifiers work (`useGitHubSearch`); picking a repository goes to its screen.
 */
export function useRepositorySearchCommand(): () => Command {
    const t = useTranslate();
    const accounts = useService(AccountSession);
    const repositoryTabs = useService(LastRepositoryTab);
    const router = useRouter();
    const typed = ref('');
    const state = useGitHubSearch({ text: () => typed.value, ask: () => getAsk(accounts.current) });

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

    function getAsk(account: Account | null) {
        return account
            ? async (text: string) => {
                  const answer = await account.sdk.RepositoryBrowseSearch({ query: text });
                  return (answer.search.nodes ?? []).filter(isRepository);
              }
            : null;
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
                    options: search.result.map(repository => ({
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
