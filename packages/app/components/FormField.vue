<!-- The frame of a form field: the label naming the input, the input from the slot, its errors — red, announced when they appear, and describing the input — and a hint under it. The inputs (`TextField`, `PasswordField`, `TextArea`) put their nzyme field controller in. -->
<script lang="ts">
/** What the frame puts on the field's input: the label's target id, the error state and the descriptions. */
export interface FormFieldInputAttrs {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}
</script>

<script lang="ts" setup>
import type { FormFieldController } from '@nzyme/vue-forms/components/defineFormField.js';
import { computed, useId } from 'vue';

const props = defineProps<{
  label?: string;
  /** The label is read out only: the field speaks for itself (a comment box with its placeholder). */
  labelHidden?: boolean;
  /** The input's nzyme field: its errors (validation, or given through `errors`) show here. */
  field: FormFieldController<unknown>;
  /** A hint under the field, also its description. */
  info?: string;
}>();

defineSlots<{
  /** The input; bind `inputAttrs` to it. */
  default(props: { inputAttrs: FormFieldInputAttrs }): unknown;
}>();

const id = useId();
const errorsId = `${id}-errors`;
const infoId = `${id}-info`;

const hasErrors = computed(() => props.field.errors.length > 0);
const inputAttrs = computed((): FormFieldInputAttrs => ({
  id: `${id}-input`,
  'aria-invalid': hasErrors.value || undefined,
  'aria-describedby': [hasErrors.value && errorsId, props.info && infoId].filter(Boolean).join(' ') || undefined,
}));
</script>

<template>
  <div :class="[css.formField, hasErrors && css.formField_invalid]">
    <label
      v-if="label"
      :for="inputAttrs.id"
      :class="[css.formField_label, labelHidden && css.formField_label_hidden]"
      >{{ label }}</label
    >
    <slot :input-attrs="inputAttrs" />
    <div
      v-if="hasErrors"
      :id="errorsId"
      :class="css.formField_errors"
    >
      <p
        v-for="(error, index) in field.errors"
        :key="index"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <p
      v-if="info"
      :id="infoId"
      :class="css.formField_info"
    >
      {{ info }}
    </p>
  </div>
</template>

<style lang="scss" module="css">
.formField {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  width: 100%;
  font-size: $font-size-sm;

  input,
  textarea {
    width: 100%;
    padding: $spacing-6 $spacing-8;
    font-family: inherit;
    font-size: $font-size-md;
    line-height: 18px;
    color: $color-fg;
    // The app is dark: the browser's own parts (a date input's calendar button) too.
    color-scheme: dark;
    background: $color-bg;
    border: 1px solid $color-border-2;
    border-radius: $radius-md;
    outline: none;

    &::placeholder {
      color: $color-fg-dim;
      opacity: 1;
    }

    &:focus-visible {
      border-color: $color-focus;
    }

    &:disabled {
      color: $color-fg-dim;
      cursor: default;
    }
  }

  // nzyme's `useTextArea` sets the height to the text's as it changes; this is its smallest.
  textarea {
    min-height: 64px;
    overflow: hidden;
    resize: none;
  }
}

.formField_invalid {
  input,
  textarea {
    border-color: $color-red;
  }
}

.formField_label_hidden {
  @include visually-hidden;
}

.formField_label {
  color: $color-fg-2;
}

.formField_errors {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  color: $color-red;
}

.formField_info {
  color: $color-fg-dim;
}
</style>
