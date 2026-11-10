import type { VirtualElement } from '@floating-ui/vue';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, ref, shallowRef, toValue, useId } from 'vue';
import type { MaybeRefOrGetter, Ref, TextareaHTMLAttributes } from 'vue';

import { MarkdownSuggestionService } from '@/services/MarkdownSuggestionService.js';
import { getCaretRect } from '@/utils/getCaretRect.js';

import { findSuggestionTrigger } from './findSuggestionTrigger.js';
import type { SuggestionTrigger } from './findSuggestionTrigger.js';
import type { PersonSuggestion, SuggestionList } from './SuggestionTypes.js';

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
 * when a row is picked, and they never take a key while closed: typing goes on as if they were not there. An answer
 * arriving after what is typed changed is dropped; Escape closes them until another `@` or `#` is typed.
 */
export function useMarkdownSuggestions(options: UseMarkdownSuggestionsOptions): MarkdownSuggestionsViewModel {
    const container = useContainer();
    const logger = useLogger();
    const id = useId();

    const trigger = shallowRef<SuggestionTrigger | null>(null);
    const list = shallowRef<SuggestionList | null>(null);
    const active = ref(0);
    /** Where the trigger closed by Escape starts: it stays closed while the caret is after it. */
    let dismissed: number | null = null;
    /** Counts what was asked, so an answer to anything but the last is dropped. */
    let asked = 0;

    const start = computed(() => trigger.value?.start ?? null);
    const anchor = computed((): VirtualElement | null => {
        const element = options.textarea.value;
        const at = start.value;
        if (!element || at === null) {
            return null;
        }

        return { getBoundingClientRect: () => getCaretRect(element, at), contextElement: element };
    });
    const open = computed(() => list.value !== null && anchor.value !== null);
    // The text area stays a text box — ARIA lets a `textarea` take no other role — that owns the menu as a combobox
    // does, as GitHub's own editor does: it says it completes from a list, which list, and which row is highlighted.
    const attrs = computed((): TextareaHTMLAttributes => ({
        'aria-autocomplete': 'list',
        'aria-haspopup': 'listbox',
        'aria-controls': open.value ? id : undefined,
        'aria-activedescendant': open.value ? `${id}-${active.value}` : undefined,
    }));

    return reactive<MarkdownSuggestionsViewModel>({
        id,
        list: computed(() => (open.value ? list.value : null)),
        active,
        anchor,
        attrs,
        update,
        onKeydown,
        close,
        pick,
        highlight,
    });

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

        // Another trigger: what the last one listed is not of it. The same one typed on keeps its rows until the
        // answer for what is typed now replaces them.
        if (current?.kind !== found.kind || current.start !== found.start) {
            list.value = null;
        }

        trigger.value = found;
        void load(found);
    }

    async function load(found: SuggestionTrigger) {
        asked++;
        const question = asked;
        const repository = toValue(options.repository);
        const suggest = container.resolve(MarkdownSuggestionService);
        try {
            const next: SuggestionList =
                found.kind === 'mention'
                    ? {
                          kind: 'mention',
                          rows: await suggest.people({
                              repository,
                              query: found.query,
                              thread: toValue(options.people),
                          }),
                      }
                    : { kind: 'reference', rows: await suggest.references({ repository, query: found.query }) };
            if (question !== asked) {
                return;
            }

            list.value = next.rows.length > 0 ? next : null;
            active.value = 0;
        } catch (error) {
            if (question === asked) {
                list.value = null;
                logger.warn('The editor could not suggest anything', { kind: found.kind, error });
            }
        }
    }

    function onKeydown(event: KeyboardEvent) {
        const shown = open.value ? list.value : null;
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
        asked++;
        trigger.value = null;
        list.value = null;
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
