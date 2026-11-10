import type { ReferenceSearchQuery } from '@githq/github/generated.gen.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { rankPeople, rankReferences } from '@/components/rankSuggestions.js';
import type { PersonSuggestion, ReferenceSuggestion } from '@/components/SuggestionTypes.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

/** Who `@query` is asked of. */
export interface SuggestPeopleParams {
    /** `owner/name`. */
    readonly repository: string;
    readonly query: string;
    /** The people of the thread written in, suggested before the repository's. */
    readonly thread: readonly PersonSuggestion[];
}

/** What `#query` is asked of. */
export interface SuggestReferencesParams {
    /** `owner/name`. */
    readonly repository: string;
    readonly query: string;
}

/** What the Markdown editor's `@` and `#` suggest as the user types, best match first, a handful at most. */
export interface MarkdownSuggestionServiceShape {
    /** The thread's people, then the repository's assignable users, by login and name. */
    people(params: SuggestPeopleParams): Promise<PersonSuggestion[]>;
    /**
     * The repository's issues and pull requests by number and title: from the local copy when it is tracked, else as
     * GitHub's search finds them. Rejects when GitHub's search fails.
     */
    references(params: SuggestReferencesParams): Promise<ReferenceSuggestion[]>;
}

/** {@link MarkdownSuggestionServiceShape} */
export type MarkdownSuggestionService = Resolved<typeof MarkdownSuggestionService>;
export const MarkdownSuggestionService = defineService({
    name: 'MarkdownSuggestionService',
    deps: { session: AccountSession, repositories: RepositoryStore, items: ItemStore, tracking: TrackingStore },
    setup({ session, repositories, items, tracking }): MarkdownSuggestionServiceShape {
        return { people, references };

        async function people({ repository, query, thread }: SuggestPeopleParams) {
            // An opened item has read its repository's metadata already: this waits on GitHub only the first time.
            const metadata = repositories.get(repository) ?? (await repositories.ensure(repository));
            return rankPeople(query, [...thread, ...(metadata?.assignableUsers ?? [])]);
        }

        async function references({ repository, query }: SuggestReferencesParams) {
            if (tracking.repositories.some(tracked => tracked.nameWithOwner === repository)) {
                const kept = items.all
                    .filter(item => item.repository.nameWithOwner === repository)
                    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                return rankReferences(query, kept);
            }

            const account = session.current;
            if (!account) {
                return [];
            }

            const answer = await account.sdk.ReferenceSearch({
                query: `repo:${repository} sort:updated-desc ${query}`.trim(),
            });
            return rankReferences(query, (answer.search.nodes ?? []).flatMap(toReference));
        }
    },
});

type SearchNode = NonNullable<ReferenceSearchQuery['search']['nodes']>[number];

function toReference(node: SearchNode): ReferenceSuggestion[] {
    if (node === null || !('__typename' in node)) {
        return [];
    }

    const { number, title } = node;
    return node.__typename === 'Issue'
        ? [{ kind: 'issue', state: node.issueState, stateReason: node.stateReason, number, title }]
        : [
              {
                  kind: 'pullRequest',
                  state: node.pullRequestState,
                  isDraft: node.isDraft,
                  merged: node.merged,
                  number,
                  title,
              },
          ];
}
