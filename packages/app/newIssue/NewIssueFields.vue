<!-- The optional details of a new issue (H1, H3), from the chosen repository's options: as chips under the title in the quick capture — Assign to me ⌥A, Labels, Milestone, Type, Parent, Project — or as rows beside the body once expanded. Where the user can't push, GitHub drops labels, assignees, milestone and type from a new issue (D14): they are not offered, and a line says why. A value this repository does not have — kept from another one, or set by an issue form — marks its chip and is named in a line under them: it will be left out. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { AlertTriangle, CircleDot, GitFork, Milestone, Shapes, SquareKanban, Tag, User, X } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import Picker from '@/components/Picker.vue';
import type { PickerChange, PickerOption } from '@/components/Picker.vue';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

import type { NewIssueDraft, NewIssueProjectChoice } from './NewIssueComposer.js';
import * as l from './NewIssueFields.loc.js';
import { toggleAssignee } from './toggleAssignee.js';

const props = defineProps<{
  draft: NewIssueDraft;
  /** The chosen repository's options; `null` while they are read. */
  metadata: RepositoryMetadata | null;
  /** Whether GitHub keeps labels, assignees, milestone and type from this user (D14). */
  canPush: boolean;
  viewerLogin: string;
  /** Open issues of the repository the new one can be a sub-issue of. */
  parentOptions: readonly PickerOption[];
  /** Projects it can be added to, by id. */
  projectOptions: readonly PickerOption[];
  /** `chips` under the title (H1), `rows` beside the body (H3). */
  layout: 'chips' | 'rows';
}>();

const emit = defineEmits<{
  update: [patch: Partial<NewIssueDraft>];
}>();

const t = useTranslate();
const options = usePickerOptions();

const repositories = computed(() => (props.metadata ? [props.metadata] : []));
const assignedToMe = computed(() => props.draft.assignees.includes(props.viewerLogin));
/** What is chosen that the repository does not have: kept from another one or set by a form, it will be left out. */
const missing = computed(() => {
  const metadata = props.metadata;
  const { labels, assignees, milestone, issueType } = props.draft;
  if (!metadata) {
    return { labels: [], assignees: [], milestone: null, issueType: null, all: [] };
  }

  const found = {
    labels: labels.filter(label => !metadata.labels.some(candidate => candidate.name === label)),
    assignees: assignees.filter(login => !metadata.assignableUsers.some(candidate => candidate.login === login)),
    milestone:
      milestone !== null && !metadata.milestones.some(candidate => candidate.title === milestone) ? milestone : null,
    issueType:
      issueType !== null && !metadata.issueTypes.some(candidate => candidate.name === issueType) ? issueType : null,
  };
  const all = [...found.labels, ...found.assignees, found.milestone, found.issueType].filter(value => value !== null);
  return { ...found, all };
});
const shownProjectOptions = computed(() =>
  props.projectOptions.filter(option => !props.draft.projects.some(project => project.projectId === option.value)),
);

function toggleAssignMe() {
  emit('update', { assignees: toggleAssignee(props.draft.assignees, props.viewerLogin) });
}

function applyAssignees(change: PickerChange) {
  emit('update', { assignees: applyChange(props.draft.assignees, change) });
}

function applyLabels(change: PickerChange) {
  emit('update', { labels: applyChange(props.draft.labels, change) });
}

function pickParent(value: string | null) {
  const option = props.parentOptions.find(candidate => candidate.value === value);
  emit('update', { parent: option ? { id: option.value, reference: option.detail ?? option.label } : null });
}

function addProject(value: string | null) {
  const option = props.projectOptions.find(candidate => candidate.value === value);
  if (option) {
    const project: NewIssueProjectChoice = { projectId: option.value, title: option.label, values: [] };
    emit('update', { projects: [...props.draft.projects, project] });
  }
}

function removeProject(projectId: string) {
  emit('update', { projects: props.draft.projects.filter(project => project.projectId !== projectId) });
}

/** "Platform Q4 · Status: In progress". */
function describeProject(project: NewIssueProjectChoice) {
  return [project.title, ...project.values.map(value => `${value.fieldName}: ${value.label}`)].join(' · ');
}

function applyChange(values: readonly string[], change: PickerChange) {
  return [...values.filter(value => !change.removed.includes(value)), ...change.added];
}
</script>

