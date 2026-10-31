<!-- A labelled number field on nzyme's `useNumberInput`: bound by `v-model` or a form `field`, with its errors and a hint under it. Emptied, it holds `null` — nothing, rather than 0. -->
<script lang="ts" setup>
import { useNumberInput } from '@nzyme/vue-forms/components/useNumberInput.jsx';

import FormField from './FormField.vue';

// nzyme's number input props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `label`,
// `autocomplete`, `placeholder`, `tabindex`; the hint under it, a label read out only, and the bounds and step of
// the browser's arrows.
defineProps({
  ...useNumberInput.props,
  info: String,
  labelHidden: Boolean,
  min: Number,
  max: Number,
  step: Number,
});
defineEmits(useNumberInput.emits);

const { NumberInput, field } = useNumberInput();

// nzyme's own reading takes an emptied field — or one half typed, "-" — for 0 and writes it back into it.
function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    field.value = event.target.value === '' ? null : event.target.valueAsNumber;
  }
}
</script>

<template>
  <FormField
    :field="field"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
  >
    <template #default="{ inputAttrs }">
      <NumberInput
        v-bind="inputAttrs"
        :min="min"
        :max="max"
        :step="step"
        @input="onInput"
      />
    </template>
  </FormField>
</template>
