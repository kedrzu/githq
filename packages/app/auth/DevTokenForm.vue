<!-- Development only: signing in with a pasted GitHub token (`gh auth token`) instead of the OAuth flow, which needs the OAuth App's secret. Never in the production build: the sign-in page imports it only under `nuxt dev` and in the local build (`build:local`). -->
<script lang="ts" setup>
import { Form } from '@nzyme/vue-forms/components/Form.jsx';
import { useForm } from '@nzyme/vue-forms/useForm.js';
import { useFormFields } from '@nzyme/vue-forms/useFormFields.js';
import { requiredValidator } from '@nzyme/vue-forms/validators/requiredValidator.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useEmitAsync } from '@nzyme/vue-utils/useEmitAsync.js';
import { ref } from 'vue';

import Button from '@/components/Button.vue';
import PasswordField from '@/components/PasswordField.vue';

import * as l from './DevTokenForm.loc.js';

defineEmits<{
  /** The token; the form stays busy while a returned promise runs, and says so when it rejects. */
  signIn: [token: string];
}>();

const emitAsync = useEmitAsync<{ signIn: [token: string] }>();
const t = useTranslate();

const form = useForm({ token: '' });
const fields = useFormFields(form, {
  token: [requiredValidator()],
});
const failed = ref(false);

async function onSubmit() {
  if (!(await form.validate())) {
    return;
  }

  failed.value = false;
  try {
    await emitAsync('signIn', form.value.token.trim());
  } catch {
    failed.value = true;
  }
}
</script>

<template>
  <details :class="css.devTokenForm">
    <summary :class="css.devTokenForm_summary">{{ t(l.title) }}</summary>
    <Form
      :class="css.devTokenForm_form"
      :pending-class="css.devTokenForm_pending"
      @submit="onSubmit"
    >
      <p :class="css.devTokenForm_hint">{{ t(l.hint) }}</p>
      <PasswordField
        :field="fields.token"
        :label="t(l.token)"
        required
      />
      <p
        v-if="failed"
        :class="css.devTokenForm_failed"
        role="alert"
      >
        {{ t(l.failed) }}
      </p>
      <Button type="submit">{{ t(l.signIn) }}</Button>
    </Form>
  </details>
</template>

<style lang="scss" module="css">
.devTokenForm {
  font-size: $font-size-sm;
  color: $color-fg-2;
  border: 1px dashed $color-border-2;
  border-radius: $radius-lg;
}

.devTokenForm_summary {
  @include focus-ring;

  padding: $spacing-8 $spacing-12;
  cursor: pointer;
}

.devTokenForm_form {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  align-items: flex-start;
  padding: 0 $spacing-12 $spacing-12;
}

.devTokenForm_hint {
  color: $color-fg-dim;
}

.devTokenForm_failed {
  color: $color-red;
}

// While the token is checked: `Form` makes the form inert, so nothing in it can be used again meanwhile.
.devTokenForm_pending {
  cursor: progress;
}
</style>
