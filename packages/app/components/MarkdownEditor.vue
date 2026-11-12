<!-- The one Markdown editor (a comment, a reply, a comment edited in place): Write / Preview tabs, formatting tools in the head that wrap or start the selection in Markdown, a text area growing with its text, and a footer with the caller's buttons. Preview shows GitHub's own rendering of the text in the repository's context; what is typed stays the caller's (`v-model`) and in the text area, whatever the preview does. Typing `@` or `#` at a word's start, or their tools, opens suggestions at the caret (`MarkdownSuggestions`): the thread's people, then the repository's, and the repository's issues and pull requests — ↑↓ move, Enter or Tab inserts, Escape closes them alone. `Mod+Enter` and `Escape` inside it are otherwise only reported (`submit`, `cancel`): the caller decides what they do. A caller's own tool (code review's Suggest a change) goes first in the head, a rule after it; it only reports its click, and the caller inserts with `insert` at the selection `getSelection` reads. The keys a caller acts on in the text (`keyshortcuts`) are announced on it. While the caller has it ask (`asking`, D40), its footer asks whether to discard what is written: the caller's question with an amber circle-alert, and Keep (`Escape`, the caller's label) and Discard (`Enter`) in place of the caller's buttons. The cursor goes to the text, where Enter discards rather than starting a line; Enter on a button, a tab or a tool does what that one does; Escape keeps writing, and typing anything takes the question away. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** A tool of the caller's, first in the head: clicking it is reported (`tool`), and its key is the caller's to handle. */
export interface MarkdownEditorTool {
  /** Its name, said and shown in its tooltip. */
  readonly label: string;
  readonly icon: LucideIcon;
  /** Its key in the app's notation, shown in the tooltip and announced. */
  readonly keys?: string;
}
</script>

<script lang="ts" setup>
import { useTextArea } from '@nzyme/vue-forms/components/useTextArea.jsx';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useDataSource } from '@nzyme/vue-utils/useDataSource.js';
import {
  AtSign,
  Bold,
  CircleAlert,
  Code,
  Hash,
  Heading,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  TextQuote,
} from 'lucide-vue-next';
import { TabsContent, TabsList, TabsRoot, TabsTrigger, ToolbarButton, ToolbarRoot, ToolbarSeparator } from 'reka-ui';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import type { PropType } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import GitHubHtml from '@/item/GitHubHtml.vue';
import { RenderMarkdownCommand } from '@/services/RenderMarkdownCommand.js';

import { applyMarkdownTool } from './applyMarkdownTool.js';
import Button from './Button.vue';
import type { MarkdownTool } from './applyMarkdownTool.js';
import * as l from './MarkdownEditor.loc.js';
import MarkdownSuggestions from './MarkdownSuggestions.vue';
import type { PersonSuggestion } from './SuggestionTypes.js';
import Tooltip from './Tooltip.vue';
import { useMarkdownSuggestions } from './useMarkdownSuggestions.js';

// nzyme's text area props: `modelValue` (the text), `label` (the text area's accessible name), `placeholder`,
// `disabled`, `readonly`; the repository the text is written in, `owner/name`, which the preview links `#42` and
// mentions in, and whose people `@` and issues and pull requests `#` suggest; and the people of the thread written in
// (who opened it, who commented), whom `@` suggests first; the number of the item written on, which `#` does not
// suggest; the caller's tool, first in the head; the keys the caller acts on in the text area, in `aria-keyshortcuts`'
// notation, announced on it; whether its footer asks to discard what is written (the caller turns it on, Keep or typing
// turns it off), the question and the label of the button keeping what is written.
const props = defineProps({
  ...useTextArea.props,
  repository: { type: String, required: true },
  people: { type: Array as PropType<readonly PersonSuggestion[]>, default: () => [] },
  itemNumber: { type: Number, default: undefined },
  tool: { type: Object as PropType<MarkdownEditorTool | null>, default: null },
  keyshortcuts: { type: String, default: undefined },
  asking: { type: Boolean, default: false },
  question: { type: String, default: '' },
  keepLabel: { type: String, default: '' },
});
const emit = defineEmits({
  ...useTextArea.emits,
  /** `Mod+Enter` inside the editor. */
  submit: () => true,
  /** `Escape` inside the editor; the caller taking it prevents its default, and the screen leaves the key alone. */
  cancel: (_event: KeyboardEvent) => true,
  /** The caller's tool was clicked. */
  tool: () => true,
  /** Discard, answering the question: what follows is the caller's. */
  discard: () => true,
  'update:asking': (_asking: boolean) => true,
});
defineSlots<{
  /** The footer's buttons, at its right, while it does not ask. */
  footer?(): unknown;
}>();

