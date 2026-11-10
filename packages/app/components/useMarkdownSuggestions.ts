import type { VirtualElement } from '@floating-ui/vue';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, ref, shallowRef, toValue, useId, watch } from 'vue';
import type { MaybeRefOrGetter, Ref, TextareaHTMLAttributes } from 'vue';

import { MarkdownSuggestionService } from '@/services/MarkdownSuggestionService.js';
import { getCaretRect } from '@/utils/getCaretRect.js';
import { useGitHubSearch } from '@/utils/useGitHubSearch.js';

import { findSuggestionTrigger } from './findSuggestionTrigger.js';
import type { SuggestionTrigger } from './findSuggestionTrigger.js';
import type { PersonSuggestion, ReferenceSuggestion, SuggestionList } from './SuggestionTypes.js';

/** The text area suggestions are typed in, and what they are of. */
export interface UseMarkdownSuggestionsOptions {
    readonly textarea: Readonly<Ref<HTMLTextAreaElement | undefined>>;
    /** `owner/name`: whose people and issues are suggested. */
    readonly repository: MaybeRefOrGetter<string>;
    /** The thread's people, suggested first. */
    readonly people: MaybeRefOrGetter<readonly PersonSuggestion[]>;
}

/** The suggestions at the caret, and what the text area needs to show and drive them. */
export interface MarkdownSuggestionsViewModel {
    /** The listbox's id. */
    readonly id: string;
    /** What is suggested; `null` while the menu is closed. */
    readonly list: SuggestionList | null;
    /** The highlighted row's index. */
    readonly active: number;
    /** Where the `@` or `#` is drawn; `null` while the menu is closed. */
    readonly anchor: VirtualElement | null;
    /** What the text area says of the menu, for assistive technology. */
    readonly attrs: TextareaHTMLAttributes;
    /** The text or the caret changed: what is typed at the caret is looked at again. */
    update(): void;
    /** A key in the text area: with the menu open, ↑↓ move, Enter or Tab insert, Escape closes. */
    onKeydown(event: KeyboardEvent): void;
    /** The menu goes, until the caret is back at a trigger. */
    close(): void;
    /** Puts the row in place of what is typed from its `@` or `#`: `@login ` or `#123 `. */
    pick(index: number): void;
    highlight(index: number): void;
}

/**
 * The `@` and `#` suggestions of a Markdown text area. Typing `@` or `#` at a word's start opens them at the caret,
 * typing on filters them, and a space, no match or the caret moving off closes them. They never edit the text but
 * when a row is picked, and they never take a key while closed: typing goes on as if they were not there. People and
 * a tracked repository's issues come from what the app holds, at once; an untracked repository's are asked of GitHub's
 * search once typing pauses (`useGitHubSearch`), from the first character typed after `#`. Escape closes them until
 * another `@` or `#` is typed.
 */
