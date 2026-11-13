import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { nextTick, ref, shallowRef, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { EditFailureReason, EditRequest } from '@/edits/EditTypes.js';
import type { FailedTextEdit } from '@/edits/CommentDrafts.js';

/** A card's text being edited, and the text the edit started with. */
export interface CommentEditorText {
    readonly text: string;
    readonly start: string;
}

/** The parameters of {@link useCommentActions}. */
export interface UseCommentActionsOptions {
    /** Whose comments they are: another item closes every editor, whose Update would save into the wrong one. */
    readonly subject: MaybeRefOrGetter<string>;
    /** The user's edits GitHub did not take: each opens its editor again, with its text. */
    readonly failedEdits: MaybeRefOrGetter<readonly FailedTextEdit[] | undefined>;
    /** A comment or the description edited, or a comment deleted. */
    readonly onEdit: (request: EditRequest) => void;
    /** An edit GitHub did not take was cancelled: of the comment, or (`null`) the description. */
    readonly onDiscardEdit: (commentId: string | null) => void;
    /** Quote reply: the Markdown quoted into the composer, once the menu gave the focus back. */
    readonly onQuote: (body: string) => void;
}

/** What a list of comment cards does with them, by comment id (`null` the description). */
export interface CommentActions {
    /** Each card edited in place. */
    readonly editors: ReadonlyMap<string | null, CommentEditorText>;
    /** The editor whose footer asks whether to discard its changes. */
    readonly asking: string | null | undefined;
    /** The editor the user just opened: it takes the focus. */
    readonly focusedEditor: string | null | undefined;
    /** The card whose ⋯ takes the focus, for the moment it takes it. */
    readonly menuFocus: string | null | undefined;
    /** The comment asked to be deleted, while the dialog asks. */
    readonly deletingId: string | null;
    /** Not as the edit started, or not taken by GitHub: an edit GitHub refused counts as changed. */
    isChanged(id: string | null): boolean;
    /** Why GitHub did not take the card's last edit; `null` when it did, or none was made. */
    getFailure(id: string | null): EditFailureReason | null;
    setText(id: string | null, text: string): void;
    /** The editor's own question (Cancel, Escape) and Keep editing: neither goes anywhere after. */
    setAsking(id: string | null, asking: boolean): void;
    /** Edit, from the card's menu: the editor opens with the comment's Markdown and takes the focus. */
    startEdit(id: string | null, body: string): void;
    /** Cancel, or Discard once asked: the focus back to the card's ⋯, and on where the user was leaving to if asked. */
    cancelEdit(id: string | null): void;
    /** Saved as it was: nothing to send, unless it is an edit GitHub did not take. */
    saveEdit(id: string | null, body: string): void;
    /** Quote reply picked: handed over once the menu closed, so the composer keeps the focus it takes. */
    quote(body: string): void;
    /** Delete… picked: asked once the menu closed and the focus is on the card's ⋯. */
    askDelete(id: string): void;
    confirmDelete(): void;
    cancelDelete(): void;
    /** The card's menu closed, about to give the focus back; keeps it where an entry moved it. */
    onMenuClose(event: Event): Promise<void>;
    copyLink(url: string): void;
    /** Before the user leaves: the editor asks whether to discard its changes, Discard then calling `go`. */
    askToLeave(id: string | null, go: () => void): void;
    /** Something else asks before the user leaves: no editor does. */
    stopAsking(): void;
}

/**
 * Editing, deleting, quoting and copying the link of comment cards (F15), shared by every list of them — an item's
 * thread and code review's conversation — so a card does the same wherever it is: an edit asks before its changes are
 * let go, a delete asks first, the focus goes back to the card's ⋯ after either is called off, and an edit GitHub did not
 * take opens again with its text and why.
 */
export function useCommentActions(options: UseCommentActionsOptions): CommentActions {
    const subject = makeRef(options.subject);
    const failedEdits = makeRef(options.failedEdits);

    const editors = shallowRef<ReadonlyMap<string | null, CommentEditorText>>(new Map());
    const asking = ref<string | null | undefined>(undefined);
    const focusedEditor = ref<string | null | undefined>(undefined);
    const menuFocus = ref<string | null | undefined>(undefined);
    const deletingId = ref<string | null>(null);
    /** Where the user was going when leaving asked: Discard goes on there, Keep editing forgets it. */
    let leaving: (() => void) | null = null;
    /** Edit opened an editor from a menu, which took the focus: the closing menu leaves it there. */
    let editOpened = false;
    /** The text Quote reply picked, handed over once the menu closed. */
    let quoted: string | null = null;
    /** The comment Delete… picked, asked about once the menu closed. */
    let deleting: string | null = null;

    watch(
        [subject, failedEdits],
        ([id, failed], before) => {
            if (id !== before[0]) {
                editors.value = new Map();
                asking.value = undefined;
                leaving = null;
                focusedEditor.value = undefined;
                deletingId.value = null;
            }

            for (const edit of failed ?? []) {
                if (!editors.value.has(edit.commentId)) {
                    openEditor(edit.commentId, edit.body);
                }
            }
        },
        { immediate: true },
    );

    return reactive({
        editors,
        asking,
        focusedEditor,
        menuFocus,
        deletingId,
        isChanged,
        getFailure,
        setText,
        setAsking,
        startEdit,
        cancelEdit,
        saveEdit,
        quote,
        askDelete,
        confirmDelete,
        cancelDelete,
        onMenuClose,
        copyLink,
        askToLeave,
        stopAsking,
    });

    function openEditor(id: string | null, text: string) {
        editors.value = new Map(editors.value).set(id, { text, start: text });
    }

    function closeEditor(id: string | null) {
        const next = new Map(editors.value);
        next.delete(id);
        editors.value = next;
        if (asking.value === id) {
            asking.value = undefined;
            leaving = null;
        }
    }

    function isChanged(id: string | null) {
        const editor = editors.value.get(id);
        return editor !== undefined && (editor.text !== editor.start || getFailure(id) !== null);
    }

    function getFailure(id: string | null) {
        return failedEdits.value?.find(edit => edit.commentId === id)?.reason ?? null;
    }

    function setText(id: string | null, text: string) {
        const editor = editors.value.get(id);
        if (editor) {
            editors.value = new Map(editors.value).set(id, { ...editor, text });
        }
    }

    function setAsking(id: string | null, ask: boolean) {
        leaving = null;
        if (ask) {
            asking.value = id;
        } else if (asking.value === id) {
            asking.value = undefined;
        }
    }

    function startEdit(id: string | null, body: string) {
        editOpened = true;
        focusedEditor.value = id;
        openEditor(id, body);
    }

    function cancelEdit(id: string | null) {
        const go = asking.value === id ? leaving : null;
        closeEditor(id);
        void focusMenu(id);
        if (getFailure(id)) {
            options.onDiscardEdit(id);
        }

        go?.();
    }

    function saveEdit(id: string | null, body: string) {
        const text = editors.value.get(id)?.text ?? '';
        closeEditor(id);
        if (text === body && !getFailure(id)) {
            return;
        }

        options.onEdit(
            id === null ? { kind: 'editBody', body: text } : { kind: 'editComment', commentId: id, body: text },
        );
    }

    function quote(body: string) {
        quoted = body;
    }

    function askDelete(id: string) {
        deleting = id;
    }

    function confirmDelete() {
        const id = deletingId.value;
        deletingId.value = null;
        if (id !== null) {
            options.onEdit({ kind: 'deleteComment', commentId: id });
        }
    }

    function cancelDelete() {
        deletingId.value = null;
    }

    // The dialog opens only once the focus is on the card's ⋯ — not on the menu's entry, gone with the menu — so its
    // Cancel gives the focus back there.
    async function onMenuClose(event: Event) {
        const asked = deleting;
        if (editOpened || quoted !== null || asked !== null) {
            event.preventDefault();
        }

        if (quoted !== null) {
            options.onQuote(quoted);
        }

        editOpened = false;
        quoted = null;
        deleting = null;
        if (asked !== null) {
            await focusMenu(asked);
            deletingId.value = asked;
        }
    }

    function copyLink(url: string) {
        void navigator.clipboard.writeText(url);
    }

    // Asked already: asked again a tick on, so that it comes back into view and takes the cursor again.
    function askToLeave(id: string | null, go: () => void) {
        leaving = go;
        if (asking.value !== id) {
            asking.value = id;
            return;
        }

        asking.value = undefined;
        void nextTick(() => {
            asking.value = id;
        });
    }

    function stopAsking() {
        asking.value = undefined;
        leaving = null;
    }

    /** The card's ⋯ takes the focus once the card is on screen again. */
    async function focusMenu(id: string | null) {
        menuFocus.value = id;
        await nextTick();
        menuFocus.value = undefined;
    }
}