/** The tool groups of the head, a rule between each. */
const TOOL_GROUPS: readonly (readonly MarkdownTool[])[] = [
  ['heading', 'bold', 'italic', 'code', 'link'],
  ['bulletList', 'numberedList', 'taskList', 'quote'],
  ['mention', 'reference'],
];

const TOOL_ICONS: Record<MarkdownTool, LucideIcon> = {
  heading: Heading,
  bold: Bold,
  italic: Italic,
  code: Code,
  link: Link,
  bulletList: List,
  numberedList: ListOrdered,
  taskList: ListChecks,
  quote: TextQuote,
  mention: AtSign,
  reference: Hash,
};

const { TextArea, field, input } = useTextArea();
const t = useTranslate();
const render = useService(RenderMarkdownCommand);
const logger = useLogger();
const suggestions = useMarkdownSuggestions({
  textarea: input,
  repository: () => props.repository,
  people: () => props.people,
  itemNumber: () => props.itemNumber,
});

const headRef = useTemplateRef<HTMLElement>('head');
const footerRef = useTemplateRef<HTMLElement>('footer');
const tab = ref<'write' | 'preview'>('write');
/**
 * GitHub's rendering of a text in a repository: the last one asked for on the Preview tab, kept while the user writes
 * on. Rendered again once the text or the repository is not the one rendered (the caller moved to another item).
 */
const preview = useDataSource({
  params: () => ({ text: field.value ?? '', repository: props.repository, shown: tab.value === 'preview' }),
  load: async (params, rendered: RenderedPreview | null | undefined): Promise<RenderedPreview | null> => {
    if (!params.shown || !params.text.trim() || (rendered && isCurrent(rendered))) {
      return rendered ?? null;
    }

    try {
      const html = await render({ text: params.text, context: params.repository });
      // Answered after the text or the repository changed: what is shown stays.
      return isCurrent(params) ? { text: params.text, repository: params.repository, html } : preview.value;
    } catch (error) {
      if (!isCurrent(params)) {
        return preview.value;
      }

      throw error;
    }
  },
  default: null,
  behavior: 'eager',
  onError: error => logger.warn('The Markdown preview could not be rendered', { error }),
});
/** The rendering of the text as it is now, in the repository it is written in; `null` while there is none. */
const shownPreview = computed(() => (preview.value && isCurrent(preview.value) ? preview.value : null));
/** While it asks, Enter and Escape answer from the text. */
const textKeys = computed(() => (props.asking ? 'Enter Escape' : props.keyshortcuts));

defineExpose({
  /**
   * Puts the cursor in the text area, on the Write tab, and brings into view the editor's `head` (a long text opened
   * to edit: its tabs and tools, the caret wherever it is) or its `end` (where the caret is after a quote); with
   * neither, nothing moves.
   */
  focus,
  /** Where the selection is in the text area; `null` before it is drawn. */
  getSelection,
  /** Types `text` over the selection, as `applyTool` does, and puts the caret `caret` characters into it. */
  insert,
});

// The question is answered from the text: the cursor goes there, and the footer asking it into view.
watch(
  () => props.asking,
  async value => {
    if (value) {
      await focus('end');
    }
  },
);

async function focus(reveal?: 'head' | 'end') {
  tab.value = 'write';
  await nextTick();
  // Not scrolled to the caret by the browser: on a long text that takes the head out of view.
  input.value?.focus({ preventScroll: true });
  if (reveal) {
    await bringIntoView(reveal === 'head' ? headRef.value : footerRef.value);
  }
}

function getSelection() {
  const element = input.value;
  return element ? { start: element.selectionStart, end: element.selectionEnd } : null;
}

function insert(text: string, caret: number) {
  const element = input.value;
  if (!element) {
    return;
  }

  const start = element.selectionStart;
  element.focus({ preventScroll: true });
  document.execCommand('insertText', false, text);
  element.setSelectionRange(start + caret, start + caret);
}

/**
 * Typed at the end, the text area grows under the footer: the browser keeps the caret in view, the footer and its
 * buttons follow it into view.
 */
async function onInput() {
  // Typing anything takes the question away: the user went back to writing.
  if (props.asking) {
    emit('update:asking', false);
  }
  suggestions.update();
  const element = input.value;
  if (element && element.selectionEnd === element.value.length) {
    await bringIntoView(footerRef.value);
  }
}

// A frame on, the text area has grown to its text (`useTextArea` sizes it a tick after the text changes).
async function bringIntoView(part: HTMLElement | null) {
  await new Promise(resolve => {
    requestAnimationFrame(resolve);
  });
  part?.scrollIntoView({ block: 'nearest' });
}

