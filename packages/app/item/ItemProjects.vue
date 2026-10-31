<!-- The projects an opened item is in (D12: the item view shows all of them), each a card with every field of the project and the item's value of it: a single-select with its colour dot, an iteration with "current" while it runs, text, number, date. Until the detail arrives, the row's "Status" of each stands in. Where the user may write to the project, a field's value opens its editor — a picker of the options or iterations, a field for text, a number or a date — and the first project's status, priority and iteration have their keys (`S`, `P`, `I`). "Add to project" offers the projects the user can write to. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { Form } from '@nzyme/vue-forms/components/Form.jsx';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Plus, SquareKanban } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Button from '@/components/Button.vue';
import DateField from '@/components/DateField.vue';
import NumberField from '@/components/NumberField.vue';
import Picker from '@/components/Picker.vue';
import type { PickerOption } from '@/components/Picker.vue';
import Popover from '@/components/Popover.vue';
import PropertyRow from '@/components/PropertyRow.vue';
import PropertyValueButton from '@/components/PropertyValueButton.vue';
import TextField from '@/components/TextField.vue';
import type { EditRequest, ProjectFieldInput } from '@/edits/EditTypes.js';
import { getProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import type { ProjectFieldRole } from '@/edits/getProjectFieldRole.js';
import { getPickedValueId, toPickedInput } from '@/edits/projectFieldValues.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ViewerProject } from '@/repos/RepositoryTypes.js';
import type { ItemDetailProject, ProjectField, ProjectFieldValue } from '@/store/ItemDetailTypes.js';
import type { ItemProject } from '@/store/ItemTypes.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { isCurrentIteration } from '@/utils/isCurrentIteration.js';

import * as l from './ItemProjects.loc.js';

const props = defineProps<{
  /** The row's projects, with their "Status" only. */
  projects: readonly ItemProject[];
  /** The detail's projects, with every field; `null` until read. */
  detailProjects?: readonly ItemDetailProject[] | null;
  /** Epoch ms: which iteration is current. */
  now: number;
  /** Fields are edited where the project allows it; without this nothing is. */
  editable?: boolean;
  /** Projects can be added; `viewerProjects` are the ones offered, `null` until read. */
  canAddToProject?: boolean;
  viewerProjects?: readonly ViewerProject[] | null;
}>();

const emit = defineEmits<{
  edit: [request: EditRequest];
  /** "Add to project" opened: the projects to offer are wanted. */
  needProjects: [];
}>();

interface FieldLine {
  key: string;
  name: string;
  /** The value's text; `null` when empty. */
  text: string | null;
  /** A select option's colour, hex without `#`. */
  color: string | null;
  /** The key that edits it. */
  kbd?: string;
  /** How it is edited; `null` when it is not. */
  editor: FieldEditor | null;
}

type FieldEditor =
  | {
      kind: 'picker';
      /** What the picked option is. */
      picks: 'iteration' | 'singleSelect';
      projectItemId: string;
      fieldId: string;
      options: PickerOption[];
      selected: string | null;
    }
  | { kind: 'input'; projectItemId: string; fieldId: string; type: 'date' | 'number' | 'text'; value: string };

interface ProjectCard {
  key: string;
  title: string;
  fields: FieldLine[];
}

const t = useTranslate();
const pickerOptions = usePickerOptions();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const dates = new Intl.DateTimeFormat(APP_LANGUAGE, { dateStyle: 'medium', timeZone: 'UTC' });

/** The field whose editor is open, by its line's key. */
const opened = ref<string | null>(null);
/** What is typed in the open text, number or date field, as its value is written for GitHub. */
const draft = ref('');
const numberDraft = computed({
  get: () => (draft.value === '' ? null : Number(draft.value)),
  set: (value: number | null | undefined) => {
    draft.value = value == null || Number.isNaN(value) ? '' : String(value);
  },
});
// A date field's day is local midnight of it; GitHub's is the ISO date.
const dateDraft = computed({
  get: () => (draft.value === '' ? null : new Date(`${draft.value}T00:00`)),
  set: (value: Date | null | undefined) => {
    draft.value = value ? formatIsoDate(value) : '';
  },
});
const adding = ref(false);

const cards = computed((): ProjectCard[] => {
  const { detailProjects } = props;
  if (detailProjects) {
    return detailProjects.map((project, index) => ({
      key: project.itemId,
      title: project.title,
      fields: project.fields.map(field =>
        describe(project, field, project.values[field.id], index === 0 && props.editable && project.viewerCanUpdate),
      ),
    }));
  }

  return props.projects.map(project => ({
    key: project.itemId,
    title: project.title,
    fields: project.status
      ? [
          {
            key: 'status',
            name: t(l.status),
            text: project.status.name,
            color: getGitHubColor(project.status.color),
            editor: null,
          },
        ]
      : [],
  }));
});

const addable = computed((): PickerOption[] => {
  const inProjects = new Set(props.projects.map(project => project.projectId));
  return (props.viewerProjects ?? [])
    .filter(project => !project.closed && !inProjects.has(project.id))
    .map(project => ({ value: project.id, label: project.title, detail: project.owner }));
});

defineExpose({
  /** Opens the editor of the first project's status, priority or iteration; `false` when it has none to edit. */
  openByRole,
});

function describe(
  project: ItemDetailProject,
  field: ProjectField,
  value: ProjectFieldValue | undefined,
  first: boolean,
): FieldLine {
  const line: FieldLine = {
    key: `${project.itemId}:${field.id}`,
    name: field.name,
    text: null,
    color: null,
    kbd: first ? getEditKey(field) : undefined,
    editor: props.editable && project.viewerCanUpdate ? getEditor(project, field, value) : null,
  };
  if (!line.editor) {
    line.kbd = undefined;
  }

  if (!value) {
    return line;
  }

  switch (value.kind) {
    case 'text':
      return { ...line, text: value.text };
    case 'number':
      return { ...line, text: numbers.format(value.number) };
    case 'date':
      return { ...line, text: dates.format(Date.parse(value.date)) };
    case 'singleSelect':
      return { ...line, text: value.name, color: getGitHubColor(value.color) };
    case 'multiSelect':
      return { ...line, text: value.options.map(option => option.name).join(', ') };
    case 'iteration':
      return {
        ...line,
        text: isCurrentIteration(value, props.now) ? t(l.current, { title: value.title }) : value.title,
      };
    default:
      return assertNever(value);
  }
}

function getEditor(
  project: ItemDetailProject,
  field: ProjectField,
  value: ProjectFieldValue | undefined,
): FieldEditor | null {
  const target = { projectItemId: project.itemId, fieldId: field.id };
  switch (field.kind) {
    case 'singleSelect':
    case 'iteration':
      return {
        kind: 'picker',
        picks: field.kind,
        ...target,
        options: pickerOptions.projectField(field, props.now),
        selected: getPickedValueId(value),
      };
    case 'text':
      return { kind: 'input', ...target, type: 'text', value: value?.kind === 'text' ? value.text : '' };
    case 'number':
      return {
        kind: 'input',
        ...target,
        type: 'number',
        value: value?.kind === 'number' ? String(value.number) : '',
      };
    case 'date':
      return { kind: 'input', ...target, type: 'date', value: value?.kind === 'date' ? value.date.slice(0, 10) : '' };
    case 'multiSelect':
      return null;
    default:
      return assertNever(field);
  }
}

// The keys of the first project's status, priority and iteration.
function getEditKey(field: ProjectField) {
  const role = getProjectFieldRole(field);
  return role ? EDIT_KEYS[role] : undefined;
}

function openByRole(role: ProjectFieldRole) {
  const line = cards.value[0]?.fields.find(field => field.kbd !== undefined && field.kbd === EDIT_KEYS[role]);
  if (!line?.editor) {
    return false;
  }

  setOpen(line, true);
  return true;
}

function setOpen(line: FieldLine, open: boolean) {
  if (open) {
    opened.value = line.key;
    draft.value = line.editor?.kind === 'input' ? line.editor.value : '';
  } else if (opened.value === line.key) {
    opened.value = null;
  }
}

function pick(editor: Extract<FieldEditor, { kind: 'picker' }>, value: string | null) {
  const input = value === null ? null : toPickedInput(editor.picks, value);
  emit('edit', { kind: 'projectField', projectItemId: editor.projectItemId, fieldId: editor.fieldId, value: input });
}

function save(line: FieldLine) {
  const { editor } = line;
  if (editor?.kind !== 'input') {
    return;
  }

  const text = draft.value.trim();
  opened.value = null;
  if (text === editor.value) {
    return;
  }

  emit('edit', {
    kind: 'projectField',
    projectItemId: editor.projectItemId,
    fieldId: editor.fieldId,
    value: text === '' ? null : toInput(editor.type, text),
  });
}

function toInput(type: 'date' | 'number' | 'text', text: string): ProjectFieldInput | null {
  switch (type) {
    case 'text':
      return { kind: 'text', text };
    case 'number': {
      const number = Number(text);
      return Number.isFinite(number) ? { kind: 'number', number } : null;
    }
    case 'date':
      return { kind: 'date', date: text };
    default:
      return assertNever(type);
  }
}

function formatIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function openAdding(open: boolean) {
  adding.value = open;
  if (open) {
    emit('needProjects');
  }
}

function addTo(projectId: string | null) {
  const project = props.viewerProjects?.find(candidate => candidate.id === projectId);
  if (project) {
    emit('edit', { kind: 'addToProject', project });
  }
}
</script>

<template>
  <section
    v-if="cards.length > 0 || canAddToProject"
    :class="css.itemProjects"
  >
    <h2 :class="css.itemProjects_title">
      {{ t(l.projects) }}
      <Picker
        v-if="canAddToProject"
        :open="adding"
        :label="t(l.addToProject)"
        :options="addable"
        :placeholder="t(l.filterProjects)"
        :note="viewerProjects === null ? t(l.loadingProjects) : undefined"
        align="end"
        @update:open="openAdding"
        @pick="addTo"
      >
        <template #trigger>
          <Button
            variant="ghost"
            size="sm"
            :icon="Plus"
          >
            {{ t(l.addToProject) }}
          </Button>
        </template>
      </Picker>
    </h2>
    <div
      v-for="card in cards"
      :key="card.key"
      :class="css.itemProjects_card"
    >
      <h3 :class="css.itemProjects_name">
        <SquareKanban
          :class="css.itemProjects_icon"
          aria-hidden="true"
        />
        {{ card.title }}
      </h3>
      <dl
        v-if="card.fields.length > 0"
        :class="css.itemProjects_fields"
      >
        <PropertyRow
          v-for="field in card.fields"
          :key="field.key"
          :label="field.name"
          :kbd="field.kbd"
          size="card"
        >
          <Picker
            v-if="field.editor?.kind === 'picker'"
            :open="opened === field.key"
            :label="field.name"
            :options="field.editor.options"
            :selected="field.editor.selected === null ? [] : [field.editor.selected]"
            :none-label="t(l.clear)"
            @update:open="setOpen(field, $event)"
            @pick="field.editor.kind === 'picker' && pick(field.editor, $event)"
          >
            <template #trigger>
              <PropertyValueButton
                size="card"
                :aria-label="t(l.valueLabel, { field: field.name, value: field.text ?? t(l.empty) })"
                :aria-keyshortcuts="field.kbd"
              >
                <span
                  v-if="field.text === null"
                  :class="css.itemProjects_empty"
                  >{{ t(l.empty) }}</span
                >
                <span
                  v-else
                  :class="css.itemProjects_value"
                >
                  <span
                    v-if="field.color"
                    :class="css.itemProjects_dot"
                    :style="{ background: `#${field.color}` }"
                    aria-hidden="true"
                  />
                  {{ field.text }}
                </span>
              </PropertyValueButton>
            </template>
          </Picker>
          <Popover
            v-else-if="field.editor?.kind === 'input'"
            :open="opened === field.key"
            :label="field.name"
            @update:open="setOpen(field, $event)"
          >
            <template #trigger>
              <PropertyValueButton
                size="card"
                :aria-label="t(l.valueLabel, { field: field.name, value: field.text ?? t(l.empty) })"
              >
                <span :class="field.text === null ? css.itemProjects_empty : css.itemProjects_value">{{
                  field.text ?? t(l.empty)
                }}</span>
              </PropertyValueButton>
            </template>
            <Form @submit="save(field)">
              <NumberField
                v-if="field.editor.type === 'number'"
                v-model="numberDraft"
                :label="field.name"
                label-hidden
                :placeholder="t(l.emptyClears)"
              />
              <DateField
                v-else-if="field.editor.type === 'date'"
                v-model="dateDraft"
                :label="field.name"
                label-hidden
              />
              <TextField
                v-else
                v-model="draft"
                :label="field.name"
                label-hidden
                :placeholder="t(l.emptyClears)"
              />
            </Form>
          </Popover>
          <template v-else>
            <span
              v-if="field.text === null"
              :class="css.itemProjects_empty"
              >{{ t(l.empty) }}</span
            >
            <span
              v-else
              :class="css.itemProjects_value"
            >
              <span
                v-if="field.color"
                :class="css.itemProjects_dot"
                :style="{ background: `#${field.color}` }"
                aria-hidden="true"
              />
              {{ field.text }}
            </span>
          </template>
        </PropertyRow>
      </dl>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.itemProjects {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.itemProjects_title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.itemProjects_card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: $spacing-10 $spacing-12;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
}

.itemProjects_name {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.itemProjects_icon {
  width: 13px;
  height: 13px;
  color: $color-accent;
}

.itemProjects_fields {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
}

.itemProjects_value {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
}

.itemProjects_dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.itemProjects_empty {
  color: $color-fg-dim;
}
</style>
