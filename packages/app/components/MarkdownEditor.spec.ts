import type { ReferenceSearchQuery } from '@githq/github/generated.gen.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { waitFor } from '@nzyme/utils/waitFor.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, ref } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';
import { RenderMarkdownCommand } from '@/services/RenderMarkdownCommand.js';
import type { RenderMarkdownCommandShape } from '@/services/RenderMarkdownCommand.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { IssueItem } from '@/store/ItemTypes.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import MarkdownEditor from './MarkdownEditor.vue';
import * as stories from './MarkdownEditor.stories.js';

const { Empty, Narrow, PreviewFailed, Typed } = composeStories(stories);

test("Preview shows GitHub's rendering without the tools; Write brings back the text as typed", async () => {
    await Empty.run();

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(text, 'could you take another look?');
    await userEvent.click(page.getByRole('tab', { name: 'Preview' }));

    await expect.element(page.getByRole('link', { name: '@sofiab' })).toBeVisible();
    await expect.element(page.getByRole('toolbar', { name: 'Formatting' })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    await expect.element(text).toHaveValue('could you take another look?');
});

test('moved to another item on Preview, it shows that item’s text rendered in its own repository, never the last one', async () => {
    const { view, ...item } = mountMovingEditor({ text: 'Fixed in #12', repository: 'acme/web' });
    await userEvent.click(view.getByRole('tab', { name: 'Preview' }));
    await expect.element(view.getByText('acme/web: Fixed in #12')).toBeVisible();

    // The same text, in another repository: its #12 is another one.
    item.repository.value = 'acme/api';
    await expect.element(view.getByText('acme/api: Fixed in #12')).toBeVisible();
    await expect.element(view.getByText('acme/web: Fixed in #12')).not.toBeInTheDocument();

    // Another text: the last item's rendering does not stay while this one's is on its way.
    item.text.value = 'Duplicate of #3';
    await expect.element(view.getByText('acme/api: Fixed in #12')).not.toBeInTheDocument();
    await expect.element(view.getByText('acme/api: Duplicate of #3')).toBeVisible();
});

test('a preview GitHub could not render says so, and the text stays as typed', async () => {
    await PreviewFailed.run();

    await expect.element(page.getByText("The preview couldn't be loaded. What you wrote is kept.")).toBeVisible();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    const text = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(text).toHaveValue(PreviewFailed.args.modelValue);
    // The text is still the caller's to post or edit.
    await userEvent.type(text, ' Thanks!');
    await expect.element(text).toHaveValue(`${PreviewFailed.args.modelValue} Thanks!`);
});

test('a tool wraps the selection, keeps it selected, and is one undo away', async () => {
    await Empty.run();

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(text, 'a fix here');
    // "fix" selected, from its end.
    await userEvent.keyboard('{ArrowLeft>5/}{Shift>}{ArrowLeft>3/}{/Shift}');
    await userEvent.click(page.getByRole('button', { name: 'Bold' }));

    await expect.element(text).toHaveValue('a **fix** here');
    await expect.element(text).toHaveFocus();
    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    await expect.element(text).toHaveValue('a fix here');
});

test('the tools are one stop for Tab, moved through by the arrow keys', async () => {
    await Empty.run();

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Heading' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveFocus();
});

test('Mod+Enter and Escape inside it are reported, not acted on', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    await Typed.run({ args: { ...Typed.args, onSubmit, onCancel } });

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.click(text);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await expect.element(text).toHaveValue(Typed.args.modelValue);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
});

test("@ suggests the thread's people at the caret; ↑↓ move the highlight and Enter puts the login in place of what was typed", async () => {
    const { text } = await mountSuggestingEditor({});

    await userEvent.type(text, 'Thanks @so');
    await expect.poll(suggested).toEqual(['sofiab Sofia Berg', 'sophie-k Sophie Klein']);
    await expect.poll(highlighted).toBe('sofiab Sofia Berg');

    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(highlighted).toBe('sophie-k Sophie Klein');
    await userEvent.keyboard('{Enter}');

    await expect.element(text).toHaveValue('Thanks @sophie-k ');
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(text).toHaveFocus();
});

