<!-- An action's form in the command menu, in place of its list (W37, `Workflow / Dispatch field`): the way there over it, then a row per field — its name monospaced with its type under it, the control (a text or number field, a select, a switch with its value word), a quiet hint after it — and a line saying why it can't run where it can't. Tab and ⇧Tab move between the fields, ↵ in a text field moves to the next one, ⌘↵ submits from anywhere (the footer's button too, unavailable while a required field is empty), Esc steps back (the menu's). What was entered is the caller's (`v-model:values`), so it outlives the form. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronsUpDown } from 'lucide-vue-next';
import { computed, onMounted, useId, useTemplateRef } from 'vue';

import Button from '@/components/Button.vue';
import Kbd from '@/components/Kbd.vue';
import Switch from '@/components/Switch.vue';

import * as l from './CommandForm.loc.js';
import type { CommandForm, CommandFormField, CommandFormValue, CommandFormValues } from './CommandTypes.js';
import { formatAriaKeyShortcuts } from './formatAriaKeyShortcuts.js';
import { matchesCommandKey } from './matchesCommandKey.js';

const props = defineProps<{
  form: CommandForm;
  /** The form's name, for assistive technology: the action's title. */
  label: string;
}>();

const emit = defineEmits<{
  /** Every field shown, with its value or its default. */
  submit: [values: CommandFormValues];
}>();

defineSlots<{
  /** The way there, over the form. */
  crumbs(): unknown;
}>();

/** What was entered, by field name; a field not touched is not there. */
const values = defineModel<CommandFormValues>('values', { required: true });

const SUBMIT_KEY = 'Mod+Enter';

const t = useTranslate();
const id = useId();
const rootRef = useTemplateRef<HTMLElement>('root');

const ready = computed(
  () =>
    props.form.message === undefined && props.form.fields.every(field => !field.required || isFilled(readValue(field))),
);

onMounted(() => {
  const target = getControls()[0] ?? rootRef.value;
  target?.focus();
});

function readValue(field: CommandFormField): CommandFormValue {
  const value = values.value[field.name];
  switch (field.kind) {
    case 'text':
      return typeof value === 'string' ? value : (field.default ?? '');
    case 'number':
      return typeof value === 'number' || (value === null && Object.hasOwn(values.value, field.name))
        ? value
        : (field.default ?? null);
    case 'choice':
      // A value no longer offered (another ref's options) gives way to the default.
      return typeof value === 'string' && field.options.includes(value)
        ? value
        : (field.default ?? field.options[0] ?? '');
    case 'boolean':
      return typeof value === 'boolean' ? value : (field.default ?? false);
    default:
      return assertNever(field);
  }
}

function readText(field: CommandFormField) {
  const value = readValue(field);
  return value === null ? '' : String(value);
}

function getDescribedBy(field: CommandFormField) {
  const ids = [field.detail && `${id}-${field.name}-detail`, field.hint && `${id}-${field.name}-hint`];
  return ids.filter(Boolean).join(' ') || undefined;
}

function isFilled(value: CommandFormValue) {
  return value !== null && value !== '';
}

function setValue(field: CommandFormField, value: CommandFormValue) {
  values.value = { ...values.value, [field.name]: value };
}

function onInput(field: CommandFormField, event: Event) {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
    return;
  }

  if (event.target instanceof HTMLInputElement && field.kind === 'number') {
    const number = event.target.valueAsNumber;
    setValue(field, Number.isNaN(number) ? null : number);
  } else {
    setValue(field, event.target.value);
  }
}

function submit() {
  if (!ready.value) {
    return;
  }

  const entered: Record<string, CommandFormValue> = {};
  for (const field of props.form.fields) {
    entered[field.name] = readValue(field);
  }

  emit('submit', entered);
}

/** ⌘↵ submits from any field; ↵ in a text field moves to the next field, never submitting. */
function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  if (matchesCommandKey(event, SUBMIT_KEY)) {
    event.preventDefault();
    submit();
  } else if (matchesCommandKey(event, 'Enter') && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    const controls = getControls();
    controls[controls.indexOf(event.target) + 1]?.focus();
  }
}

function getControls() {
  return Array.from(rootRef.value?.querySelectorAll<HTMLElement>('[data-control]') ?? []);
}
</script>

