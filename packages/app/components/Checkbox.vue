<!-- A checkbox with its label on nzyme's `useCheckbox` (a `role="checkbox"` button): bound by `v-model` or a form `field`; Space or a click on the box or the label toggles it. `indeterminate` shows a partly chosen group. `readonly` holds it still yet keeps the focus it has, where `disabled` drops it. Without a label of its own it is named by what `labelledby` points at (a list's row it checks). `size="touch"`: the phone's larger box beside a row a finger's height (mobile MB135). -->
<script lang="ts" setup>
import { useCheckbox } from '@nzyme/vue-forms/components/useCheckbox.jsx';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import { Check, Minus } from 'lucide-vue-next';

// nzyme's checkbox props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `name`,
// `tabindex`, `indeterminate`; the label, or the id of what names it; the phone's larger box.
defineProps({ ...useCheckbox.props, label: String, labelledby: String, size: defineProp<'touch'>() });
defineEmits(useCheckbox.emits);
defineSlots<{
  /** A label richer than `label` ("kedrzu/**githq**"). */
  default?(): unknown;
}>();

const { Checkbox, field } = useCheckbox();
</script>

<template>
  <!-- The label wraps the box, so it names the checkbox and a click on it toggles it. -->
  <label
    :class="[css.checkbox, (disabled || readonly) && css.checkbox_disabled, size === 'touch' && css.checkbox_touch]"
  >
    <Checkbox
      :class="[css.checkbox_box, (field.value || indeterminate) && css.checkbox_box_on]"
      :aria-readonly="readonly || undefined"
      :aria-labelledby="labelledby"
    >
      <Check
        v-if="field.value"
        :class="css.checkbox_mark"
        aria-hidden="true"
      />
      <Minus
        v-else-if="indeterminate"
        :class="css.checkbox_mark"
        aria-hidden="true"
      />
    </Checkbox>
    <span
      v-if="label || $slots.default"
      :class="css.checkbox_label"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<style lang="scss" module="css">
.checkbox {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-md;
  color: $color-fg;
  cursor: pointer;
}

.checkbox_disabled {
  color: $color-fg-dim;
  cursor: default;
}

.checkbox_box {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  color: $color-on-light;
  cursor: inherit;
  background: none;
  border: 1px solid $color-control-border;
  border-radius: $radius-sm;

  &:disabled {
    opacity: 0.5;
  }

  // Held still, not disabled: a grey box the eye can still read, ticked or not (D30).
  &[aria-readonly='true'] {
    color: $color-fg-3;
    background: $color-bg-3;
    border-color: $color-control-border;
  }
}

.checkbox_box_on {
  background: $color-accent;
  border-color: $color-accent;
}

.checkbox_mark {
  width: 12px;
  height: 12px;
  stroke-width: 3;
}

.checkbox_label {
  min-width: 0;
}

// A phone's row (mobile MB135): a box a thumb finds, the label further from it.
.checkbox_touch {
  gap: $spacing-12;

  .checkbox_box {
    width: 20px;
    height: 20px;
    border-radius: 5px;
  }

  .checkbox_mark {
    width: 14px;
    height: 14px;
  }
}
</style>
