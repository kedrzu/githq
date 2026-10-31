<!-- A labelled one-line text field on nzyme's `useTextInput`: bound by `v-model` or a form `field` (whose validators run as it is edited), with its errors and a hint under it. `bare` draws no box — the input is the line it sits on (a quick capture's title). -->
<script lang="ts" setup>
import { useTextInput } from '@nzyme/vue-forms/components/useTextInput.jsx';

import FormField from './FormField.vue';

// nzyme's text input props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `label`,
// `name`, `autocomplete`, `placeholder`, `tabindex`; the hint under it, a label read out only, and no box.
defineProps({ ...useTextInput.props, info: String, labelHidden: Boolean, bare: Boolean });
defineEmits(useTextInput.emits);

const { TextInput, field, input } = useTextInput();

defineExpose({
  /** Puts the cursor in the field. */
  focus: () => input.value?.focus(),
});
</script>

<template>
  <FormField
    :field="field"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
  >
    <template #default="{ inputAttrs }">
      <TextInput
        v-bind="inputAttrs"
        :class="bare && css.textField_bare"
      />
    </template>
  </FormField>
</template>

<style lang="scss" module="css">
// Over `FormField`'s look of the input, hence the doubled class.
.textField_bare.textField_bare {
  padding: 0;
  font-size: $font-size-lg;
  background: none;
  border: none;
}
</style>
