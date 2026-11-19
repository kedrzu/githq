<!-- Settings' Repositories and Projects (G8, T17, D25): the head (`TrackedListHead`, "15 tracked repositories" and "Track repositories A"), then only what is tracked, by owner (`groupTrackedByOwner`), each group under its header (`TrackedOwnerHeader`) with its rows in the `row` slot. A row opens its settings on click or Enter. Keys while it is shown and no layer is open, never from a field: J/K and ↑/↓ move the selection, Enter opens the selected row, ⌫ untracks it — the selection moving to the next row, the previous one after the last — and A adds more (the picker); `1` to `4` stay Settings'. Nothing tracked, the note in its place says what tracking does, its button adding the first (`NothingThere`, first run and loading D6, ES24), once what is tracked is known: nothing says "none" before. On a phone (`phone`, mobile D35, MB151, MB154, MB162) no head — the screen's top bar has the title and "+" — but a line saying what githq does with them, then the groups (`TrackedOwnerHeader`), each row a button drilling into its settings; nothing tracked, the note's button is the screen's one action, the width of its column. The keys stay, with no hints drawn. -->
<script lang="ts" setup generic="T">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Plus, SquareKanban } from 'lucide-vue-next';
import { computed, useTemplateRef } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import * as definitions from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import NothingThere from '@/components/NothingThere.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import TrackedListHead from './TrackedListHead.vue';
import * as l from './TrackedListView.loc.js';
import TrackedOwnerHeader from './TrackedOwnerHeader.vue';
import type { TrackedOwnerGroup } from './utils/groupTrackedByOwner.js';

const props = defineProps<{
  /** What is listed, and so the words. */
  kind: 'repositories' | 'projects';
  groups: readonly TrackedOwnerGroup<T>[];
  /** What tells the rows apart, kept while the list changes under the selection. */
  getKey: (row: T) => string;
  /** What is tracked is known: until then, no rows says nothing. */
  loaded: boolean;
  /** On a phone: no head, rows a finger's height that drill in. */
  phone?: boolean;
}>();

const emit = defineEmits<{
  /** Its settings (T16, T17). */
  open: [row: T];
  untrack: [row: T];
  /** The picker, on an owner for a group's "Track more". */
  add: [owner?: string];
}>();

