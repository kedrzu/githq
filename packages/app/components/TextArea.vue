<!-- A labelled multi-line text field on nzyme's `useTextArea`, growing with its text: bound by `v-model` or a form `field`, with its errors and a hint under it. For a comment or an issue's body; `compact` starts one line high (a comment box), `bare` draws no box (a new issue's body), and `kbd` draws a keyboard hint inside it, at its end. -->
<script lang="ts" setup>
import { useTextArea } from '@nzyme/vue-forms/components/useTextArea.jsx';

import FormField from './FormField.vue';
import Kbd from './Kbd.vue';

// nzyme's text area props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `label`, `name`,
// `placeholder`, `tabindex`; the hint under it, a label read out only, one line high until it holds more, and a
// keyboard hint drawn inside (only drawn: give the shortcut to `aria-keyshortcuts` too).
defineProps({ ...useTextArea.props, info: String, labelHidden: Boolean, compact: Boolean, bare: Boolean, kbd: String });
defineEmits(useTextArea.emits);

const { TextArea, field, input } = useTextArea();

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
      <div
        :class="[css.textArea, compact && css.textArea_compact, bare && css.textArea_bare, kbd && css.textArea_withKbd]"
      >
        <TextArea v-bind="inputAttrs" />
        <Kbd
          v-if="kbd"
          :class="css.textArea_kbd"
          :keys="kbd"
        />
      </div>
    </template>
  </FormField>
</template>

<style lang="scss" module="css">
.textArea {
  position: relative;
}

// Over `FormField`'s look of the text area, hence the doubled class.
.textArea.textArea_compact textarea {
  min-height: 32px;
}

.textArea.textArea_bare textarea {
  min-height: 200px;
  padding: 0;
  background: none;
  border: none;
}

.textArea.textArea_withKbd textarea {
  padding-right: 40px;
}

.textArea_kbd {
  position: absolute;
  top: 8px;
  right: 10px;
  pointer-events: none;
}
</style>
