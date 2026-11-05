<!-- The command menu (⌘K, E1–E4): one list mixing the actions of what is opened or selected — named by the chip at the left of the field, taken out with ⌫ — the screen's, its repository's and the app's, and places to go and items from the local copy (instant, nothing asked of GitHub). Typing finds them, and what lies deeper directly, shown with its whole way there (E4: "in prog" → "Set Status → In progress"). ↑/↓ move, Enter runs — or opens a picker, or a level with nothing to run — and Tab or → enter what the line holds, a level of rows or a picker, the way there drawn as crumbs after the chip (hidden inside a place or a repository, which it is not about). ← or ⌫ in an empty field steps back one level (← only there), at the top ⌫ takes out the subject, then the repository (the screen's repository, whose actions sit under its name, shows as the chip when there is no subject); Esc steps back one level, or closes. -->
<script lang="ts" setup>
import { assert } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  BookMarked,
  Check,
  ChevronRight,
  CircleDot,
  GitPullRequest,
  Inbox,
  Layers,
  PencilLine,
  Settings,
  SquareKanban,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { computed, ref, shallowRef, watch } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Dialog from '@/components/Dialog.vue';
import FilterList from '@/components/FilterList.vue';
import type { FilterListGroup, FilterListHint, FilterListRow } from '@/components/FilterList.vue';
import { filterOptions } from '@/components/filterOptions.js';
import type { FoundOption } from '@/components/filterOptions.js';
import Kbd from '@/components/Kbd.vue';
import MatchedText from '@/components/MatchedText.vue';
import { formatShortReference } from '@/item/itemRoutes.js';

import { buildCommandMenu, resolveMenuPath } from './buildCommandMenu.js';
import type { CommandMenuAncestor, CommandMenuEntry, CommandMenuGroupKey } from './buildCommandMenu.js';
import * as l from './CommandMenu.loc.js';
import type { Command, CommandOption, CommandSubject } from './CommandTypes.js';
import type { CommandMenuMatch } from './findMenuRows.js';
import type { NavigationData, NavigationPlace, NavigationResult } from './searchNavigation.js';

const props = withDefaults(
  defineProps<{
    /** Every action registered now. */
    commands: readonly Command[];
    /** What the actions act on: the chip. */
    subject?: CommandSubject | null;
    /** The repository (`owner/name`) the screen belongs to: a chip after the subject's, its actions under its name. */
    repository?: string | null;
    /** Where places and items are found. */
    navigation: NavigationData;
    /** Opens in this action's submenu (its key was pressed, and it has no other way to run). */
    startCommandId?: string | null;
  }>(),
  { subject: null, repository: null, startCommandId: null },
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
  /** In a line found deeper: the levels above it ("Set status"), each before an arrow. */
  readonly ancestors?: readonly CommandMenuAncestor[];
  readonly detail?: string;
  /** Dim text at the line's end. */
  readonly aside?: string;
  /** Monospaced dim text: an item's reference. */
  readonly reference?: string;
  readonly color?: string;
  readonly avatarUrl?: string;
  readonly keys?: readonly string[];
  readonly chosen?: boolean;
  /** What typed text matched on the line: drawn marked, a `hidden` word only because of it. */
  readonly match?: CommandMenuMatch | null;
  /** Enter. */
  activate(): void;
  /** Tab or →, on a line with a submenu. */
  enter?: () => void;
}

const PLACE_ICONS: Readonly<Record<NavigationPlace['kind'], LucideIcon>> = {
  draftReviews: PencilLine,
  myWork: Inbox,
  workflows: Workflow,
  project: SquareKanban,
  repository: BookMarked,
  settings: Settings,
};

/** The most options a submenu draws: one may offer every item of the local copy; typing finds the rest. */
const SUBMENU_LIMIT = 100;

const t = useTranslate();
const query = ref('');
const subjectRemoved = ref(false);
const repositoryRemoved = ref(false);
/** The ids of the levels entered, from the top. */
const path = shallowRef<readonly string[]>([]);
const highlighted = shallowRef<string | null>(null);

