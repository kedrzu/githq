<!-- The menu of a repository — its context menu in the sidebar, and what its view's title opens (R4): under its name, its issues, pull requests, commits, or while tracked its workflows, with their keys `1`–`4` when it is the open repository's (`current`), where they would do something; a new issue in it; its page on GitHub, copying the link to it and its settings; no longer tracking it. -->
<script lang="ts" setup>
import { computed } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import MenuLabel from '@/components/MenuLabel.vue';

import { useRepositoryCommands } from './useRepositoryCommands.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** Whether this is the open repository's menu: its sections then show their keys, which only work there. */
  current?: boolean;
}>();

const repositoryCommands = useRepositoryCommands();

const sections = computed(() => {
  const commands = repositoryCommands(props.nameWithOwner, { keyed: props.current });
  return [
    commands.sections,
    [commands.newIssue],
    [commands.openOnGitHub, commands.copyLink, commands.settings],
    [commands.untrack],
  ].map(section => section.filter(command => command.when?.() ?? true));
});
</script>

<template>
  <MenuLabel>
    <span :class="css.repositoryContextMenu_heading">{{ nameWithOwner }}</span>
  </MenuLabel>
  <CommandMenuSections :sections="sections" />
</template>

<style lang="scss" module="css">
.repositoryContextMenu_heading {
  font-family: $font-family-mono;
}
</style>
