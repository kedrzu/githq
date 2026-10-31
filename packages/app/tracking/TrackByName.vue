<!-- Tracking someone else's repository or project by its name or address (G10, G8): `owner/repository`, or a project's URL. Enter or "Track" looks it up on GitHub; what is found is handed on, and what is not says why under the field. -->
<script lang="ts" setup>
import { Form } from '@nzyme/vue-forms/components/Form.jsx';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Plus } from 'lucide-vue-next';
import { ref } from 'vue';

import Button from '@/components/Button.vue';
import SearchField from '@/components/SearchField.vue';

import * as l from './TrackByName.loc.js';
import type { CandidateProject, CandidateRepository } from './TrackingTypes.js';
import { parseTrackingReference } from './utils/parseTrackingReference.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

const props = defineProps<{
  /** Looks up what the user named; `null` when GitHub shows them nothing there. */
  find: (reference: TrackingReference) => Promise<CandidateRepository | CandidateProject | null>;
}>();

const emit = defineEmits<{
  found: [candidate: CandidateRepository | CandidateProject];
}>();

const EXAMPLES = ['vitejs/vite', 'github.com/orgs/tauri-apps/projects/2'];

const t = useTranslate();

const text = ref('');
const problem = ref<string | null>(null);

async function track() {
  const reference = parseTrackingReference(text.value);
  if (!reference) {
    problem.value = t(l.notAReference);
    return;
  }

  const found = await props.find(reference);
  if (!found) {
    problem.value = t(l.notFound);
    return;
  }

  problem.value = null;
  text.value = '';
  emit('found', found);
}
</script>

<template>
  <Form
    :class="css.trackByName"
    @submit="track"
  >
    <SearchField
      v-model="text"
      :class="css.trackByName_field"
      :label="t(l.label)"
      :placeholder="t(l.placeholder)"
      :icon="Plus"
      @update:model-value="problem = null"
    >
      <template #end>
        <Button
          type="submit"
          size="sm"
        >
          {{ t(l.track) }}
        </Button>
      </template>
    </SearchField>
    <p
      v-if="problem"
      :class="css.trackByName_problem"
      role="alert"
    >
      {{ problem }}
    </p>
    <p
      v-else
      :class="css.trackByName_examples"
    >
      {{ t(l.examples) }}
      <code
        v-for="example in EXAMPLES"
        :key="example"
        :class="css.trackByName_example"
        >{{ example }}</code
      >
    </p>
  </Form>
</template>

<style lang="scss" module="css">
.trackByName {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.trackByName_field {
  padding: 5px 6px 5px 12px;
  background: $color-bg-2;
  border-radius: $radius-lg;
}

.trackByName_examples {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackByName_example {
  padding: 2px $spacing-6;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  background: $color-bg-3;
  border-radius: $radius-sm;
}

.trackByName_problem {
  font-size: $font-size-xs;
  color: $color-amber;
}
</style>
