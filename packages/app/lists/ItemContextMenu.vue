<!-- The context menu of a list's rows (L1–L4): the actions that fit the item right-clicked — or the items selected together, only those that fit every one of them — under its reference ("3 issues · 2 repositories"). An issue: open it, its project fields and adding it to a project, assign, labels, milestone, type, comment, copy its link or reference, close as completed or not planned. A stack's entry: merge its whole stack (stacked PRs D11), as the list offers it. A pull request: merge one the user may merge (`⇧M`, merging D9: one at a time, never several together; the list moves on to the next row once it is sent), open its files on GitHub, ask for reviews, draft or ready, copy its branch, close. Only what the user may do in that repository is offered, and one quiet line says what is left out and why. Every entry shows its key, so the menu also teaches the keyboard. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { Info } from 'lucide-vue-next';
import { computed, watch } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import type { Command } from '@/commands/CommandTypes.js';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { getItemMenuSections } from '@/item/getItemMenuSections.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { isPendingItem } from '@/store/isPendingItem.js';

import * as l from './ItemContextMenu.loc.js';
import { useItemCommands } from './useItemCommands.js';

const props = withDefaults(
  defineProps<{
    /** The items it acts on: the one right-clicked, or those selected together. */
    ids: readonly string[];
    /** On a stack's entry, the list's merge of its whole stack (stacked PRs D11): offered after going to them. */
    merge?: Command | null;
  }>(),
  { merge: null },
);

const emit = defineEmits<{
  /** "Open": the one item opens as Enter opens it. */
  open: [];
}>();

const t = useTranslate();
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
/** The list's: once the merge is sent, it moves on to the next row (PM32a). */
const merging = injectContext(MergeContext, { optional: true });
const { selected, one, repositoryNames, getOwnCommands, getEditCommands } = useItemCommands({
  ids: () => props.ids,
  section: () => 'selection',
  open: () => emit('open'),
  merge: merging ? pr => merging.open(pr.id) : undefined,
});

const heading = computed(() => {
  const item = one.value;
  if (item) {
    return `${item.repository.nameWithOwner}#${isPendingItem(item) ? '…' : item.number}`;
  }

  const count = selected.value.length;
  const repositoryCount = repositoryNames.value.length;
  const kinds = new Set(selected.value.map(candidate => candidate.kind));
  const what =
    kinds.size > 1 ? t(l.items, { count }) : kinds.has('issue') ? t(l.issues, { count }) : t(l.pulls, { count });
  return `${what} · ${t(l.repositories, { count: repositoryCount })}`;
});

const sections = computed(() => {
  const [opening = [], ...rest] = getItemMenuSections(
    [...getOwnCommands(), ...getEditCommands()],
    one.value?.kind ?? 'issue',
  );
  return props.merge ? [opening, [props.merge], ...rest] : [opening, ...rest];
});

/** What the user may not do here, said once: the one item's repository gives them too low a role. */
const note = computed(() => {
  const item = one.value;
  if (!item) {
    return null;
  }

  const permissions = editor.getPermissions(item);
  return permissions.labels ? null : t(l.needsTriage, { repository: item.repository.nameWithOwner });
});

// What the submenus offer, and what the user may do there, read for every repository of the items.
watch(
  repositoryNames,
  names => {
    for (const name of names) {
      void repositories.ensure(name);
    }
  },
  { immediate: true },
);
</script>

<template>
  <!-- A project's draft issue is not an item of the local copy: nothing to offer here. -->
  <MenuLabel v-if="selected.length === 0">{{ t(l.nothing) }}</MenuLabel>
  <MenuLabel v-else>
    <span :class="css.itemContextMenu_heading">{{ heading }}</span>
  </MenuLabel>
  <CommandMenuSections :sections="sections" />
  <template v-if="note">
    <MenuSeparator />
    <p :class="css.itemContextMenu_note">
      <Info
        :class="css.itemContextMenu_noteIcon"
        aria-hidden="true"
      />
      {{ note }}
    </p>
  </template>
</template>

<style lang="scss" module="css">
.itemContextMenu_heading {
  font-family: $font-family-mono;
}

.itemContextMenu_note {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  max-width: 264px;
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemContextMenu_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 1px;
}
</style>