defineSlots<{
  row(props: { row: T; selected: boolean }): unknown;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const root = useTemplateRef('root');

const rows = computed(() => props.groups.flatMap(group => group.rows));
// A row gone (untracked here or elsewhere): the selection goes to the next one, the previous one after the last.
const selection = useRowSelection({
  rows,
  getKey: row => props.getKey(row),
  root,
  keyAttribute: 'data-tracked-key',
  open: row => emit('open', row),
  place: 'trackedList',
  openTitle: l.open,
});
const projects = computed(() => props.kind === 'projects');
const addLabel = computed(() => t(projects.value ? l.addProjects : l.addRepositories));

useCommands(() => [
  bindCommand(
    definitions.add,
    { place: 'trackedList', section: 'view', title: addLabel.value, run: () => emit('add') },
    t,
  ),
  bindCommand(
    definitions.remove,
    {
      place: 'trackedList',
      section: 'view',
      title: t(l.untrack),
      menu: false,
      actsOnRow: true,
      when: () => selection.selectedRow !== null,
      run: () => {
        if (selection.selectedRow !== null) {
          emit('untrack', selection.selectedRow);
        }
      },
    },
    t,
  ),
]);

/** The row's own buttons (Untrack) do what they say instead. */
function onRowClick(event: MouseEvent, row: T) {
  if (!isActivatableTarget(event.target)) {
    emit('open', row);
  }
}
</script>

<template>
  <div
    v-if="phone"
    ref="root"
    :class="css.trackedListView_phone"
  >
    <NothingThere
      v-if="loaded && rows.length === 0"
      place="screen"
      :icon="projects ? SquareKanban : BookMarked"
      :title="t(projects ? l.noProjectsTitle : l.noRepositoriesTitle)"
      :detail="t(projects ? l.noProjectsDetailPhone : l.noRepositoriesDetailPhone)"
    >
      <template #action>
        <Button
          variant="primary"
          size="lg"
          :class="css.trackedListView_phoneAdd"
          @click="emit('add')"
        >
          {{ addLabel }}
        </Button>
      </template>
    </NothingThere>
    <template v-else-if="rows.length > 0">
      <p :class="css.trackedListView_phoneDescription">
        {{ t(projects ? l.projectsDescriptionPhone : l.repositoriesDescriptionPhone) }}
      </p>
      <section
        v-for="group in groups"
        :key="group.login"
      >
        <TrackedOwnerHeader
          :group="group"
          :kind="kind"
          phone
          @track-more="emit('add', group.login)"
        />
        <ul
          :class="css.trackedListView_rows"
          :aria-label="group.login"
        >
          <li
            v-for="row in group.rows"
            :key="getKey(row)"
            :data-tracked-key="getKey(row)"
          >
            <button
              type="button"
              :class="css.trackedListView_phoneRow"
              @click="emit('open', row)"
            >
              <slot
                name="row"
                :row="row"
                :selected="false"
              />
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
  <div
    v-else
    ref="root"
    :class="css.trackedListView"
    :data-route-scroll="`settings-tracked:${kind}`"
  >
    <NothingThere
      v-if="loaded && rows.length === 0"
      place="screen"
      :icon="projects ? SquareKanban : BookMarked"
      :title="t(projects ? l.noProjectsTitle : l.noRepositoriesTitle)"
      :detail="t(projects ? l.noProjectsDetail : l.noRepositoriesDetail)"
    >
      <template #action>
        <Button
          variant="secondary"
          size="sm"
          :icon="Plus"
          :kbd="keyOf(definitions.add)"
          :keyshortcuts="formatAriaKeyShortcuts(keyOf(definitions.add))"
          @click="emit('add')"
        >
          {{ addLabel }}
        </Button>
      </template>
    </NothingThere>
    <div
      v-else-if="rows.length > 0"
      :class="css.trackedListView_content"
    >
      <TrackedListHead
        :title="
          t(projects ? l.projectsTitle : l.repositoriesTitle, {
            count: rows.length,
            formatted: numbers.format(rows.length),
          })
        "
        :description="t(projects ? l.projectsDescription : l.repositoriesDescription)"
        :add-label="addLabel"
        :add-key="keyOf(definitions.add)"
        @add="emit('add')"
      />
      <section
        v-for="group in groups"
        :key="group.login"
        :class="css.trackedListView_group"
      >
        <TrackedOwnerHeader
          :group="group"
          :kind="kind"
          @track-more="emit('add', group.login)"
        />
        <ul
          :class="css.trackedListView_rows"
          :aria-label="group.login"
          data-screen-keys
        >
          <li
            v-for="row in group.rows"
            :key="getKey(row)"
            :data-tracked-key="getKey(row)"
            :aria-current="getKey(row) === selection.selectedKey ? 'true' : undefined"
            @click="onRowClick($event, row)"
          >
            <slot
              name="row"
              :row="row"
              :selected="getKey(row) === selection.selectedKey"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.trackedListView_phone {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.trackedListView_phoneDescription {
  padding: $spacing-12 $spacing-16 $spacing-4;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.trackedListView_phoneRow {
  display: block;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
  background: none;
  border: none;

  &:active {
    background: $color-bg-3;
  }

  @include focus-ring(-2px);
}

.trackedListView_phoneAdd {
  width: 100%;
  min-height: $touch-target-size;
}

.trackedListView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 20px $spacing-12;
  overflow-y: auto;
}

.trackedListView_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  max-width: $settings-column-width;
}

.trackedListView_group {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.trackedListView_rows {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
