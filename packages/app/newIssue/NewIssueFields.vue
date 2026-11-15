<!-- The optional details of a new issue (H1, H3), from the chosen repository's options: as chips under the title in the quick capture — Assign to me ⌥A, Labels, Milestone, Type, Parent, Project — or as rows beside the body once expanded. On a phone (`summary`, mobile D42, MB194–MB195) as an opened item's summary: rows of a definition list (`PropertyRow`) — Assignees with Assign to me at its end, Labels, Milestone, Type, Parent, an unset one saying so ("No one", "No labels") — then each project as a card with the fields set on it, and "No project" to add one; tapping a value opens its picker, a menu at the bottom (mobile D45). Where the user can't push, GitHub drops labels, assignees, milestone and type from a new issue (D14): they are not offered, and a line says why. A value this repository does not have — kept from another one, or set by an issue form — marks its chip and is named in a line under them: it will be left out. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { AlertTriangle, CircleDot, GitFork, Milestone, Shapes, SquareKanban, Tag, User, X } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import LabelPill from '@/components/LabelPill.vue';
import Picker from '@/components/Picker.vue';
import type { PickerChange, PickerOption } from '@/components/Picker.vue';
import PropertyRow from '@/components/PropertyRow.vue';
import PropertyValueButton from '@/components/PropertyValueButton.vue';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';

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
  /** `chips` under the title (H1), `rows` beside the body (H3), `summary` as an item's on a phone (mobile D42). */
  layout: 'chips' | 'rows' | 'summary';
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
/** Under a picker's name in a phone's menu at the bottom: what it sets ("New issue · fitloop/webapp"). */
const pickerContext = computed(() =>
  props.metadata ? t(l.pickerContext, { repository: props.metadata.nameWithOwner }) : t(l.newIssue),
);
/** The assignees with their pictures, as an item shows them. */
const assigneeUsers = computed(() =>
  props.draft.assignees.map(login => ({
    login,
    avatarUrl: props.metadata?.assignableUsers.find(user => user.login === login)?.avatarUrl ?? null,
  })),
);
/** The labels with their colours; one the repository does not have has none. */
const labelPills = computed(() =>
  props.draft.labels.map(name => ({
    name,
    color: props.metadata?.labels.find(label => label.name === name)?.color ?? null,
  })),
);
const issueTypeColor = computed(() => {
  const type = props.metadata?.issueTypes.find(candidate => candidate.name === props.draft.issueType);
  return type ? getGitHubColor(type.color) : null;
});
const parentTitle = computed(() =>
  props.draft.parent ? props.parentOptions.find(option => option.value === props.draft.parent?.id)?.label : undefined,
);
const showIssueType = computed(
  () => props.metadata !== null && (props.metadata.issueTypes.length > 0 || missing.value.issueType !== null),
);
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
  <div
    v-if="layout === 'summary'"
    :class="css.newIssueFields_summary"
  >
    <dl
      :class="css.newIssueFields_properties"
      :aria-label="t(l.details)"
    >
      <template v-if="canPush">
        <PropertyRow :label="t(l.assignees)">
          <Picker
            :label="t(l.assignees)"
            :context="pickerContext"
            :options="options.assignees(repositories, viewerLogin)"
            :selected="draft.assignees"
            multiple
            @apply="applyAssignees"
          >
            <template #trigger>
              <PropertyValueButton
                :label="t(l.valueLabel, { property: t(l.assignees), value: draft.assignees.join(', ') || t(l.noOne) })"
              >
                <template v-if="assigneeUsers.length > 0">
                  <span
                    v-for="user in assigneeUsers"
                    :key="user.login"
                    :class="[
                      css.newIssueFields_value,
                      missing.assignees.includes(user.login) && css.newIssueFields_missingValue,
                    ]"
                  >
                    <Avatar
                      :name="user.login"
                      :src="user.avatarUrl"
                      size="xs"
                      decorative
                    />
                    {{ user.login }}
                  </span>
                </template>
                <span
                  v-else
                  :class="css.newIssueFields_empty"
                  >{{ t(l.noOne) }}</span
                >
              </PropertyValueButton>
            </template>
          </Picker>
          <Button
            variant="outline"
            size="sm"
            :aria-pressed="assignedToMe"
            keyshortcuts="Alt+A"
            @click="toggleAssignMe"
          >
            {{ assignedToMe ? t(l.assignedToMe) : t(l.assignToMe) }}
          </Button>
        </PropertyRow>
        <PropertyRow :label="t(l.labels)">
          <Picker
            :label="t(l.labels)"
            :context="pickerContext"
            :options="options.labels(repositories)"
            :selected="draft.labels"
            multiple
            @apply="applyLabels"
          >
            <template #trigger>
              <PropertyValueButton
                :label="t(l.valueLabel, { property: t(l.labels), value: draft.labels.join(', ') || t(l.noLabels) })"
              >
                <template v-if="labelPills.length > 0">
                  <template
                    v-for="label in labelPills"
                    :key="label.name"
                  >
                    <LabelPill
                      v-if="label.color"
                      :name="label.name"
                      :color="label.color"
                    />
                    <span
                      v-else
                      :class="css.newIssueFields_missingValue"
                      >{{ label.name }}</span
                    >
                  </template>
                </template>
                <span
                  v-else
                  :class="css.newIssueFields_empty"
                  >{{ t(l.noLabels) }}</span
                >
              </PropertyValueButton>
            </template>
          </Picker>
        </PropertyRow>
        <PropertyRow :label="t(l.milestone)">
          <Picker
            :label="t(l.milestone)"
            :context="pickerContext"
            :options="options.milestones(repositories)"
            :selected="draft.milestone ? [draft.milestone] : []"
            :none-label="t(l.noMilestone)"
            @pick="emit('update', { milestone: $event })"
          >
            <template #trigger>
              <PropertyValueButton
                :label="t(l.valueLabel, { property: t(l.milestone), value: draft.milestone ?? t(l.noMilestone) })"
              >
                <span
                  v-if="draft.milestone"
                  :class="[css.newIssueFields_value, missing.milestone !== null && css.newIssueFields_missingValue]"
                >
                  <Milestone
                    :class="css.newIssueFields_valueIcon"
                    aria-hidden="true"
                  />
                  {{ draft.milestone }}
                </span>
                <span
                  v-else
                  :class="css.newIssueFields_empty"
                  >{{ t(l.noMilestone) }}</span
                >
              </PropertyValueButton>
            </template>
          </Picker>
        </PropertyRow>
        <PropertyRow
          v-if="showIssueType"
          :label="t(l.type)"
        >
          <Picker
            :label="t(l.type)"
            :context="pickerContext"
            :options="options.issueTypes(repositories)"
            :selected="draft.issueType ? [draft.issueType] : []"
            :none-label="t(l.noType)"
            @pick="emit('update', { issueType: $event })"
          >
            <template #trigger>
              <PropertyValueButton
                :label="t(l.valueLabel, { property: t(l.type), value: draft.issueType ?? t(l.noType) })"
              >
                <LabelPill
                  v-if="draft.issueType && issueTypeColor"
                  :name="draft.issueType"
                  :color="issueTypeColor"
                />
                <span
                  v-else-if="draft.issueType"
                  :class="css.newIssueFields_missingValue"
                  >{{ draft.issueType }}</span
                >
                <span
                  v-else
                  :class="css.newIssueFields_empty"
                  >{{ t(l.noType) }}</span
                >
              </PropertyValueButton>
            </template>
          </Picker>
        </PropertyRow>
      </template>
      <PropertyRow :label="t(l.parent)">
        <Picker
          :label="t(l.parent)"
          :context="pickerContext"
          :options="parentOptions"
          :selected="draft.parent ? [draft.parent.id] : []"
          :none-label="t(l.noParent)"
          @pick="pickParent"
        >
          <template #trigger>
            <PropertyValueButton
              :label="
                t(l.valueLabel, {
                  property: t(l.parent),
                  value: draft.parent ? [draft.parent.reference, parentTitle].filter(Boolean).join(' ') : t(l.noParent),
                })
              "
            >
              <span
                v-if="draft.parent"
                :class="css.newIssueFields_value"
              >
                <span :class="css.newIssueFields_parentTitle"
                  ><span :class="css.newIssueFields_reference">{{ draft.parent.reference }}</span>
                  {{ parentTitle }}</span
                >
              </span>
              <span
                v-else
                :class="css.newIssueFields_empty"
                >{{ t(l.noParent) }}</span
              >
            </PropertyValueButton>
          </template>
        </Picker>
      </PropertyRow>
    </dl>
    <div :class="css.newIssueFields_projects">
      <span :class="css.newIssueFields_projectsTitle">{{ t(l.projects) }}</span>
      <section
        v-for="project in draft.projects"
        :key="project.projectId"
        :class="css.newIssueFields_card"
        :aria-label="project.title"
      >
        <div :class="css.newIssueFields_cardName">
          <SquareKanban
            :class="css.newIssueFields_cardIcon"
            aria-hidden="true"
          />
          {{ project.title }}
          <IconButton
            :class="css.newIssueFields_cardRemove"
            :icon="X"
            :label="t(l.removeProject, { project: project.title })"
            @click="removeProject(project.projectId)"
          />
        </div>
        <dl
          v-if="project.values.length > 0"
          :class="css.newIssueFields_cardFields"
        >
          <PropertyRow
            v-for="value in project.values"
            :key="value.fieldId"
            :label="value.fieldName"
            size="card"
          >
            {{ value.label }}
          </PropertyRow>
        </dl>
      </section>
      <Picker
        v-if="shownProjectOptions.length > 0"
        :label="t(l.project)"
        :context="pickerContext"
        :options="shownProjectOptions"
        @pick="addProject"
      >
        <template #trigger>
          <Button
            variant="outline"
            :icon="SquareKanban"
            :class="css.newIssueFields_addProject"
          >
            {{ draft.projects.length > 0 ? t(l.addToAnotherProject) : t(l.noProject) }}
          </Button>
        </template>
      </Picker>
      <span
        v-else-if="draft.projects.length === 0"
        :class="[css.newIssueFields_card, css.newIssueFields_empty]"
        >{{ t(l.noProject) }}</span
      >
    </div>
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
  <div
    v-else
    :class="[css.newIssueFields, css[`newIssueFields_${layout}`]]"
  >
    <template v-if="canPush">
      <Button
        variant="outline"
        size="sm"
        :icon="User"
        kbd="Alt+A"
        :aria-pressed="assignedToMe"
        keyshortcuts="Alt+A"
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
        v-if="showIssueType"
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