<template>
  <div :class="[css.newIssueFields, css[`newIssueFields_${layout}`]]">
    <template v-if="canPush">
      <Button
        variant="outline"
        size="sm"
        :icon="User"
        kbd="Alt+A"
        :aria-pressed="assignedToMe"
        aria-keyshortcuts="Alt+A"
        :class="{ [css.newIssueFields_missingChip]: assignedToMe && missing.assignees.includes(viewerLogin) }"
        @click="toggleAssignMe"
      >
        {{ assignedToMe ? t(l.assignedToMe) : t(l.assignToMe) }}
      </Button>
      <Picker
        v-if="layout === 'rows'"
        :label="t(l.assignees)"
        :options="options.assignees(repositories, viewerLogin)"
        :selected="draft.assignees"
        multiple
        @apply="applyAssignees"
      >
        <template #trigger>
          <Button
            variant="outline"
            size="sm"
            :icon="User"
            :class="{ [css.newIssueFields_missingChip]: missing.assignees.length > 0 }"
          >
            {{ draft.assignees.length > 0 ? draft.assignees.join(', ') : t(l.assignees) }}
          </Button>
        </template>
      </Picker>
      <Picker
        :label="t(l.labels)"
        :options="options.labels(repositories)"
        :selected="draft.labels"
        multiple
        @apply="applyLabels"
      >
        <template #trigger>
          <Button
            variant="outline"
            size="sm"
            :icon="Tag"
            :class="{ [css.newIssueFields_missingChip]: missing.labels.length > 0 }"
          >
            {{ draft.labels.length > 0 ? draft.labels.join(', ') : t(l.labels) }}
          </Button>
        </template>
      </Picker>
      <Picker
        :label="t(l.milestone)"
        :options="options.milestones(repositories)"
        :selected="draft.milestone ? [draft.milestone] : []"
        :none-label="t(l.noMilestone)"
        @pick="emit('update', { milestone: $event })"
      >
        <template #trigger>
          <Button
            variant="outline"
            size="sm"
            :icon="Milestone"
            :class="{ [css.newIssueFields_missingChip]: missing.milestone !== null }"
          >
            {{ draft.milestone ?? t(l.milestone) }}
          </Button>
        </template>
      </Picker>
      <Picker
        v-if="metadata && (metadata.issueTypes.length > 0 || missing.issueType !== null)"
        :label="t(l.type)"
        :options="options.issueTypes(repositories)"
        :selected="draft.issueType ? [draft.issueType] : []"
        :none-label="t(l.noType)"
        @pick="emit('update', { issueType: $event })"
      >
        <template #trigger>
          <Button
            variant="outline"
            size="sm"
            :icon="Shapes"
            :class="{ [css.newIssueFields_missingChip]: missing.issueType !== null }"
          >
            {{ draft.issueType ?? t(l.type) }}
          </Button>
        </template>
      </Picker>
    </template>
    <Button
      v-if="draft.parent"
      variant="outline"
      size="sm"
      :icon="GitFork"
      :aria-label="t(l.removeParent, { parent: draft.parent.reference })"
      @click="emit('update', { parent: null })"
    >
      {{ t(l.subIssueOf, { parent: draft.parent.reference }) }}
      <X
        :class="css.newIssueFields_remove"
        aria-hidden="true"
      />
    </Button>
    <Picker
      v-else
      :label="t(l.parent)"
      :options="parentOptions"
      @pick="pickParent"
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="GitFork"
        >
          {{ t(l.parent) }}
        </Button>
      </template>
    </Picker>
    <Button
      v-for="project in draft.projects"
      :key="project.projectId"
      variant="outline"
      size="sm"
      :icon="SquareKanban"
      :aria-label="t(l.removeChip, { chip: describeProject(project) })"
      @click="removeProject(project.projectId)"
    >
      {{ describeProject(project) }}
      <X
        :class="css.newIssueFields_remove"
        aria-hidden="true"
      />
    </Button>
    <Picker
      v-if="shownProjectOptions.length > 0"
      :label="t(l.project)"
      :options="shownProjectOptions"
      @pick="addProject"
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="SquareKanban"
        >
          {{ draft.projects.length > 0 ? t(l.anotherProject) : t(l.project) }}
        </Button>
      </template>
    </Picker>
    <p
      v-if="!canPush && metadata"
      :class="css.newIssueFields_note"
    >
      <CircleDot
        :class="css.newIssueFields_noteIcon"
        aria-hidden="true"
      />
      {{ t(l.noPush, { repository: metadata.nameWithOwner }) }}
    </p>
    <p
      v-if="missing.all.length > 0 && metadata"
      :class="[css.newIssueFields_note, css.newIssueFields_missingNote]"
      role="status"
    >
      <AlertTriangle
        :class="css.newIssueFields_noteIcon"
        aria-hidden="true"
      />
      {{ t(l.notInRepository, { values: missing.all.join(', '), repository: metadata.nameWithOwner }) }}
    </p>
  </div>
</template>

<style lang="scss" module="css">
.newIssueFields {
  display: flex;
  gap: $spacing-6;
}

.newIssueFields_chips {
  flex-wrap: wrap;
  align-items: center;
}

.newIssueFields_rows {
  flex-direction: column;
  align-items: flex-start;
}

.newIssueFields_remove {
  width: 12px;
  height: 12px;
  margin-left: $spacing-4;
  color: $color-fg-dim;
}

.newIssueFields_note {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  flex-basis: 100%;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.newIssueFields_missingNote {
  color: $color-amber;
}

.newIssueFields_missingChip {
  text-decoration: line-through;
  border-color: $color-amber;
}

.newIssueFields_noteIcon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
