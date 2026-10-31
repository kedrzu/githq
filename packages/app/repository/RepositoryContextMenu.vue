<!-- The menu of a repository — its context menu in the sidebar, and what its view's title opens (R1): under its name, going to its view or to its issues or pull requests; a new issue in it; its page on GitHub and copying the link to it; no longer tracking it. -->
<script lang="ts" setup>
import { computed } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import MenuLabel from '@/components/MenuLabel.vue';

import { useRepositoryCommands } from './useRepositoryCommands.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
}>();

const repositoryCommands = useRepositoryCommands();

const sections = computed(() => {
  const commands = repositoryCommands(props.nameWithOwner);
  return [
    [commands.open, commands.issues, commands.pullRequests],
    [commands.newIssue],
    [commands.openOnGitHub, commands.copyLink],
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