.newIssueFields_summary {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
}

.newIssueFields_properties {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  margin: 0;
}

// A finger's height for each row's value, as an item's rows on a phone.
.newIssueFields_properties > div {
  align-items: center;
  min-height: 32px;
}

.newIssueFields_value {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
}

.newIssueFields_valueIcon {
  width: 13px;
  height: 13px;
  color: $color-fg-2;
}

.newIssueFields_empty {
  color: $color-fg-dim;
}

.newIssueFields_missingValue {
  color: $color-amber;
  text-decoration: line-through;
}

.newIssueFields_reference {
  font-family: $font-family-mono;
  color: $color-fg-2;
}

.newIssueFields_parentTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.newIssueFields_projects {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.newIssueFields_projectsTitle {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.newIssueFields_card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-sm;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.newIssueFields_cardName {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
}

.newIssueFields_cardIcon {
  width: 13px;
  height: 13px;
  color: $color-accent;
}

.newIssueFields_cardRemove {
  margin-left: auto;
}

.newIssueFields_cardFields {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
}

// The "No project" box of MB194, opening the projects to add it to.
.newIssueFields_projects .newIssueFields_addProject {
  justify-content: flex-start;
  width: 100%;
  min-height: $touch-target-size;
  color: $color-fg-2;
  border-color: $color-border-2;
  border-radius: $radius-lg;
}

.newIssueFields_noteIcon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