/** What the actions act on: `null` once the user took it out (⌫). */
const subject = computed(() => (subjectRemoved.value ? null : props.subject));
/** The repository the actions belong to: `null` once the user took it out (⌫). */
const repository = computed(() => (repositoryRemoved.value ? null : props.repository));
const steps = computed(() =>
  resolveMenuPath({ path: path.value, commands: props.commands, navigation: props.navigation }),
);
/** The level shown; `null` at the top. */
const step = computed(() => steps.value.at(-1) ?? null);
/** What the chip names: the subject, else the repository; nothing inside a place or a repository, which it is not about. */
const chip = computed(() => {
  if (steps.value[0]?.command === null) {
    return null;
  }

  if (subject.value) {
    return { icon: subject.value.kind === 'item' ? CircleDot : Layers, label: subject.value.label };
  }

  return repository.value ? { icon: BookMarked, label: repository.value } : null;
});
/** The action whose picker is shown; a level of rows has none. */
const submenu = computed(() => {
  const command = step.value?.command;
  return command?.options ? command : null;
});
const submenuOptions = computed(() => submenu.value?.options?.() ?? null);
/** The action being searched in, while the menu is open: only it is told what is typed. */
const searching = computed(() => (open.value && submenu.value?.search ? submenu.value : null));

const groups = computed((): FilterListGroup<Row>[] => {
  const command = submenu.value;
  const options = submenuOptions.value;
  if (command && options) {
    // What a search offers is what it answered, whether or not the typed letters are in it (`org:acme`).
    const found = filterOptions(command.search ? '' : query.value, options.options).slice(0, SUBMENU_LIMIT);
    return groupOptions(command, found, options.heading ?? null);
  }

  return buildCommandMenu({
    query: query.value,
    commands: props.commands,
    subject: subject.value,
    repository: repository.value,
    navigation: props.navigation,
    level: step.value,
  }).map(group => ({
    key: group.key,
    heading: getHeading(group.key),
    rows: group.entries.map(toRow),
  }));
});
const rows = computed(() => groups.value.flatMap(group => group.rows));
const highlightedRow = computed(() => rows.value.find(row => row.value === highlighted.value) ?? null);
const placeholder = computed(() =>
  submenu.value ? (submenuOptions.value?.placeholder ?? t(l.filterOptions)) : t(l.placeholder),
);
const message = computed(() => {
  if (rows.value.length > 0) {
    return null;
  }

  const options = submenuOptions.value;
  return options?.message ?? (options?.loading ? t(l.loading) : t(l.noMatch));
});
const hints = computed((): FilterListHint[] => {
  const leaving: FilterListHint[] = [
    { keys: 'ArrowLeft', label: t(l.back) },
    { keys: 'Escape', label: t(l.close) },
  ];
  if (submenu.value) {
    if (!submenu.value.search) {
      return [{ keys: 'Enter', label: t(l.set) }, ...leaving];
    }

    // What a search found is gone to, and until it answers there is nothing to pick.
    return rows.value.length > 0 ? [{ keys: 'Enter', label: t(l.open) }, ...leaving] : leaving;
  }

  const running: FilterListHint[] = [{ keys: 'Enter', label: t(l.run) }];
  if (highlightedRow.value?.enter) {
    running.push({ keys: 'ArrowRight', label: t(l.openSubmenu) });
  }

  if (step.value) {
    return [...running, ...leaving];
  }

  const shown: FilterListHint[] = [...running, { keys: '>', label: t(l.commandsOnly) }];
  if (chip.value) {
    shown.push({ keys: 'Backspace', label: t(l.removeContext) });
  }

  return shown;
});

watch(
  open,
  isOpen => {
    if (isOpen) {
      query.value = '';
      subjectRemoved.value = false;
      repositoryRemoved.value = false;
      path.value = [];
      if (props.startCommandId) {
        enterLevel([props.startCommandId]);
      }
    }
  },
  { immediate: true },
);

// A registration recomputing makes a new object of the same action, which is told the same text: not a leaving.
watch([searching, query], ([command, text], [before]) => {
  if (before && before.id !== command?.id) {
    before.search?.('');
  }

  command?.search?.(text);
});