// The suggestions take their keys first: with them open, Enter inserts one and Escape closes them only.
function onKeydown(event: KeyboardEvent) {
  suggestions.onKeydown(event);
  if (event.defaultPrevented) {
    return;
  }

  if (props.asking && event.key === 'Escape') {
    // Taken here: neither the caller nor the screen leaves on it.
    event.preventDefault();
    keepWriting();
  } else if (props.asking && matchesCommandKey(event, 'Enter') && event.target === input.value) {
    // In the text, Enter answers the question rather than starting a line; on a button, a tab or a tool it is theirs.
    event.preventDefault();
    emit('discard');
  } else if (matchesCommandKey(event, 'Mod+Enter')) {
    event.preventDefault();
    emit('submit');
  } else if (event.key === 'Escape') {
    emit('cancel', event);
  }
}

// Not awaited: a click listener's promise would show the button busy.
function keepWriting() {
  emit('update:asking', false);
  void focus('end');
}

function onTab(value: string | number) {
  tab.value = value === 'preview' ? 'preview' : 'write';
}

function isCurrent({ text, repository }: { text: string; repository: string }) {
  return text === (field.value ?? '') && repository === props.repository;
}

// As typed: `insertText` keeps the edit in the text area's undo history and reports it as input, which updates the
// text. Every engine the app runs on (Chromium, WebKit, Gecko) takes it in a text area.
function applyTool(tool: MarkdownTool) {
  const element = input.value;
  if (!element) {
    return;
  }

  const edit = applyMarkdownTool(element.value, { start: element.selectionStart, end: element.selectionEnd }, tool);
  element.focus();
  element.setSelectionRange(edit.range.start, edit.range.end);
  document.execCommand('insertText', false, edit.insert);

  element.setSelectionRange(edit.selection.start, edit.selection.end);
}

/** GitHub's rendering of `text`, written in `repository`. */
interface RenderedPreview {
  readonly text: string;
  readonly repository: string;
  readonly html: string;
}
</script>

<template>
  <TabsRoot
    :model-value="tab"
    :class="css.markdownEditor"
    :unmount-on-hide="false"
    @update:model-value="onTab"
    @keydown="onKeydown"
  >
    <div
      ref="head"
      :class="css.markdownEditor_head"
    >
      <TabsList :class="css.markdownEditor_tabs">
        <TabsTrigger
          value="write"
          :class="css.markdownEditor_tab"
        >
          {{ t(l.write) }}
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          :class="css.markdownEditor_tab"
        >
          {{ t(l.preview) }}
        </TabsTrigger>
      </TabsList>
      <ToolbarRoot
        v-if="tab === 'write'"
        :class="css.markdownEditor_tools"
        :aria-label="t(l.formatting)"
      >
        <template v-if="tool">
          <Tooltip
            :text="tool.label"
            :kbd="tool.keys"
          >
            <ToolbarButton
              :class="[css.markdownEditor_tool, css.markdownEditor_tool_own]"
              :aria-label="tool.label"
              :aria-keyshortcuts="tool.keys && formatAriaKeyShortcuts(tool.keys)"
              :disabled="disabled || readonly"
              @click="emit('tool')"
            >
              <component
                :is="tool.icon"
                :class="css.markdownEditor_toolIcon"
                aria-hidden="true"
              />
            </ToolbarButton>
          </Tooltip>
          <ToolbarSeparator :class="css.markdownEditor_rule" />
        </template>
        <template
          v-for="(group, index) in TOOL_GROUPS"
          :key="index"
        >
          <ToolbarSeparator
            v-if="index > 0"
            :class="css.markdownEditor_rule"
          />
          <Tooltip
            v-for="formatting in group"
            :key="formatting"
            :text="t(l[formatting])"
          >
            <ToolbarButton
              :class="css.markdownEditor_tool"
              :aria-label="t(l[formatting])"
              :disabled="disabled || readonly"
              @click="applyTool(formatting)"
            >
              <component
                :is="TOOL_ICONS[formatting]"
                :class="css.markdownEditor_toolIcon"
                aria-hidden="true"
              />
            </ToolbarButton>
          </Tooltip>
        </template>
      </ToolbarRoot>
    </div>
    <TabsContent
      value="write"
      :class="css.markdownEditor_body"
      tabindex="-1"
    >
      <TextArea
        :class="css.markdownEditor_text"
        v-bind="suggestions.attrs"
        :aria-keyshortcuts="textKeys"
        @input="onInput"
        @keyup="suggestions.update()"
        @click="suggestions.update()"
        @blur="suggestions.close()"
      />
      <MarkdownSuggestions
        v-if="suggestions.list && suggestions.anchor"
        :id="suggestions.id"
        :suggestions="suggestions.list"
        :active="suggestions.active"
        :anchor="suggestions.anchor"
        :repository="repository"
        @pick="suggestions.pick"
        @highlight="suggestions.highlight"
      />
    </TabsContent>
    <TabsContent
      value="preview"
      :class="css.markdownEditor_body"
    >
      <p
        v-if="!field.value?.trim()"
        :class="css.markdownEditor_note"
      >
        {{ t(l.previewEmpty) }}
      </p>
      <GitHubHtml
        v-else-if="shownPreview"
        :class="css.markdownEditor_rendered"
        :html="shownPreview.html"
      />
      <p
        v-else-if="preview.error && !preview.pending"
        :class="css.markdownEditor_note"
      >
        {{ t(l.previewFailed) }}
      </p>
      <p
        v-else
        :class="css.markdownEditor_note"
      >
        {{ t(l.previewLoading) }}
      </p>
    </TabsContent>
    <div
      ref="footer"
      :class="css.markdownEditor_footer"
    >
      <template v-if="asking">
        <CircleAlert
          :class="css.markdownEditor_questionIcon"
          aria-hidden="true"
        />
        <span
          :class="css.markdownEditor_question"
          role="status"
          >{{ question }}</span
        >
      </template>
      <div :class="css.markdownEditor_actions">
        <template v-if="asking">
          <Button
            size="compact"
            kbd="Escape"
            keyshortcuts="Escape"
            @click="keepWriting"
          >
            {{ keepLabel }}
          </Button>
          <Button
            size="compact"
            variant="destructive"
            kbd="Enter"
            keyshortcuts="Enter"
            @click="emit('discard')"
          >
            {{ t(l.discard) }}
          </Button>
        </template>
        <slot
          v-else
          name="footer"
        />
      </div>
    </div>
  </TabsRoot>
