<!-- The add field of Workflow alerts, and the editor it turns into (`Workflow alerts / Pattern editor`, actions W11, W12): idle, "Add a branch or tag pattern, such as release/* or v*" with A; focused or holding text — or editing a pattern in place —, the input with the syntax and ↵ Save / Esc Cancel, and under it the preview, re-run on every keystroke: what it would alert on, and what changes in the sidebar ("Release turns broken: …", "No longer counted: …"). A pattern already listed says so. Enter asks to save and Escape to cancel; the caller decides. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleMinus, Plus } from 'lucide-vue-next';
import { computed, onMounted, ref, useTemplateRef } from 'vue';

import Kbd from '@/components/Kbd.vue';
import { formatAge } from '@/utils/formatAge.js';
import { formatList } from '@/utils/formatList.js';

import type { PatternEditPreview } from './buildWorkflowAlerts.js';
import * as l from './WorkflowPatternEditor.loc.js';
import WorkflowPatternMatches from './WorkflowPatternMatches.vue';

/** How many chips the preview shows before "+n": it has the card's width to itself. */
const CHIP_LIMIT = 4;

const props = defineProps<{
  /** `add`: the add field, idle until focused; `edit`: a pattern edited in place, focused as it shows. */
  mode: 'add' | 'edit';
  /** What saving what is typed would do. */
  preview: PatternEditPreview;
  /** githq has read the repository's runs. */
  read: boolean;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** The input's id, which an address can point to (`#workflow-alerts-add`). */
  inputId?: string;
}>();

const value = defineModel<string>({ required: true });

const emit = defineEmits<{
  /** Enter. */
  save: [];
  /** Escape. */
  cancel: [];
}>();

const t = useTranslate();
const input = useTemplateRef('input');
const focused = ref(false);

const active = computed(() => props.mode === 'edit' || focused.value || value.value !== '');
const effects = computed(() => {
  const { preview } = props;
  if (preview.kind !== 'preview') {
    return [];
  }

  const lines: { key: string; text: string; broken: boolean }[] = [];
  for (const entry of preview.turnBroken) {
    const text =
      entry.ref && entry.at !== null
        ? t(l.turnsBroken, {
            workflow: entry.workflow,
            ref: entry.ref.name,
            age: formatAge(entry.at, props.now),
          })
        : t(l.turnsBrokenNoRef, { workflow: entry.workflow });
    lines.push({ key: `broken:${entry.workflow}`, text, broken: true });
  }

  if (preview.stopCounting.length > 0) {
    const names = formatList(preview.stopCounting);
    lines.push({
      key: 'stopCounting',
      text: t(l.stopsCounting, { count: preview.stopCounting.length, names }),
      broken: false,
    });
  }

  if (preview.staysBroken.length > 0) {
    const names = formatList(preview.staysBroken);
    lines.push({
      key: 'staysBroken',
      text: t(l.staysBroken, { count: preview.staysBroken.length, names }),
      broken: true,
    });
  }

  if (preview.stopMatching.length > 0) {
    const refs = formatList(
      preview.stopMatching.map(entry => t(entry.kind === 'tag' ? l.theTag : l.theBranch, { name: entry.name })),
    );
    lines.push({ key: 'stopMatching', text: t(l.noLongerCounted, { refs }), broken: false });
  }

  return lines;
});

defineExpose({ focus, active });

onMounted(() => {
  if (props.mode === 'edit') {
    focus();
  }
});

/** Puts the cursor in the field, at the end of what is typed. */
function focus() {
  input.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault();
      emit('save');
      return;
    case 'Escape':
      event.preventDefault();
      emit('cancel');
  }
}
</script>

<template>
  <div :class="[css.workflowPatternEditor, active && css.workflowPatternEditor_active]">
    <label :class="css.workflowPatternEditor_field">
      <Plus
        v-if="!active"
        :class="css.workflowPatternEditor_plus"
        aria-hidden="true"
      />
      <input
        :id="inputId"
        ref="input"
        v-model="value"
        :class="css.workflowPatternEditor_input"
        :aria-label="t(l.label)"
        :placeholder="mode === 'add' ? t(l.placeholder) : undefined"
        autocomplete="off"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKeydown"
      />
      <template v-if="active">
        <span
          :class="css.workflowPatternEditor_syntax"
          aria-hidden="true"
          >{{ t(l.syntax) }}</span
        >
        <span
          :class="css.workflowPatternEditor_hints"
          aria-hidden="true"
        >
          <span :class="css.workflowPatternEditor_hint"><Kbd keys="Enter" />{{ t(l.save) }}</span>
          <span :class="css.workflowPatternEditor_hint"><Kbd keys="Escape" />{{ t(l.cancel) }}</span>
        </span>
      </template>
      <Kbd
        v-else
        keys="A"
      />
    </label>

    <div
      v-if="active && preview.kind !== 'empty'"
      :class="css.workflowPatternEditor_preview"
      aria-live="polite"
    >
      <p
        v-if="preview.kind === 'duplicate'"
        :class="css.workflowPatternEditor_duplicate"
      >
        {{ t(l.duplicate) }}
      </p>
      <template v-else>
        <WorkflowPatternMatches
          :matches="preview.matches"
          :read="read"
          :limit="CHIP_LIMIT"
        >
          <template #lead>
            <span :class="css.workflowPatternEditor_label">{{ t(l.wouldAlertOn) }}</span>
          </template>
        </WorkflowPatternMatches>
        <p
          v-for="line in effects"
          :key="line.key"
          :class="[css.workflowPatternEditor_effect, line.broken && css.workflowPatternEditor_effect_broken]"
        >
          <span
            v-if="line.broken"
            :class="css.workflowPatternEditor_marker"
            aria-hidden="true"
          />
          <CircleMinus
            v-else
            :class="css.workflowPatternEditor_icon"
            aria-hidden="true"
          />
          {{ line.text }}
        </p>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.workflowPatternEditor {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-10 $spacing-16;
  border-top: 1px solid $color-border;
}

.workflowPatternEditor_active {
  padding-bottom: $spacing-12;
  background: $color-sel;
}

.workflowPatternEditor_field {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-6 $spacing-8;
  cursor: text;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;

  .workflowPatternEditor_active & {
    border-color: $color-accent;
  }
}

.workflowPatternEditor_plus {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.workflowPatternEditor_input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font-size: $font-size-sm;
  color: $color-fg;
  background: none;
  border: none;
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
  }

  .workflowPatternEditor_active & {
    font-family: $font-family-mono;
  }
}

.workflowPatternEditor_syntax {
  flex: none;
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
  white-space: pre;
}

.workflowPatternEditor_hints {
  display: inline-flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  padding-left: $spacing-8;
}

.workflowPatternEditor_hint {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowPatternEditor_preview {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  padding: 0 $spacing-2;
}

.workflowPatternEditor_label {
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.workflowPatternEditor_duplicate {
  font-size: $font-size-xs;
  color: $color-amber;
}

.workflowPatternEditor_effect {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.workflowPatternEditor_effect_broken {
  color: $color-fg-2;
}

.workflowPatternEditor_marker {
  @include workflow-broken-marker;
}

.workflowPatternEditor_icon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