function getHeading(key: CommandMenuGroupKey): string | null {
  switch (key) {
    case 'subject':
      return subject.value?.title ?? null;
    case 'view':
      return t(l.view);
    case 'repository':
      return repository.value;
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
      const enter = command.options || command.children ? () => enterLevel(entry.path) : undefined;
      return {
        value: entry.id,
        icon: command.icon ?? Zap,
        title: command.title,
        detail: command.detail,
        keys: command.key?.split('+'),
        ancestors: entry.ancestors,
        match: entry.match,
        activate: enter && (command.options || !command.run) ? enter : () => runCommand(command),
        enter,
      };
    }
    case 'option': {
      const { command, option } = entry;
      return {
        value: entry.id,
        icon: command.icon ?? Zap,
        ancestors: entry.ancestors,
        title: option.label,
        // Which project's: two projects may offer one value.
        detail: [option.group, option.detail].filter(text => text !== undefined).join(' · ') || undefined,
        color: option.color,
        avatarUrl: option.avatarUrl,
        chosen: option.chosen,
        match: entry.match,
        activate: () => pick(option),
      };
    }
    case 'navigation':
      return {
        ...toNavigationRow(entry.id, entry.result),
        enter: entry.path.length > 0 ? () => enterLevel(entry.path) : undefined,
      };
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
      return {
        value,
        icon: PLACE_ICONS[place.kind],
        title: place.title,
        detail: place.detail,
        keys: place.key?.split('+'),
        match: result.match,
        activate: go,
      };
    }
    case 'item': {
      const { item } = result;
      return {
        value,
        icon: item.kind === 'issue' ? CircleDot : GitPullRequest,
        title: item.title,
        reference: formatShortReference(item),
        match: result.match,
        activate: go,
      };
    }
    case 'repository':
      return { value, icon: BookMarked, title: result.nameWithOwner, detail: t(l.notTracked), activate: go };
    default:
      return assertNever(result);
  }
}