</template>

<style lang="scss" module="css">
.markdownEditor {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;

  &:focus-within {
    border-color: $color-accent;
  }
}

.markdownEditor_head {
  display: flex;
  gap: $spacing-8;
  align-items: flex-end;
  height: 38px;
  padding: $spacing-6 $spacing-10 0 $spacing-8;
  border-bottom: 1px solid $color-border;
}

.markdownEditor_tabs {
  display: flex;
  align-self: stretch;
}

// Classic tabs: the current one is the text area's background, open at the bottom over the head's line, so it opens
// into the text area below it.
.markdownEditor_tab {
  @include focus-ring;

  position: relative;
  top: 1px;
  padding: 0 $spacing-14;
  font-family: inherit;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: $radius-md $radius-md 0 0;

  &:hover {
    color: $color-fg;
  }

  &[data-state='active'] {
    color: $color-fg;
    background: $color-bg;
    border-color: $color-border;
  }
}

.markdownEditor_tools {
  display: flex;
  align-items: center;
  align-self: stretch;
  margin-left: auto;
}

.markdownEditor_tool {
  @include focus-ring;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: $color-fg-3;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
    background: $color-bg-3;
  }

  &:disabled {
    color: $color-fg-3;
    cursor: default;
    background: none;
  }
}

// The caller's tool stands out a little from the formatting after it.
.markdownEditor_tool_own {
  color: $color-fg-2;
}

.markdownEditor_toolIcon {
  width: 14px;
  height: 14px;
}

.markdownEditor_rule {
  width: 1px;
  height: 14px;
  margin: 0 $spacing-5;
  background: $color-border-2;
}

.markdownEditor_body {
  background: $color-bg;
  outline: none;

  &[hidden] {
    display: none;
  }
}

.markdownEditor_text {
  display: block;
  width: 100%;
  min-height: 70px;
  padding: $spacing-10 $spacing-12;
  font-family: inherit;
  font-size: $font-size-md;
  // Markdown as typed: Inter's contextual alternates would draw `-->` as an arrow and `<=` as one sign.
  font-feature-settings: 'calt' 0;
  font-variant-ligatures: none;
  line-height: $line-height-normal;
  color: $color-fg;
  resize: none;
  background: none;
  border: none;
  // The editor's accent border shows where the focus is.
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
  }
}

.markdownEditor_rendered,
.markdownEditor_note {
  min-height: 70px;
  padding: $spacing-10 $spacing-12;
}

.markdownEditor_rendered {
  --github-html-line-height: #{$line-height-normal};
  --github-html-color: #{$color-fg};
}

.markdownEditor_note {
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
}

.markdownEditor_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-10 $spacing-8 $spacing-12;
  border-top: 1px solid $color-border;
}

.markdownEditor_question {
  font-size: $font-size-xs;
  color: $color-fg;
}

.markdownEditor_questionIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.markdownEditor_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  margin-left: auto;
}
</style>
