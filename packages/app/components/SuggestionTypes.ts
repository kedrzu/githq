import type { ItemKindState } from '@/lists/utils/getItemKind.js';

/** Someone `@` suggests. */
export interface PersonSuggestion {
    readonly login: string;
    /** Their full name, when GitHub has one and gave it. */
    readonly name?: string | null;
    readonly avatarUrl: string;
}

/** An issue or pull request `#` suggests, with what its icon is drawn from. */
export type ReferenceSuggestion = ItemKindState & {
    readonly number: number;
    readonly title: string;
};

/** What a suggestions menu lists: people for `@`, issues and pull requests for `#`. */
export type SuggestionList =
    | { readonly kind: 'mention'; readonly rows: readonly PersonSuggestion[] }
    | { readonly kind: 'reference'; readonly rows: readonly ReferenceSuggestion[] };
