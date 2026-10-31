<!-- A labelled secret field (a token) on nzyme's `usePasswordInput`, masked and in a monospace font: bound by `v-model` or a form `field`, with its errors and a hint under it. -->
<script lang="ts" setup>
import { usePasswordInput } from '@nzyme/vue-forms/components/usePasswordInput.jsx';

import FormField from './FormField.vue';

// nzyme's password input props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `label`,
// `placeholder`, `tabindex`; and the hint under it.
defineProps({ ...usePasswordInput.props, info: String });
defineEmits(usePasswordInput.emits);

const { PasswordInput, field } = usePasswordInput();
</script>

<template>
  <FormField
    :field="field"
    :label="label"
    :info="info"
  >
    <template #default="{ inputAttrs }">
      <PasswordInput
        v-bind="inputAttrs"
        :class="css.passwordField_input"
        spellcheck="false"
      />
    </template>
  </FormField>
</template>

<style lang="scss" module="css">
.passwordField_input {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}
</style>