export function useMarkdownSuggestions(options: UseMarkdownSuggestionsOptions): MarkdownSuggestionsViewModel {
    const container = useContainer();
    const logger = useLogger();
    const id = useId();

    const trigger = shallowRef<SuggestionTrigger | null>(null);
    const active = ref(0);
    /** What GitHub's search last found for the trigger open: kept while what is typed on is asked. */
    const searched = shallowRef<readonly ReferenceSuggestion[] | null>(null);
    /** Where the trigger closed by Escape starts: it stays closed while the caret is after it. */
    let dismissed: number | null = null;

    const start = computed(() => trigger.value?.start ?? null);
    const anchor = computed((): VirtualElement | null => {
        const element = options.textarea.value;
        const at = start.value;
        if (!element || at === null) {
            return null;
        }

        return { getBoundingClientRect: () => getCaretRect(element, at), contextElement: element };
    });
    /** What the app holds for the trigger open; `null` for none, or for an untracked repository's references. */
    const held = computed((): SuggestionList | null => {
        const found = trigger.value;
        if (!found) {
            return null;
        }

        const repository = toValue(options.repository);
        if (found.kind === 'mention') {
            const thread = toValue(options.people);
            return { kind: 'mention', rows: getService().people({ repository, query: found.query, thread }) };
        }

        const rows = getService().references({ repository, query: found.query });
        return rows && { kind: 'reference', rows };
    });
    const search = useGitHubSearch({
        text: () => (trigger.value?.kind === 'reference' && held.value === null ? trigger.value.query : ''),
        ask: () => {
            const repository = toValue(options.repository);
            return query => getService().searchReferences({ repository, query });
        },
        minLength: 1,
    });
    const list = computed((): SuggestionList | null => {
        const shown =
            held.value ??
            (trigger.value?.kind === 'reference' && searched.value
                ? { kind: 'reference', rows: searched.value }
                : null);
        return shown && shown.rows.length > 0 && anchor.value !== null ? shown : null;
    });
    // The text area stays a text box — ARIA lets a `textarea` take no other role — that owns the menu as a combobox
    // does, as GitHub's own editor does: it says it completes from a list, which list, and which row is highlighted.
    const attrs = computed((): TextareaHTMLAttributes => ({
        'aria-autocomplete': 'list',
        'aria-haspopup': 'listbox',
        'aria-controls': list.value ? id : undefined,
        'aria-activedescendant': list.value ? `${id}-${active.value}` : undefined,
    }));

    // While what is typed on is asked, what was found stays.
    watch(search, state => {
        if (state.kind === 'answered') {
            searched.value = state.result;
        } else if (state.kind !== 'asking') {
            searched.value = null;
        }

        if (state.kind === 'failed') {
            logger.warn('The editor could not suggest anything', { kind: 'reference' });
        }
    });
    watch(list, () => {
        active.value = 0;
    });

    return reactive<MarkdownSuggestionsViewModel>({
        id,
        list,
        active,
        anchor,
        attrs,
        update,
        onKeydown,
        close,
        pick,
        highlight,
    });

    // Resolved once suggesting starts, not for every editor mounted: an editor no one types `@` or `#` in needs none.
    function getService() {
        return container.resolve(MarkdownSuggestionService);
    }

    function update() {
        const element = options.textarea.value;
        const found = element
            ? findSuggestionTrigger(element.value, { start: element.selectionStart, end: element.selectionEnd })
            : null;
        if (found?.start !== dismissed) {
            dismissed = null;
        }

        if (!found || found.start === dismissed) {
            close();
            return;
        }

        const current = trigger.value;
        if (current?.kind === found.kind && current.start === found.start && current.query === found.query) {
            return;
        }

        // Another trigger asking something else: what GitHub found is not of it. The same one typed on keeps what
        // GitHub found until its answer for what is typed now replaces it.
        const another = current?.kind !== found.kind || current.start !== found.start;
        if (another && current?.query !== found.query) {
            searched.value = null;
        }

        // Once per menu opened: the repository's people, unless read lately; the thread's are there meanwhile.
        if (another && found.kind === 'mention') {
            void getService().readPeople(toValue(options.repository));
        }

        trigger.value = found;
    }

    function onKeydown(event: KeyboardEvent) {
        const shown = list.value;
        if (!shown || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                active.value = (active.value + step + shown.rows.length) % shown.rows.length;
                return;
            }
            case 'Enter':
            case 'Tab':
                if (event.shiftKey) {
                    return;
                }

                event.preventDefault();
                pick(active.value);
                return;
            case 'Escape':
                // Only the menu closes: not the editor, nor the item it is in.
                event.preventDefault();
                event.stopPropagation();
                dismissed = trigger.value?.start ?? null;
                close();
        }
    }

    function close() {
        trigger.value = null;
    }

    // Read again from the text area as it is now, so the text typed since the menu last changed is what is replaced.
    // As typed: `insertText` keeps it in the undo history and reports it as input, which updates the text.
    function pick(index: number) {
        const element = options.textarea.value;
        const shown = list.value;
        if (!element || !shown) {
            return;
        }

        const caret = element.selectionStart;
        const found = findSuggestionTrigger(element.value, { start: caret, end: element.selectionEnd });
        const insert = getInsert(shown, index);
        close();
        if (!found || found.kind !== shown.kind || insert === null) {
            return;
        }

        element.focus();
        element.setSelectionRange(found.start, caret);
        document.execCommand('insertText', false, insert);
    }

    function highlight(index: number) {
        active.value = index;
    }
}

function getInsert(shown: SuggestionList, index: number) {
    if (shown.kind === 'mention') {
        const person = shown.rows[index];
        return person ? `@${person.login} ` : null;
    }

    const item = shown.rows[index];
    return item ? `#${item.number} ` : null;
}
