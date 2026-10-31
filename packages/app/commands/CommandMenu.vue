<!-- The command menu (⌘K, E1–E4): one list mixing the actions of what is opened or selected — named by the chip at the left of the field, taken out with ⌫ — the screen's and the app's, and places to go and items from the local copy (instant, nothing asked of GitHub). Typing finds them, and the options of the actions' submenus directly (E4: "in prog" → "Set Status → In progress"). ↑/↓ move, Enter runs — an action with a submenu opens it, as Tab and → do (E2) — ⌫ in an empty field or Esc steps back out of a submenu, Esc closes. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  BookMarked,
  CircleUser,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  GitPullRequest,
  Inbox,
  Layers,
  Plus,
  SquareKanban,
  Zap,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { computed, ref, shallowRef, watch } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Dialog from '@/components/Dialog.vue';
import FilterList from '@/components/FilterList.vue';
import type { FilterListGroup, FilterListHint, FilterListRow } from '@/components/FilterList.vue';
import Kbd from '@/components/Kbd.vue';
import { formatShortReference } from '@/item/itemRoutes.js';

import { buildCommandMenu, filterCommandOptions } from './buildCommandMenu.js';
import type { CommandMenuEntry, CommandMenuGroupKey } from './buildCommandMenu.js';
import * as l from './CommandMenu.loc.js';
import type { Command, CommandOption, CommandSubject } from './CommandTypes.js';
import { formatCommandKey } from './formatCommandKey.js';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';

const props = withDefaults(
  defineProps<{
    /** Every action registered now. */
    commands: readonly Command[];
    /** What the actions act on: the chip. */
    subject?: CommandSubject | null;
    /** Where places and items are found. */
    navigation: NavigationData;
    /** Opens in this action's submenu (its key was pressed, and it has no other way to run). */
    startCommandId?: string | null;
  }>(),
  { subject: null, startCommandId: null },
);

const emit = defineEmits<{
  /** A place, an item or a repository was picked: go there. */
  navigate: [result: NavigationResult];
}>();

const open = defineModel<boolean>('open', { default: false });

/** A line of the list as drawn. */
interface Row extends FilterListRow {
  readonly icon: LucideIcon | null;
  readonly title: string;
  /** In a found option: the action it is of ("Set status"), before an arrow. */
  readonly lead?: string;
  readonly detail?: string;
  /** Monospaced dim text: an item's reference. */
  readonly reference?: string;
  readonly color?: string;
  readonly avatarUrl?: string;
  readonly keys?: readonly string[];
  readonly submenu?: boolean;
  readonly chosen?: boolean;
  activate(): void;
}

const PLACE_ICONS: Readonly<Record<NavigationPlace['kind'], LucideIcon>> = {
  myWork: Inbox,
  project: SquareKanban,
  view: Eye,
  repository: BookMarked,
  tracking: Plus,
  account: CircleUser,
};

/** The most options a submenu draws: one may offer every item of the local copy; typing finds the rest. */
const SUBMENU_LIMIT = 100;

const t = useTranslate();
const query = ref('');
const subjectRemoved = ref(false);
const submenuId = shallowRef<string | null>(null);
const highlighted = shallowRef<string | null>(null);

/** What the actions act on: `null` once the user took it out (⌫). */
const subject = computed(() => (subjectRemoved.value ? null : props.subject));
const submenu = computed(() => props.commands.find(command => command.id === submenuId.value) ?? null);
const submenuOptions = computed(() => submenu.value?.options?.() ?? null);

const groups = computed((): FilterListGroup<Row>[] => {
  const command = submenu.value;
  const options = submenuOptions.value;
  if (command && options) {
    return groupOptions(command, filterCommandOptions(query.value, options.options).slice(0, SUBMENU_LIMIT));
  }

  return buildCommandMenu({
    query: query.value,
    commands: props.commands,
    subject: subject.value,
    navigation: props.navigation,
  }).map(group => ({
    key: group.key,
    heading: getHeading(group.key),
    rows: group.entries.map(toRow),
  }));
});
const rows = computed(() => groups.value.flatMap(group => group.rows));
const placeholder = computed(() => (submenu.value ? t(l.filterOptions) : t(l.placeholder)));
const message = computed(() => {
  if (rows.value.length > 0) {
    return null;
  }

  return submenuOptions.value?.loading ? t(l.loading) : t(l.noMatch);
});
const hints = computed((): FilterListHint[] => {
  if (submenu.value) {
    return [
      { keys: '↵', label: t(l.set) },
      { keys: '⌫', label: t(l.back) },
      { keys: 'Esc', label: t(l.close) },
    ];
  }

  const shown: FilterListHint[] = [
    { keys: '↵', label: t(l.run) },
    { keys: '→', label: t(l.openSubmenu) },
    { keys: '>', label: t(l.commandsOnly) },
  ];
  if (subject.value) {
    shown.push({ keys: '⌫', label: t(l.removeContext) });
  }

  return shown;
});