<template>
  <div
    ref="root"
    role="group"
    :aria-label="label"
    :class="css.commandForm"
    tabindex="-1"
    @keydown="onKeydown"
  >
    <div :class="css.commandForm_crumbs">
      <slot name="crumbs" />
    </div>
    <div :class="css.commandForm_body">
      <p
        v-if="form.heading"
        :class="css.commandForm_heading"
      >
        {{ form.heading }}
      </p>
      <div
        v-for="field in form.fields"
        :key="field.name"
        :class="css.commandForm_row"
      >
        <div :class="css.commandForm_name">
          <label
            :for="`${id}-${field.name}`"
            :class="css.commandForm_label"
            >{{ field.label ?? field.name }}</label
          >
          <span
            v-if="field.detail"
            :id="`${id}-${field.name}-detail`"
            :class="css.commandForm_detail"
            >{{ field.detail }}</span
          >
        </div>
        <label
          v-if="field.kind === 'boolean'"
          :class="[css.commandForm_control, css.commandForm_toggle]"
        >
          <span aria-hidden="true">{{ readValue(field) ? t(l.on) : t(l.off) }}</span>
          <Switch
            :id="`${id}-${field.name}`"
            :model-value="readValue(field) === true"
            :label="field.label ?? field.name"
            :aria-describedby="getDescribedBy(field)"
            data-control
            @update:model-value="setValue(field, $event)"
          />
        </label>
        <span
          v-else-if="field.kind === 'choice'"
          :class="css.commandForm_select"
        >
          <select
            :id="`${id}-${field.name}`"
            :class="css.commandForm_control"
            :value="readValue(field)"
            :aria-describedby="getDescribedBy(field)"
            data-control
            @change="onInput(field, $event)"
          >
            <option
              v-for="option in field.options"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
          <ChevronsUpDown
            :class="css.commandForm_selectIcon"
            aria-hidden="true"
          />
        </span>
        <input
          v-else
          :id="`${id}-${field.name}`"
          :class="css.commandForm_control"
          :type="field.kind === 'number' ? 'number' : 'text'"
          :value="readText(field)"
          :required="field.required"
          :aria-describedby="getDescribedBy(field)"
          autocomplete="off"
          spellcheck="false"
          data-control
          @input="onInput(field, $event)"
        />
        <span
          :id="`${id}-${field.name}-hint`"
          :class="css.commandForm_hint"
          >{{ field.hint }}</span
        >
      </div>
      <p
        v-if="form.message !== undefined"
        :class="css.commandForm_message"
        role="status"
      >
        {{ form.message }}
      </p>
    </div>
    <footer :class="css.commandForm_footer">
      <span
        :class="css.commandForm_key"
        aria-hidden="true"
        ><Kbd keys="Tab" />{{ t(l.next) }}</span
      >
      <Button
        variant="ghost"
        size="sm"
        :kbd="SUBMIT_KEY"
        :keyshortcuts="formatAriaKeyShortcuts(SUBMIT_KEY)"
        :unavailable="!ready"
        @click="submit"
      >
        {{ form.submitLabel }}
      </Button>
      <span
        :class="css.commandForm_key"
        aria-hidden="true"
        ><Kbd keys="Escape" />{{ t(l.back) }}</span
      >
      <span :class="css.commandForm_spacer" />
      <span v-if="form.hint">{{ form.hint }}</span>
    </footer>
  </div>
</template>

<style lang="scss" module="css">
.commandForm {
  display: flex;
  flex-direction: column;
  min-height: 0;
  outline: none;
}

.commandForm_crumbs {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-12 14px;
  border-bottom: 1px solid $color-border;
}

.commandForm_body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: $spacing-6;
  overflow-y: auto;
}

.commandForm_heading {
  padding: $spacing-10 $spacing-10 $spacing-4;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commandForm_message {
  padding: $spacing-8 $spacing-10;
  font-size: $font-size-sm;
  color: $color-amber;
}

.commandForm_row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr) 136px;
  gap: $spacing-12;
  align-items: center;
  padding: $spacing-7 $spacing-10;
  border-radius: 7px;

  &:focus-within {
    background: $color-sel;
  }
}

.commandForm_name {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.commandForm_label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  font-size: $font-size-md;
  color: $color-fg;
  white-space: nowrap;
}

.commandForm_detail {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commandForm_control {
  width: 100%;
  min-height: 32px;
  padding: $spacing-6 $spacing-10;
  font-family: inherit;
  font-size: $font-size-md;
  color: $color-fg;
  color-scheme: dark;
  background: $color-bg;
  border: 1px solid $color-control-border;
  border-radius: $radius-md;
  outline: none;

  &:focus-visible,
  &:focus-within {
    border-color: $color-focus;
  }
}

.commandForm_select {
  position: relative;
  display: flex;

  select {
    padding-right: $spacing-32;
    cursor: pointer;
    appearance: none;
  }
}

.commandForm_selectIcon {
  position: absolute;
  top: 50%;
  right: $spacing-10;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
  pointer-events: none;
  transform: translateY(-50%);
}

.commandForm_toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.commandForm_hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.commandForm_footer {
  display: flex;
  flex: none;
  gap: 14px;
  align-items: center;
  padding: $spacing-8 14px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.commandForm_key {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
}

.commandForm_spacer {
  flex: 1;
}
</style>
