<!-- The context menu of a tracked project in the sidebar: under its title, going to its view or to one of its saved views; a new issue in it, where the user may add one; its page on GitHub and copying the link to it; no longer tracking it. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { useProjectCommands } from './useProjectCommands.js';

const props = defineProps<{
  /** The tracked project's node id. */
  projectId: string;
}>();

const tracking = useService(TrackingStore);
const projectCommands = useProjectCommands();

const tracked = computed(() => tracking.projects.find(candidate => candidate.id === props.projectId) ?? null);
const sections = computed(() => {
  if (!tracked.value) {
    return [];
  }

  const commands = projectCommands(tracked.value);
  return [
    [commands.open, commands.views],
    [commands.newIssue],
    [commands.openOnGitHub, commands.copyLink],
    [commands.untrack],
  ].map(section => section.filter(command => command.when?.() ?? true));
});
</script>

<template>
  <MenuLabel>{{ tracked?.title }}</MenuLabel>
  <CommandMenuSections :sections="sections" />
</template>