watch(
  open,
  isOpen => {
    if (isOpen) {
      query.value = '';
      subjectRemoved.value = false;
      submenuId.value = null;
      if (props.startCommandId) {
        enter(props.startCommandId);
      }
    }
  },
  { immediate: true },
);

function getHeading(key: CommandMenuGroupKey): string | null {
  switch (key) {
    case 'subject':
      return subject.value?.title ?? null;
    case 'view':
      return t(l.view);
    case 'goTo':
      return t(l.goTo);
    case 'projects':
      return t(l.projects);
    case 'repositories':
      return t(l.repositories);
    case 'items':
      return t(l.items);
    case 'app':
      return t(l.app);
    default:
      return null;
  }
}

function toRow(entry: CommandMenuEntry): Row {
  switch (entry.kind) {
    case 'command': {
      const { command } = entry;
      return {
        value: entry.id,
        icon: command.icon ?? Zap,
        title: command.title,
        detail: command.detail,
        keys: command.key ? formatCommandKey(command.key) : undefined,
        submenu: command.options !== undefined,
        activate: () => runCommand(command),
      };
    }
    case 'option': {
      const { command, option } = entry;
      return {
        value: entry.id,
        icon: command.icon ?? Zap,
        lead: command.title.replace(/…$/u, ''),
        title: option.label,
        // Which project's: two projects may offer one value.
        detail: [option.group, option.detail].filter(text => text !== undefined).join(' · ') || undefined,
        color: option.color,
        avatarUrl: option.avatarUrl,
        chosen: option.chosen,
        activate: () => pick(option),
      };
    }
    case 'navigation':
      return toNavigationRow(entry.id, entry.result);
    default:
      return assertNever(entry);
  }
}

function toNavigationRow(value: string, result: NavigationResult): Row {
  const go = () => {
    open.value = false;
    emit('navigate', result);
  };
  switch (result.kind) {
    case 'place': {
      const { place } = result;
      return { value, icon: PLACE_ICONS[place.kind], title: place.title, detail: place.detail, activate: go };
    }
    case 'item': {
      const { item } = result;
      return {
        value,
        icon: item.kind === 'issue' ? CircleDot : GitPullRequest,
        title: item.title,
        reference: formatShortReference(item),
        activate: go,
      };
    }
    case 'repository':
      return { value, icon: BookMarked, title: result.nameWithOwner, detail: t(l.notTracked), activate: go };
    default:
      return assertNever(result);
  }
}

function groupOptions(command: Command, options: readonly CommandOption[]): FilterListGroup<Row>[] {
  const grouped: { key: string; heading: string | null; rows: Row[] }[] = [];
  for (const option of options) {
    const heading = option.group ?? null;
    const row: Row = {
      value: `option:${option.value}`,
      icon: null,
      title: option.label,
      detail: option.detail,
      color: option.color,
      avatarUrl: option.avatarUrl,
      chosen: option.chosen,
      activate: () => pick(option),
    };
    const last = grouped.at(-1);
    if (last && last.heading === heading) {
      last.rows.push(row);
    } else {
      grouped.push({ key: `${command.id}:${heading ?? ''}`, heading, rows: [row] });
    }
  }

  return grouped;
}

function runCommand(command: Command) {
  if (command.options) {
    enter(command.id);
    return;
  }

  open.value = false;
  command.run?.();
}

function pick(option: CommandOption) {
  if (!submenuOptions.value?.several) {
    open.value = false;
  }

  option.pick();
}

function enter(commandId: string) {
  const command = props.commands.find(candidate => candidate.id === commandId);
  if (!command?.options) {
    return;
  }

  command.prepare?.();
  submenuId.value = command.id;
  query.value = '';
}

function back() {
  submenuId.value = null;
  query.value = '';
}

