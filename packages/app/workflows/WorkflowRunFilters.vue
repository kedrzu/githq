<!-- The filters of an opened workflow's runs (actions W43): Ref, Event, Status and Actor, each a chip opening a picker of the exact values GitHub filters on — the refs that count first, then the values of the runs loaded (`getWorkflowRunFilterChoices`) — and its "any" option, which clears it. A chip with a value set shows the value, outlined in the accent. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleDashed, GitBranch, User, Zap } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import Button from '@/components/Button.vue';
import Picker from '@/components/Picker.vue';
import type { PickerOption } from '@/components/Picker.vue';

import type { WorkflowRunFilterChoices } from './utils/getWorkflowRunFilterChoices.js';
import type { WorkflowRunFilters } from './WorkflowRunHistory.js';
import * as l from './WorkflowRunFilters.loc.js';

const props = defineProps<{
  filters: WorkflowRunFilters;
  choices: WorkflowRunFilterChoices;
  /** The refs that count, exactly named: marked among the ref's choices. */
  countedRefs: readonly string[];
}>();

const emit = defineEmits<{
  /** A filter set or cleared: every filter as it now is. */
  change: [filters: WorkflowRunFilters];
}>();

/** One filter's chip. */
interface FilterChip {
  readonly key: keyof WorkflowRunFilters;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly noneLabel: string;
  readonly placeholder: string;
  readonly options: readonly PickerOption[];
}

const t = useTranslate();
/** The chip whose picker is open; `null` with none. */
const opened = ref<keyof WorkflowRunFilters | null>(null);

const chips = computed((): FilterChip[] => [
  {
    key: 'ref',
    label: t(l.ref),
    icon: GitBranch,
    noneLabel: t(l.anyRef),
    placeholder: t(l.filterRefs),
    options: props.choices.refs.map(value => ({
      value,
      label: value,
      detail: props.countedRefs.includes(value) ? t(l.counted) : undefined,
    })),
  },
  {
    key: 'event',
    label: t(l.event),
    icon: Zap,
    noneLabel: t(l.anyEvent),
    placeholder: t(l.filterEvents),
    options: toOptions(props.choices.events),
  },
  {
    key: 'status',
    label: t(l.status),
    icon: CircleDashed,
    noneLabel: t(l.anyStatus),
    placeholder: t(l.filterStatuses),
    options: toOptions(props.choices.statuses),
  },
  {
    key: 'actor',
    label: t(l.actor),
    icon: User,
    noneLabel: t(l.anyActor),
    placeholder: t(l.filterActors),
    options: toOptions(props.choices.actors),
  },
]);

function toOptions(values: readonly string[]): PickerOption[] {
  return values.map(value => ({ value, label: value.replaceAll('_', ' ') }));
}

function selectedOf(key: keyof WorkflowRunFilters) {
  const value = props.filters[key];
  return value === null ? [] : [value];
}

function setOpen(key: keyof WorkflowRunFilters, open: boolean) {
  opened.value = open ? key : null;
}

function pick(key: keyof WorkflowRunFilters, value: string | null) {
  if (props.filters[key] !== value) {
    emit('change', { ...props.filters, [key]: value });
  }
}
</script>

<template>
  <div
    :class="css.workflowRunFilters"
    role="group"
    :aria-label="t(l.label)"
  >
    <Picker
      v-for="chip in chips"
      :key="chip.key"
      :open="opened === chip.key"
      :label="chip.label"
      :options="chip.options"
      :selected="selectedOf(chip.key)"
      :none-label="chip.noneLabel"
      :placeholder="chip.placeholder"
      @update:open="setOpen(chip.key, $event)"
      @pick="pick(chip.key, $event)"
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="chip.icon"
          :class="[css.workflowRunFilters_chip, filters[chip.key] !== null && css.workflowRunFilters_chip_active]"
          :aria-label="filters[chip.key] === null ? undefined : `${chip.label}: ${filters[chip.key]}`"
        >
          <span :class="filters[chip.key] !== null && chip.key === 'ref' && css.workflowRunFilters_value_mono">{{
            filters[chip.key] ?? chip.label
          }}</span>
        </Button>
      </template>
    </Picker>
  </div>
</template>

<style lang="scss" module="css">
.workflowRunFilters {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
}

.workflowRunFilters_chip.workflowRunFilters_chip_active {
  color: $color-fg;
  border-color: $color-accent;
}

.workflowRunFilters_value_mono {
  font-family: $font-family-mono;
}
</style>
