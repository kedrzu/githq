<!-- A labelled date field on nzyme's `useDateInput` (the browser's date input): bound by `v-model` or a form `field` to a `Date` at local midnight of the day picked, `null` when emptied, with its errors and a hint under it. -->
<script lang="ts" setup>
import { useDateInput } from '@nzyme/vue-forms/components/useDateInput.jsx';

import FormField from './FormField.vue';

// nzyme's date input props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `label`, `name`,
// `autocomplete`, `placeholder`, `tabindex`, `min`, `max`; the hint under it, and a label read out only.
defineProps({ ...useDateInput.props, info: String, labelHidden: Boolean });
defineEmits(useDateInput.emits);

const { DateInput, field, input } = useDateInput();

defineExpose({
  /** Puts the cursor in the field. */
  focus: () => input.value?.focus(),
});

// nzyme reads the day picked as UTC midnight but shows the field's date in local time — a day early west of
// UTC. The day is read as local midnight here, as it is shown.
function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    field.value = event.target.value === '' ? null : new Date(`${event.target.value}T00:00`);
  }
}

// nzyme opens the browser's calendar on focus; here it opens from the field's own calendar button, as any date
// input's does, and the keyboard types the date.
function onFocus(event: FocusEvent) {
  field.inputAttrs.onFocus(event);
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
      <DateInput
        v-bind="inputAttrs"
        @input="onInput"
        @focus="onFocus"
      />
    </template>
  </FormField>
</template>