// Every pick, the same line twice too, reaches `activate`.
function activate(value: AcceptableValue | AcceptableValue[]) {
  rows.value.find(row => row.value === value)?.activate();
}

/** Tab or → at the end of the text opens the highlighted action's submenu; ⌫ in an empty field steps back. */
function onFilterKeydown(event: KeyboardEvent) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  switch (event.key) {
    case 'Tab':
    case 'ArrowRight': {
      const atEnd = input === null || input.selectionStart === input.value.length;
      const row = rows.value.find(candidate => candidate.value === highlighted.value);
      if (row?.submenu && (event.key === 'Tab' || atEnd)) {
        event.preventDefault();
        row.activate();
      } else if (event.key === 'Tab') {
        // Focus stays in the field: the list is moved through with the arrows.
        event.preventDefault();
      }

      return;
    }
    case 'Backspace':
      if (query.value !== '') {
        return;
      }

      if (submenu.value) {
        event.preventDefault();
        back();
      } else if (subject.value) {
        event.preventDefault();
        subjectRemoved.value = true;
      }
  }
}

function onEscape(event: KeyboardEvent) {
  if (submenu.value) {
    event.preventDefault();
    back();
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="t(l.title)"
    :width="680"
    bare
    fit-content
    @escape-key-down="onEscape"
  >
    <FilterList
      v-model:query="query"
      v-model:highlighted="highlighted"
      :model-value="null"
      :label="submenu ? submenu.title : t(l.title)"
      :groups="groups"
      :placeholder="placeholder"
      :message="message"
      :hints="hints"
      size="lg"
      data-layer
      @update:model-value="activate"
      @filter-keydown="onFilterKeydown"
    >
      <template #beforeFilter>
        <span
          v-if="subject"
          :class="css.commandMenu_chip"
        >
          <component
            :is="subject.kind === 'item' ? CircleDot : Layers"
            :class="css.commandMenu_chipIcon"
            aria-hidden="true"
          />
          {{ subject.label }}
        </span>
        <template v-if="submenu">
          <ChevronRight
            :class="css.commandMenu_crumb"
            aria-hidden="true"
          />
          <span :class="css.commandMenu_chip">{{ submenu.title.replace(/…$/u, '') }}</span>
        </template>
      </template>
      <template #row="{ row }">
        <component
          :is="row.icon"
          v-if="row.icon"
          :class="css.commandMenu_icon"
          aria-hidden="true"
        />
        <span
          v-if="row.color"
          :class="css.commandMenu_dot"
          :style="{ background: `#${row.color}` }"
          aria-hidden="true"
        />
        <Avatar
          v-if="row.avatarUrl"
          :name="row.title"
          :src="row.avatarUrl"
          size="xs"
          decorative
        />
        <span :class="css.commandMenu_title">
          <template v-if="row.lead">{{ row.lead }} → </template>{{ row.title }}
        </span>
        <span
          v-if="row.reference"
          :class="css.commandMenu_reference"
          >{{ row.reference }}</span
        >
        <span
          v-if="row.detail"
          :class="css.commandMenu_detail"
          >{{ row.detail }}</span
        >
        <Check
          v-if="row.chosen"
          :class="css.commandMenu_check"
          :aria-label="t(l.chosen)"
        />
        <span :class="css.commandMenu_spacer" />
        <Kbd
          v-for="(key, index) in row.keys ?? []"
          :key="index"
          :keys="key"
        />
        <ChevronRight
          v-if="row.submenu"
          :class="css.commandMenu_more"
          aria-hidden="true"
        />
      </template>
      <template
        v-if="submenu && submenuOptions?.note"
        #afterList
      >
        <p :class="css.commandMenu_note">
          {{ submenuOptions.note }}
        </p>
      </template>
    </FilterList>
  </Dialog>
</template>

<style lang="scss" module="css">
.commandMenu_chip {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  padding: 3px $spacing-8;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.commandMenu_chipIcon {
  width: 12px;
  height: 12px;
  color: $color-green;
}

.commandMenu_crumb {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.commandMenu_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.commandMenu_dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.commandMenu_title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commandMenu_reference {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commandMenu_detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.commandMenu_check {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-2;
}

.commandMenu_spacer {
  flex: 1;
}

.commandMenu_more {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.commandMenu_note {
  flex: none;
  padding: $spacing-8 $spacing-10;
  font-size: $font-size-sm;
  color: $color-amber;
  border-top: 1px solid $color-border;
}
</style>
