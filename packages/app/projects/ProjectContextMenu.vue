<!-- The menu of a tracked project — its context menu in the sidebar (R3), and what its view's title opens (R2, R5): under its title and owner, its saved views, the one shown checked and with their keys `1`–`9` when it is the open project's (`current`), where they would do something; a new issue in it, where the user may add one; its page on GitHub, copying the link to it and its settings; no longer tracking it. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { useProjectCommands } from './useProjectCommands.js';

const props = withDefaults(
  defineProps<{
    /** The tracked project's node id. */
    projectId: string;
    /** The key that starts a new issue where the menu is (`C` on the project's own view), shown beside it. */
    newIssueKey?: string;
    /** Whether this is the open project's menu: its saved views then show their keys, which only work there. */
    current?: boolean;
    /** The saved view shown (its id), checked; `null` for none. */
    shownView?: string | null;
  }>(),
  { newIssueKey: undefined, current: false, shownView: null },
);

const tracking = useService(TrackingStore);
const projectCommands = useProjectCommands();

const tracked = computed(() => tracking.projects.find(candidate => candidate.id === props.projectId) ?? null);
const sections = computed(() => {
  if (!tracked.value) {
    return [];
  }

  const commands = projectCommands(tracked.value);
  // Under the project's title a view need not say it is one.
  const views = commands.savedViews.map(({ viewId, command }) => ({
    ...command,
    detail: undefined,
    key: props.current ? command.key : undefined,
    current: viewId === props.shownView,
  }));
  return [
    views,
    [{ ...commands.newIssue, key: props.newIssueKey }],
    [commands.openOnGitHub, commands.copyLink, commands.settings],
    [commands.untrack],
  ].map(section => section.filter(command => command.when?.() ?? true));
});
</script>

<template>
  <MenuLabel>{{ tracked?.title }} · {{ tracked?.owner }}</MenuLabel>
  <CommandMenuSections :sections="sections" />
</template>
