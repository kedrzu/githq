import type { ReferenceSearchQuery } from '@githq/github/generated.gen.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';

import { AccountSession } from '@/auth/AccountSession.js';
import type { PersonSuggestion, ReferenceSuggestion } from '@/components/SuggestionTypes.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';

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

/**
 * What the Markdown editor's `@` and `#` suggest as the user types, found as the pickers find their options (case,
 * diacritics and a typo aside), best match first, a handful at most.
 */
export interface MarkdownSuggestionServiceShape {
    /**
     * The thread's people who match, then the repository's assignable users who do, by login and name; a thread's
     * person with the name the repository gives them. Reactive: the repository's people once read (`RepositoryStore`).
     */
    people(params: SuggestPeopleParams): PersonSuggestion[];
    /**
     * The repository's issues and pull requests by number and title, from the local copy, the most recently updated
     * first among equals; `null` when the repository is not tracked (GitHub's search finds them:
     * {@link searchReferences}). Reactive.
     */
    references(params: SuggestReferencesParams): ReferenceSuggestion[] | null;
    /** What GitHub's search finds in the repository by number and title. Rejects when GitHub's search fails. */
    searchReferences(params: SuggestReferencesParams): Promise<ReferenceSuggestion[]>;
}

/** How many suggestions a menu shows at most. */
const SUGGESTION_LIMIT = 6;

/** {@link MarkdownSuggestionServiceShape} */
export type MarkdownSuggestionService = Resolved<typeof MarkdownSuggestionService>;
export const MarkdownSuggestionService = defineService({
    name: 'MarkdownSuggestionService',
    deps: { session: AccountSession, repositories: RepositoryStore, items: ItemStore, tracking: TrackingStore },
    setup({ session, repositories, items, tracking }): MarkdownSuggestionServiceShape {
        return { people, references, searchReferences };

        function people({ repository, query, thread }: SuggestPeopleParams) {
            const known = repositories.get(repository)?.assignableUsers ?? [];
            const named = new Map(known.map(user => [user.login.toLowerCase(), user.name]));
            const fromThread = new Map<string, PersonSuggestion>();
            for (const person of thread) {
                const login = person.login.toLowerCase();
                if (!fromThread.has(login)) {
                    fromThread.set(login, { ...person, name: person.name ?? named.get(login) ?? null });
                }
            }

            const fromRepository = known.filter(user => !fromThread.has(user.login.toLowerCase()));
            // The thread's people first, however well the repository's match: they are who the text is written to.
            return [...findPeople(query, [...fromThread.values()]), ...findPeople(query, fromRepository)].slice(
                0,
                SUGGESTION_LIMIT,
            );
        }

        function references({ repository, query }: SuggestReferencesParams) {
            if (!tracking.repositories.some(tracked => tracked.nameWithOwner === repository)) {
                return null;
            }

            const kept = items.all
                .filter(item => item.repository.nameWithOwner === repository)
                .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            return findReferences(query, kept);
        }

        async function searchReferences({ repository, query }: SuggestReferencesParams) {
            const account = session.current;
            if (!account) {
                return [];
            }

            const answer = await account.sdk.ReferenceSearch({
                query: `repo:${repository} sort:updated-desc ${query}`.trim(),
            });
            return findReferences(query, (answer.search.nodes ?? []).flatMap(toReference));
        }
    },
});

type SearchNode = NonNullable<ReferenceSearchQuery['search']['nodes']>[number];

function findPeople(query: string, people: readonly PersonSuggestion[]) {
    const prepared = prepareMatchTexts(people, person => [person.login, person.name ?? '']);
    return findMatches(query, prepared).map(({ row }) => row);
}

function findReferences(query: string, found: readonly ReferenceSuggestion[]) {
    const prepared = prepareMatchTexts(found, item => [String(item.number), item.title]);
    // No typo: a number one digit off is another issue, and a typo search over a whole repository's copy is slow.
    return findMatches(query, prepared, { typos: false })
        .slice(0, SUGGESTION_LIMIT)
        .map(({ row }) => row);
}

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
