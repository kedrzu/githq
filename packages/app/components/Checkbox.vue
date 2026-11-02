<!-- A checkbox with its label on nzyme's `useCheckbox` (a `role="checkbox"` button): bound by `v-model` or a form `field`; Space or a click on the box or the label toggles it. `indeterminate` shows a partly chosen group. `readonly` holds it still yet keeps the focus it has, where `disabled` drops it. -->
<script lang="ts" setup>
import { useCheckbox } from '@nzyme/vue-forms/components/useCheckbox.jsx';
import { Check, Minus } from 'lucide-vue-next';

// nzyme's checkbox props: `modelValue`/`field`, `errors`, `required`, `disabled`, `readonly`, `name`,
// `tabindex`, `indeterminate`; and the label.
defineProps({ ...useCheckbox.props, label: String });
defineEmits(useCheckbox.emits);
defineSlots<{
  /** A label richer than `label` ("kedrzu/**githq**"). */
  default?(): unknown;
}>();

const { Checkbox, field } = useCheckbox();
</script>

<template>
  <!-- The label wraps the box, so it names the checkbox and a click on it toggles it. -->
  <label :class="[css.checkbox, (disabled || readonly) && css.checkbox_disabled]">
    <Checkbox
      :class="[css.checkbox_box, (field.value || indeterminate) && css.checkbox_box_on]"
      :aria-readonly="readonly || undefined"
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
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;

  &:disabled,
  &[aria-readonly='true'] {
    opacity: 0.5;
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
</style>