test("# suggests what GitHub's search finds in a repository not tracked, by number first; Tab inserts it", async () => {
    const { text, searched } = await mountSuggestingEditor({
        found: { '12': [issue(120, 'Lists flash empty'), issue(12, 'Sub-issue links are lost')] },
    });

    await userEvent.type(text, 'Fixed in #12');
    await expect.poll(suggested).toEqual(['#12 Sub-issue links are lost', '#120 Lists flash empty']);
    expect(searched).toContain('repo:acme/web sort:updated-desc 12');

    await userEvent.keyboard('{Tab}');
    await expect.element(text).toHaveValue('Fixed in #12 ');
    await expect.element(text).toHaveFocus();
});

test('Escape closes the menu alone — the editor reports no cancel and keeps the text and the cursor — until another @ is typed', async () => {
    const onCancel = vi.fn();
    const { text } = await mountSuggestingEditor({ onCancel });

    await userEvent.type(text, '@so');
    await expect.poll(suggested).toHaveLength(2);
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    await expect.element(text).toHaveFocus();
    await userEvent.keyboard('f');
    await expect.element(text).toHaveValue('@sof');
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();

    await userEvent.keyboard(' @ml');
    await expect.poll(suggested).toEqual(['mlaine']);
    // Without the menu, Escape is the editor's again.
    await userEvent.keyboard('{Escape}{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
});

test('a space or no match closes the menu; without it Enter types a new line and Mod+Enter submits', async () => {
    const onSubmit = vi.fn();
    const { text } = await mountSuggestingEditor({ onSubmit });

    await userEvent.type(text, '@so');
    await expect.poll(suggested).toHaveLength(2);
    await userEvent.keyboard(' ');
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();

    await userEvent.keyboard('@nobody');
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect.element(text).toHaveValue('@so @nobody\n');

    await userEvent.keyboard('@so');
    await expect.poll(suggested).toHaveLength(2);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await expect.element(text).toHaveValue('@so @nobody\n@so');
});

test('an answer arriving after what is typed changed is dropped: the menu lists what the text asks now', async () => {
    let answerLate = () => {};
    const late = new Promise<void>(resolve => {
        answerLate = resolve;
    });
    const { text } = await mountSuggestingEditor({
        found: { '1': [issue(1, 'One'), issue(12, 'Twelve')], '12': [issue(12, 'Twelve')] },
        hold: query => (query === '1' ? late : null),
    });

    await userEvent.type(text, '#1');
    await userEvent.keyboard('2');
    await expect.poll(suggested).toEqual(['#12 Twelve']);

    answerLate();
    await waitFor(100);
    expect(suggested()).toEqual(['#12 Twelve']);
    await expect.element(text).toHaveValue('#12');
});

test("a tracked repository's issues and pull requests come from the local copy, without asking GitHub", async () => {
    const { text, searched } = await mountSuggestingEditor({
        tracked: [
            { ...sampleIssue('I_login'), number: 31, title: 'Sign-in loops on Safari' },
            { ...sampleIssue('I_other'), number: 32, title: 'Rebuild links' },
        ],
    });

    await userEvent.type(text, '#sign');
    await expect.poll(suggested).toEqual(['#31 Sign-in loops on Safari']);
    expect(searched).toEqual([]);
});

test("# alone lists a tracked repository's issues, the latest updated first", async () => {
    const { text } = await mountSuggestingEditor({
        tracked: [
            {
                ...sampleIssue('I_old'),
                number: 31,
                title: 'Sign-in loops on Safari',
                updatedAt: '2026-10-01T00:00:00Z',
            },
            { ...sampleIssue('I_new'), number: 32, title: 'Rebuild links', updatedAt: '2026-10-20T00:00:00Z' },
        ],
    });

    await userEvent.type(text, '#');
    await expect.poll(suggested).toEqual(['#32 Rebuild links', '#31 Sign-in loops on Safari']);
});

test('# does not offer the item the editor is written on: it would point at itself', async () => {
    const { text } = await mountSuggestingEditor({
        tracked: [
            { ...sampleIssue('I_self'), number: 31, title: 'Sign-in loops on Safari' },
            { ...sampleIssue('I_other'), number: 32, title: 'Sign-in loops on Firefox' },
        ],
        itemNumber: 31,
    });

    await userEvent.type(text, '#sign');
    await expect.poll(suggested).toEqual(['#32 Sign-in loops on Firefox']);
});

test('# alone in a repository not tracked asks GitHub nothing until a character follows', async () => {
    const { text, searched } = await mountSuggestingEditor({ found: { '': [issue(7, 'Seven')] } });

    await userEvent.type(text, '#');
    await waitFor(400);
    expect(searched).toEqual([]);
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
});

test('the @ tool types the @ starting a word and opens the menu at it', async () => {
    const { text, view } = await mountSuggestingEditor({});

    await userEvent.type(text, 'thanks');
    await userEvent.click(view.getByRole('button', { name: 'Mention someone' }));

    await expect.element(text).toHaveValue('thanks @');
    await expect.poll(suggested).toEqual(['sofiab Sofia Berg', 'sophie-k Sophie Klein', 'mlaine']);
    await expect.element(text).toHaveFocus();
});

test('in a narrow head the last groups fold into ⋯, and a tool picked there applies as its button does', async () => {
    await Narrow.run({ args: { ...Narrow.args, modelValue: '' } });

    await expect.element(page.getByRole('button', { name: 'Bold' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Bulleted list' })).not.toBeInTheDocument();

    const text = page.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(text, 'steps');
    await userEvent.click(page.getByRole('button', { name: 'More formatting' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Bulleted list' }));

    await expect.element(text).toHaveValue('- steps');
    await expect.element(text).toHaveFocus();
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('⋯ is the toolbar’s last stop for the arrow keys, its menu walked by them too; @ from it opens the suggestions', async () => {
    await Narrow.run({ args: { ...Narrow.args, modelValue: '' } });

    await userEvent.click(page.getByRole('tab', { name: 'Write' }));
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Suggest a change' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    const more = page.getByRole('button', { name: 'More formatting' });
    await expect.element(more).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menuitem', { name: 'Bulleted list' })).toHaveFocus();
    await userEvent.keyboard('{End}{ArrowUp}{Enter}');

    const text = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(text).toHaveValue('@');
    await expect.element(text).toHaveFocus();
    await expect.element(page.getByRole('listbox')).toBeVisible();
});

test('a disabled editor’s ⋯ is disabled', async () => {
    await Narrow.run({ args: { ...Narrow.args, disabled: true } });

    await expect.element(page.getByRole('button', { name: 'More formatting' })).toBeDisabled();
});

/**
 * The editor as the item view holds it: its text and repository the opened item's, changed under it when the user
 * moves on; GitHub rendering a text as `repository: text`, a moment later.
 */
function mountMovingEditor(initial: { text: string; repository: string }) {
    const text = ref(initial.text);
    const repository = ref(initial.repository);
    const render: RenderMarkdownCommandShape = async params => {
        await waitFor(50);
        return `<p>${params.context}: ${params.text}</p>`;
    };
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(RenderMarkdownCommand, render);
    const app = createApp({
        setup: () => () =>
            h(MarkdownEditor, {
                label: 'Comment',
                modelValue: text.value,
                repository: repository.value,
                'onUpdate:modelValue': (value: string | null | undefined) => {
                    text.value = value ?? '';
                },
            }),
    });
    app.use(IocPlugin, { container });
    const root = document.createElement('div');
    root.setAttribute('tid', 'moving-editor');
    document.body.append(root);
    app.mount(root);
    onTestFinished(() => {
        app.unmount();
        root.remove();
    });

    return { text, repository, view: page.getByTestId('moving-editor') };
}

/** The parameters of {@link mountSuggestingEditor}. */
interface SuggestingEditorParams {
    /** What GitHub's search finds, by what is typed after `#`. */
    readonly found?: Readonly<Record<string, readonly SearchNode[]>>;
    /** The answer to a search waits for the promise this returns for what was typed, when it returns one. */
    readonly hold?: (query: string) => Promise<void> | null;
    /** acme/web is tracked, and these are its items in the local copy. */
    readonly tracked?: readonly IssueItem[];
    /** The item the editor is written on. */
    readonly itemNumber?: number;
    readonly onSubmit?: () => void;
    readonly onCancel?: () => void;
}

type SearchNode = NonNullable<ReferenceSearchQuery['search']['nodes']>[number];

/**
 * The editor in acme/web's thread of sofiab, sophie-k and mlaine, signed in, with the local copy in IndexedDB and a
 * GitHub that answers only the search for issues (its repository's people are not read: the thread's are suggested).
 */
async function mountSuggestingEditor(params: SuggestingEditorParams) {
    const searched: string[] = [];
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser(answerSearch(params, searched)));
    setIndexedDbPersistence(container);

    if (params.tracked) {
        const tracking = container.resolve(TrackingStore);
        await tracking.ready();
        tracking.track({ repository: { nameWithOwner: 'acme/web', id: 'R_web' } });
        const items = container.resolve(ItemStore);
        await items.ready();
        items.upsertMany(params.tracked);
    }

    const text = ref('');
    const app = createApp({
        setup: () => () =>
            h(MarkdownEditor, {
                label: 'Comment',
                modelValue: text.value,
                repository: 'acme/web',
                itemNumber: params.itemNumber,
                people: [
                    { login: 'sofiab', name: 'Sofia Berg', avatarUrl: 'https://avatars.test/sofiab' },
                    { login: 'sophie-k', name: 'Sophie Klein', avatarUrl: 'https://avatars.test/sophie-k' },
                    { login: 'mlaine', avatarUrl: 'https://avatars.test/mlaine' },
                ],
                onSubmit: params.onSubmit,
                onCancel: params.onCancel,
                'onUpdate:modelValue': (value: string | null | undefined) => {
                    text.value = value ?? '';
                },
            }),
    });
    app.use(IocPlugin, { container });
    const root = document.createElement('div');
    root.setAttribute('tid', 'suggesting-editor');
    // As wide as a page's thread: every tool in the head.
    root.style.width = '680px';
    document.body.append(root);
    app.mount(root);
    onTestFinished(() => {
        app.unmount();
        root.remove();
    });

    const view = page.getByTestId('suggesting-editor');
    return { text: view.getByRole('textbox', { name: 'Comment' }), view, searched };
}

/** A GitHub answering `ReferenceSearch` from `found`, recording each search's query; anything else a 502. */
function answerSearch(params: SuggestingEditorParams, searched: string[]): BrowserShape['fetch'] {
    return async (_input, init) => {
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        const query = readSearchQuery(body);
        if (query === null) {
            return Response.json({ message: 'Server Error' }, { status: 502 });
        }

        searched.push(query);
        const typed = query.replace('repo:acme/web sort:updated-desc', '').trim();
        await params.hold?.(typed);
        const answer: ReferenceSearchQuery = { search: { nodes: [...(params.found?.[typed] ?? [])] } };
        return Response.json({ data: answer });
    };
}

function readSearchQuery(body: unknown) {
    if (typeof body !== 'object' || body === null || !('query' in body) || !('variables' in body)) {
        return null;
    }

    const { query, variables } = body;
    if (typeof query !== 'string' || !query.includes('query ReferenceSearch')) {
        return null;
    }

    return typeof variables === 'object' &&
        variables !== null &&
        'query' in variables &&
        typeof variables.query === 'string'
        ? variables.query
        : null;
}

function issue(number: number, title: string): SearchNode {
    return { __typename: 'Issue', number, title, issueState: 'OPEN', stateReason: null };
}

/** The rows of the menu, as read out: their texts but the pictures'. */
function suggested() {
    return page.getByRole('option').elements().map(readRow);
}

/** The row the text area points assistive technology at. */
function highlighted() {
    const id = document.querySelector('[tid="suggesting-editor"] textarea')?.getAttribute('aria-activedescendant');
    const row = id ? document.querySelector(`#${CSS.escape(id)}`) : null;
    return row ? readRow(row) : null;
}

function readRow(row: Element) {
    return [...row.querySelectorAll(':scope > :not([aria-hidden="true"])')]
        .map(part => part.textContent.trim())
        .join(' ');
}
