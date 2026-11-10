<!-- The one Markdown editor (a comment, a reply, a comment edited in place): Write / Preview tabs, formatting tools in the head that wrap or start the selection in Markdown, a text area growing with its text, and a footer with the caller's buttons. Preview shows GitHub's own rendering of the text in the repository's context; what is typed stays the caller's (`v-model`) and in the text area, whatever the preview does. Typing `@` or `#` at a word's start, or their tools, opens suggestions at the caret (`MarkdownSuggestions`): the thread's people, then the repository's, and the repository's issues and pull requests — ↑↓ move, Enter or Tab inserts, Escape closes them alone. `Mod+Enter` and `Escape` inside it are otherwise only reported (`submit`, `cancel`): the caller decides what they do. -->
<script lang="ts" setup>
import { useTextArea } from '@nzyme/vue-forms/components/useTextArea.jsx';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useDataSource } from '@nzyme/vue-utils/useDataSource.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  AtSign,
  Bold,
  Code,
  FileText,
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
import { computed, nextTick, ref, useTemplateRef } from 'vue';
import type { PropType } from 'vue';

import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import GitHubHtml from '@/item/GitHubHtml.vue';
import { RenderMarkdownCommand } from '@/services/RenderMarkdownCommand.js';

import { applyMarkdownTool } from './applyMarkdownTool.js';
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
// suggest.
const props = defineProps({
  ...useTextArea.props,
  repository: { type: String, required: true },
  people: { type: Array as PropType<readonly PersonSuggestion[]>, default: () => [] },
  itemNumber: { type: Number, default: undefined },
});
const emit = defineEmits({
  ...useTextArea.emits,
  /** `Mod+Enter` inside the editor. */
  submit: () => true,
  /** `Escape` inside the editor. */
  cancel: () => true,
});
defineSlots<{
  /** The footer's buttons, at its right. */
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

defineExpose({
  /**
   * Puts the cursor in the text area, on the Write tab, and brings into view the editor's `head` (a long text opened
   * to edit: its tabs and tools, the caret wherever it is) or its `end` (where the caret is after a quote).
   */
  focus,
});

async function focus(reveal: 'head' | 'end') {
  tab.value = 'write';
  await nextTick();
  // Not scrolled to the caret by the browser: on a long text that takes the head out of view.
  input.value?.focus({ preventScroll: true });
  // A frame on, the text area has grown to its text (`useTextArea` sizes it a tick after the text changes).
  await new Promise(resolve => {
    requestAnimationFrame(resolve);
  });
  (reveal === 'head' ? headRef : footerRef).value?.scrollIntoView({ block: 'nearest' });
}

// The suggestions take their keys first: with them open, Enter inserts one and Escape closes them only.
function onKeydown(event: KeyboardEvent) {
  suggestions.onKeydown(event);
  if (event.defaultPrevented) {
    return;
  }

  if (matchesCommandKey(event, 'Mod+Enter')) {
    event.preventDefault();
    emit('submit');
  } else if (event.key === 'Escape') {
    emit('cancel');
  }
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
        <template
          v-for="(group, index) in TOOL_GROUPS"
          :key="index"
        >
          <ToolbarSeparator
            v-if="index > 0"
            :class="css.markdownEditor_rule"
          />
          <Tooltip
            v-for="tool in group"
            :key="tool"
            :text="t(l[tool])"
          >
            <ToolbarButton
              :class="css.markdownEditor_tool"
              :aria-label="t(l[tool])"
              :disabled="disabled || readonly"
              @click="applyTool(tool)"
            >
              <component
                :is="TOOL_ICONS[tool]"
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
        @input="suggestions.update()"
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
      <FileText
        :class="css.markdownEditor_footerIcon"
        aria-hidden="true"
      />
      <span :class="css.markdownEditor_hint">{{ t(l.markdown) }}</span>
      <div :class="css.markdownEditor_actions">
        <slot name="footer" />
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

.markdownEditor_footerIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.markdownEditor_hint {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.markdownEditor_actions {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  margin-left: auto;
}
</style>