function groupOptions(
  command: Command,
  found: readonly FoundOption<CommandOption>[],
  fallbackHeading: string | null,
): FilterListGroup<Row>[] {
  const grouped: { key: string; heading: string | null; rows: Row[] }[] = [];
  for (const foundOption of found) {
    const { option } = foundOption;
    const heading = option.group ?? fallbackHeading;
    const row: Row = {
      value: `option:${option.value}`,
      // A repository's visibility; another action's options stay without theirs, as they always were here.
      icon: command.search ? (option.icon ?? null) : null,
      title: option.label,
      detail: option.detail,
      aside: option.aside,
      color: option.color,
      avatarUrl: option.avatarUrl,
      chosen: option.chosen,
      match: toOptionMatch(foundOption),
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

function toOptionMatch({ option, field, ranges }: FoundOption<CommandOption>): CommandMenuMatch | null {
  switch (field) {
    case 'label':
      return { field: 'title', text: option.label, ranges };
    case 'detail':
      assert(option.detail);
      return { field: 'detail', text: option.detail, ranges };
    case null:
      return null;
    default:
      return assertNever(field);
  }
}

function getRanges(row: Row, field: CommandMenuMatch['field']) {
  return row.match?.field === field ? row.match.ranges : null;
}

function withoutEllipsis(title: string) {
  return title.replace(/…$/u, '');
}

function runCommand(command: Command) {
  open.value = false;
  command.run?.();
}

function pick(option: CommandOption) {
  if (!submenuOptions.value?.several) {
    open.value = false;
  }

  option.pick();
}

function enterLevel(target: readonly string[]) {
  path.value = target;
  query.value = '';
  step.value?.command?.prepare?.();
}

/** One level up, from the level shown: ids of levels no longer there go with it. */
function back() {
  path.value = steps.value.at(-2)?.path ?? [];
  query.value = '';
}

// Every pick, the same line twice too, reaches `activate`.
function activate(value: AcceptableValue | AcceptableValue[]) {
  rows.value.find(row => row.value === value)?.activate();
}

/** Tab or → at the end of the text enters the highlighted line's submenu; ← or ⌫ in an empty field steps back one level (← only there: with text it moves the caret, and the top level's chip stays ⌫'s). */
function onFilterKeydown(event: KeyboardEvent) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  switch (event.key) {
    case 'Tab':
    case 'ArrowRight': {
      const atEnd = input === null || input.selectionStart === input.value.length;
      const row = highlightedRow.value;
      if (row?.enter && (event.key === 'Tab' || atEnd)) {
        event.preventDefault();
        row.enter();
      } else if (event.key === 'Tab') {
        // Focus stays in the field: the list is moved through with the arrows.
        event.preventDefault();
      }

      return;
    }
    case 'ArrowLeft':
      if (query.value === '' && step.value) {
        event.preventDefault();
        back();
      }

      return;
    case 'Backspace':
      if (query.value !== '') {
        return;
      }

      if (step.value) {
        event.preventDefault();
        back();
      } else if (subject.value) {
        event.preventDefault();
        subjectRemoved.value = true;
      } else if (repository.value) {
        event.preventDefault();
        repositoryRemoved.value = true;
      }
  }
}

function onEscape(event: KeyboardEvent) {
  if (step.value) {
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
      :label="step ? step.title : t(l.title)"
      :groups="groups"
      :placeholder="placeholder"
      :message="message"
      :message-heading="submenuOptions?.heading"
      :hints="hints"
      size="lg"
      data-layer
      @update:model-value="activate"
      @filter-keydown="onFilterKeydown"
    >
      <template #beforeFilter>
        <span
          v-if="chip"
          :class="css.commandMenu_chip"
        >
          <component
            :is="chip.icon"
            :class="css.commandMenu_chipIcon"
            aria-hidden="true"
          />
          {{ chip.label }}
        </span>
        <template
          v-for="(crumb, index) in steps"
          :key="crumb.path.at(-1)"
        >
          <ChevronRight
            v-if="index > 0 || (chip && (subject || !crumb.command?.search))"
            :class="css.commandMenu_crumb"
            aria-hidden="true"
          />
          <span :class="css.commandMenu_chip">
            <component
              :is="crumb.command.icon"
              v-if="crumb.command?.search && crumb.command.icon"
              :class="css.commandMenu_chipSearchIcon"
              aria-hidden="true"
            />
            {{ withoutEllipsis(crumb.title) }}
          </span>
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
          <template
            v-for="(ancestor, index) in row.ancestors ?? []"
            :key="index"
            ><MatchedText
              :text="withoutEllipsis(ancestor.title)"
              :ranges="ancestor.ranges"
            />
            → </template
          ><MatchedText
            :text="row.title"
            :ranges="getRanges(row, 'title')"
          />
        </span>
        <span
          v-if="row.match?.field === 'hidden'"
          :class="css.commandMenu_detail"
        >
          <MatchedText
            :text="row.match.text"
            :ranges="row.match.ranges"
          />
        </span>
        <span
          v-if="row.reference"
          :class="css.commandMenu_reference"
        >
          <MatchedText
            :text="row.reference"
            :ranges="getRanges(row, 'reference')"
          />
        </span>
        <span
          v-if="row.detail"
          :class="css.commandMenu_detail"
        >
          <MatchedText
            :text="row.detail"
            :ranges="getRanges(row, 'detail')"
          />
        </span>
        <Check
          v-if="row.chosen"
          :class="css.commandMenu_check"
          :aria-label="t(l.chosen)"
        />
        <span :class="css.commandMenu_spacer" />
        <span
          v-if="row.aside"
          :class="css.commandMenu_aside"
          >{{ row.aside }}</span
        >
        <Kbd
          v-for="(key, index) in row.keys ?? []"
          :key="index"
          :keys="key"
        />
        <ChevronRight
          v-if="row.enter"
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
      <template
        v-if="submenu && submenuOptions?.hint"
        #footerEnd
      >
        {{ submenuOptions.hint }}
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

.commandMenu_chipSearchIcon {
  width: 13px;
  height: 13px;
  color: $color-fg-2;
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

.commandMenu_aside {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-dim;
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
