<!-- The command menu (⌘K, E1–E4): one list mixing the actions of what is opened or selected — named by the chip at the left of the field, taken out with ⌫ — the screen's, its repository's and the app's, and places to go and items from the local copy (instant, nothing asked of GitHub). With nothing typed at the top it lists what is in context, "Recent" — up to five projects, repositories and items opened lately, newest first, not the screen shown or the item opened (`navigation.recent`) — and "Go to", which ends with "Repositories…" and "Projects…", each with its count, whose levels list the tracked ones alphabetically; the tracked repositories, the projects and the app's actions — but what the app offers now (`proposed`, D36) — are otherwise found by typing. At most 600px tall on a desktop, its rows scrolling. Typing finds them, and what lies deeper directly, shown with its whole way there (E4: "in prog" → "Set Status → In progress"). ↑/↓ move, Enter runs — or opens a picker, or a level with nothing to run — and Tab or → enter what the line holds, a level of rows or a picker, the way there drawn as crumbs after the chip (hidden inside a place or a repository, which it is not about), a level the chip or a crumb already names not named again. ← or ⌫ in an empty field steps back one level (← only there), at the top ⌫ takes out the subject, then the repository (the screen's repository, whose actions sit under its name, shows as the chip when there is no subject) — kept by the caller (`CommandRegistry`), so the actions that start from them, "Run workflow…" and New issue, then start from neither; Esc steps back one level, or closes. Opened from the phone's command line on a list (`parts`), the top lists the place's parts first under the place's name (mobile D17) — a repository's sections, a project's saved views, My work and its groups, the same rows the menu has elsewhere, then left out there — each with its count, a dot when changed on this device (D49), ↗ when it leaves for github.com (D21) and a check on the one shown; typing finds them where it always does. On a phone (`PhoneLayout.active`, mobile D16) it rises from below as a sheet, its field at the bottom — ⌘, the chip (opened from the command line on a list, that line's own: the part shown, `PhonePartChip`), "Do or find…", × — with no keyboard until the field is tapped (the list holds the focus; a hardware keyboard's keys still type into the field): the groups stack upwards, the first nearest the field, each read downwards, and once something is typed the whole list runs upwards, the best match nearest the field; ↑/↓ follow the screen, and the row nearest the field is highlighted. Inside a level (a picker, MB40) the field finds only what the level holds: a magnifier in it, and over the rows the way back, what the actions act on and the level's title. Its rows and field are at a phone's sizes. No keys are shown there, on the rows or in a footer (D52); while it is open the command line steps aside (D18, the sheet's). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { assert } from '@nzyme/utils/assert.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowUpRight,
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Command as CommandIcon,
  Inbox,
  Layers,
  PencilLine,
  Search,
  Settings,
  SquareKanban,
  Workflow,
  X,
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
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import MatchedText from '@/components/MatchedText.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhonePartChip from '@/shell/PhonePartChip.vue';
import type { Item } from '@/store/ItemTypes.js';

import { buildCommandMenu, resolveMenuPath } from './buildCommandMenu.js';
import type { CommandMenuAncestor, CommandMenuEntry, CommandMenuGroupKey } from './buildCommandMenu.js';
import CommandCrumbs from './CommandCrumbs.vue';
import type { CommandCrumb } from './CommandCrumbs.vue';
import CommandForm from './CommandForm.vue';
import * as l from './CommandMenu.loc.js';
import CommandMenuItem from './CommandMenuItem.vue';
import type {
  Command,
  CommandFormValues,
  CommandMarks,
  CommandOption,
  CommandParts,
  CommandSubject,
} from './CommandTypes.js';
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
    /** The place's parts, listed first under their own heading (the phone's command line, mobile D17). */
    parts?: (() => CommandParts) | null;
  }>(),
  { subject: null, repository: null, startCommandId: null, parts: null },
);

const emit = defineEmits<{
  /** A place, an item or a repository was picked: go there. */
  navigate: [result: NavigationResult];
}>();

const open = defineModel<boolean>('open', { default: false });
/** The subject was taken out of the menu (⌫): kept by the caller, whose actions then act on nothing. */
const subjectRemoved = defineModel<boolean>('subjectRemoved', { default: false });
/** The repository was taken out of the menu (⌫): kept by the caller, whose actions then act on no repository. */
const repositoryRemoved = defineModel<boolean>('repositoryRemoved', { default: false });

/** A line of the list as drawn. */
interface Row extends FilterListRow {
  readonly icon: LucideIcon | null;
  readonly title: string;
  /** In a line found deeper: the levels above it ("Set status"), each before an arrow. */
  readonly ancestors?: readonly CommandMenuAncestor[];
  readonly detail?: string;
  /** Dim text at the line's end. */
  readonly aside?: string;
  /** An issue or pull request found: drawn in two lines of its own (`CommandMenuItem`), in place of the rest. */
  readonly item?: Item;
  /** Quiet text at the footer's end while it is highlighted. */
  readonly hint?: string;
  readonly color?: string;
  readonly avatarUrl?: string;
  readonly keys?: string;
  readonly chosen?: boolean;
  /** A part's (mobile D17): its count, a dot when changed on this device, ↗ when it leaves, a check when shown. */
  readonly marks?: CommandMarks;
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
  projects: SquareKanban,
  repository: BookMarked,
  repositories: BookMarked,
  settings: Settings,
};

/** The most options a submenu draws: one may offer every item of the local copy; typing finds the rest. */
const SUBMENU_LIMIT = 100;

const t = useTranslate();
const phoneLayout = useService(PhoneLayout);
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const query = ref('');
/** The ids of the levels entered, from the top. */
const path = shallowRef<readonly string[]>([]);
const highlighted = shallowRef<string | null>(null);
/** What was entered in each form, by its level's path: it stays while the form is left and while its fields change. */
const formValues = shallowRef<Readonly<Record<string, CommandFormValues>>>({});

/** The place's parts while the menu is open: read as it draws, a count is worked out only then. */
const parts = computed(() => (open.value ? (props.parts?.() ?? null) : null));
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
/** On a phone, opened from the command line on a list: that line's chip, the part shown, at the top level. */
const partChip = computed(() => (phoneLayout.active && props.parts && !step.value ? phoneLayout.part : null));
/** The action whose picker is shown; a level of rows has none. */
const submenu = computed(() => {
  const command = step.value?.command;
  return command?.options ? command : null;
});
const submenuOptions = computed(() => submenu.value?.options?.() ?? null);
/** The key of the form shown in {@link formValues}. */
const formKey = computed(() => step.value?.path.join('/') ?? '');
/** The form shown in place of the list; `null` when a list is shown. */
const form = computed(() => step.value?.command?.form?.(formValues.value[formKey.value] ?? {}) ?? null);
/** The chip, then a crumb per level entered. */
const crumbs = computed((): CommandCrumb[] => {
  const shown: CommandCrumb[] = [];
  if (chip.value) {
    shown.push({ key: 'chip', label: chip.value.label, icon: chip.value.icon, subject: true });
  }

  for (const [index, crumb] of steps.value.entries()) {
    const label = withoutEllipsis(crumb.title);
    // A level named already — the repository in the chip that "Run workflow…" starts in (W36) — is not named again.
    if (shown.some(candidate => candidate.label === label)) {
      continue;
    }

    const search = crumb.command?.search ? crumb.command : null;
    // A search, and an action whose levels are walked into (W36's "▷ Run workflow"), show their icon.
    const iconShown = search ?? (index === 0 && crumb.command?.children ? crumb.command : null);
    const context = index === steps.value.length - 1 ? form.value?.context : undefined;
    shown.push({
      key: crumb.path.at(-1) ?? '',
      label,
      icon: iconShown?.icon,
      detail: shown.some(candidate => candidate.label === context) ? undefined : context,
      arrow: index > 0 || (chip.value !== null && (subject.value !== null || !search)),
    });
  }

  return shown;
});
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
    parts: parts.value,
  }).flatMap(group =>
    group.key === 'level'
      ? groupLevel(group.entries)
      : [{ key: group.key, heading: getHeading(group.key), rows: group.entries.map(toRow) }],
  );
});
/**
 * The groups as drawn. On a phone, from below (mobile D16): the first group nearest the field and the rest above it,
 * each read downwards as on the computer; once something is typed, the whole list upwards, the best match nearest the
 * field. The rows' order in the page is the screen's, so ↑ goes up it.
 */
const shownGroups = computed((): FilterListGroup<Row>[] => {
  if (!phoneLayout.active) {
    return groups.value;
  }

  const upwards = groups.value.toReversed();
  return query.value === '' ? upwards : upwards.map(group => ({ ...group, rows: group.rows.toReversed() }));
});
const rows = computed(() => groups.value.flatMap(group => group.rows));
const highlightedRow = computed(() => rows.value.find(row => row.value === highlighted.value) ?? null);
const placeholder = computed(() =>
  submenu.value
    ? (submenuOptions.value?.placeholder ?? t(l.filterOptions))
    : (step.value?.placeholder ?? (phoneLayout.active ? t(l.doOrFind) : t(l.placeholder))),
);
/** Quiet text at the footer's end: where a picker's options come from, the highlighted line's, a listed line's that can't run, its level's. */
const footerHint = computed(() => {
  if (submenu.value) {
    return submenuOptions.value?.hint;
  }

  const unavailable = rows.value.find(row => row.disabled && row.hint !== undefined);
  return highlightedRow.value?.hint ?? unavailable?.hint ?? step.value?.command?.levelHint;
});
const message = computed(() => {
  if (rows.value.length > 0) {
    return null;
  }

  const options = submenuOptions.value;
  const levelMessage = query.value === '' ? step.value?.command?.message : undefined;
  return options?.message ?? levelMessage ?? (options?.loading ? t(l.loading) : t(l.noMatch));
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
      formValues.value = {};
      if (props.startCommandId) {
        enterLevel([props.startCommandId]);
      }
    }
  },
  { immediate: true },
);

// What a level offers may still have to be read, coming back to it too; a registration recomputing is no new level.
watch(
  () => (open.value && step.value ? step.value.path.join('/') : null),
  key => {
    if (key !== null) {
      step.value?.command?.prepare?.();
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
    case 'parts':
      return parts.value?.heading ?? null;
    case 'subject':
      return subject.value?.title ?? null;
    case 'view':
      return t(l.view);
    case 'repository':
      return repository.value;
    case 'recent':
      return t(l.recent);
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
      if (command.unavailable !== undefined) {
        return {
          value: entry.id,
          icon: command.icon ?? Zap,
          title: command.title,
          detail: command.unavailable,
          aside: t(l.cantRun),
          hint: command.hint,
          ancestors: entry.ancestors,
          match: entry.match,
          disabled: true,
          activate: () => {},
        };
      }

      const enter =
        command.options || command.children || command.form ? () => enterLevel(getEnteredPath(entry)) : undefined;
      return {
        value: entry.id,
        icon: command.icon ?? Zap,
        title: command.title,
        detail: command.detail,
        keys: command.key,
        marks: command,
        hint: command.hint,
        ancestors: entry.ancestors,
        match: entry.match,
        activate: enter && (command.options || command.form || !command.run) ? enter : () => runCommand(command),
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
    case 'navigation': {
      const enter = entry.path.length > 0 ? () => enterLevel(entry.path) : undefined;
      const row = toNavigationRow(entry.id, entry.result);
      // A place that is only a level (Repositories…) has nowhere to go: Enter opens it.
      const levelOnly = entry.result.kind === 'place' && entry.result.place.path === undefined;
      return { ...row, activate: levelOnly && enter ? enter : row.activate, enter };
    }
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
        keys: place.key,
        marks: place,
        match: result.match,
        activate: go,
      };
    }
    case 'item': {
      const { item } = result;
      return {
        value,
        icon: null,
        title: item.title,
        item,
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

/** A level's rows under their headings, each heading where its first row is; a row found deeper has none. */
function groupLevel(entries: readonly CommandMenuEntry[]): FilterListGroup<Row>[] {
  const grouped = new Map<string | null, Row[]>();
  for (const entry of entries) {
    const heading = entry.kind === 'command' && entry.ancestors.length === 0 ? (entry.command.group ?? null) : null;
    const headed = grouped.get(heading) ?? [];
    headed.push(toRow(entry));
    grouped.set(heading, headed);
  }

  return [...grouped].map(([heading, headed]) => ({
    key: heading === null ? 'level' : `level:${heading}`,
    heading,
    rows: headed,
  }));
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

/** Where entering a line goes: its own level, or straight into the child it starts at. */
function getEnteredPath(entry: CommandMenuEntry): readonly string[] {
  const start = entry.kind === 'command' ? entry.command.start : undefined;
  const id = entry.path.at(-1);
  return start === undefined || id === undefined ? entry.path : [...entry.path, `${id}/${start}`];
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

function setFormValues(values: CommandFormValues) {
  formValues.value = { ...formValues.value, [formKey.value]: values };
}

function submitForm(values: CommandFormValues) {
  const shown = form.value;
  open.value = false;
  shown?.submit(values);
}

function enterLevel(target: readonly string[]) {
  path.value = target;
  query.value = '';
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

/** On a phone the field is not focused as the menu opens, which would bring up the keyboard (mobile D16): the list takes the focus. */
function onOpenAutoFocus(event: Event) {
  if (phoneLayout.active && !form.value) {
    event.preventDefault();
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
    :max-height="600"
    :edge="phoneLayout.active ? 'bottom' : undefined"
    bare
    fit-content
    @escape-key-down="onEscape"
    @open-auto-focus="onOpenAutoFocus"
  >
    <CommandForm
      v-if="form && step"
      :key="formKey"
      :form="form"
      :label="step.title"
      :values="formValues[formKey] ?? {}"
      @update:values="setFormValues"
      @submit="submitForm"
    >
      <template #crumbs>
        <CommandCrumbs :crumbs="crumbs" />
      </template>
    </CommandForm>
    <FilterList
      v-else
      v-model:query="query"
      v-model:highlighted="highlighted"
      :model-value="null"
      :label="step ? step.title : t(l.title)"
      :groups="shownGroups"
      :placeholder="placeholder"
      :message="message"
      :message-heading="submenuOptions?.heading"
      :hints="phoneLayout.active ? undefined : hints"
      :from-below="phoneLayout.active"
      :class="phoneLayout.active && css.commandMenu_phone"
      size="lg"
      data-layer
      @update:model-value="activate"
      @filter-keydown="onFilterKeydown"
    >
      <template
        v-if="phoneLayout.active && step"
        #header
      >
        <div :class="css.commandMenu_stepHead">
          <IconButton
            :icon="ChevronLeft"
            :label="t(l.back)"
            @click="back"
          />
          <span
            v-if="chip"
            :class="css.commandMenu_stepChip"
            >{{ chip.label }}</span
          >
          <span :class="css.commandMenu_stepTitle">{{ withoutEllipsis(step.title) }}</span>
        </div>
      </template>
      <template #beforeFilter>
        <Search
          v-if="phoneLayout.active && step"
          :class="css.commandMenu_search"
          aria-hidden="true"
        />
        <template v-else-if="phoneLayout.active">
          <CommandIcon
            :class="css.commandMenu_key"
            aria-hidden="true"
          />
          <PhonePartChip
            v-if="partChip"
            :part="partChip"
          />
          <CommandCrumbs
            v-else
            :crumbs="crumbs"
          />
        </template>
        <CommandCrumbs
          v-else
          :crumbs="crumbs"
        />
      </template>
      <template
        v-if="phoneLayout.active && !step"
        #afterFilter
      >
        <IconButton
          :icon="X"
          :label="t(l.close)"
          @click="open = false"
        />
      </template>
      <template #row="{ row }">
        <CommandMenuItem
          v-if="row.item"
          :item="row.item"
          :match="row.match ?? null"
        />
        <template v-else>
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
            v-if="row.marks?.count != null"
            :class="css.commandMenu_count"
            >{{ numbers.format(row.marks.count) }}</span
          >
          <ChevronRight
            v-if="row.enter"
            :class="css.commandMenu_more"
            aria-hidden="true"
          />
          <span
            v-if="row.marks?.changed"
            :class="css.commandMenu_changed"
            role="img"
            :aria-label="t(l.changed)"
          />
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
          <ArrowUpRight
            v-if="row.marks?.external"
            :class="css.commandMenu_external"
            :aria-label="t(l.external)"
          />
          <Check
            v-if="row.marks?.current"
            :class="css.commandMenu_current"
            :aria-label="t(l.chosen)"
          />
          <Kbd
            v-if="row.keys && !phoneLayout.active"
            :keys="row.keys"
          />
        </template>
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
        v-if="footerHint"
        #footerEnd
      >
        {{ footerHint }}
      </template>
    </FilterList>
  </Dialog>
</template>

<style lang="scss" module="css">
// ⌘ at the start of a phone's field, as on its command line.
.commandMenu_key {
  flex: none;
  width: 20px;
  height: 20px;
  color: $color-accent;
}

// A level's field on a phone finds only what the level holds (MB40).
.commandMenu_search {
  flex: none;
  width: $phone-row-icon-size;
  height: $phone-row-icon-size;
  color: $color-fg-dim;
}

// Over a level's rows on a phone: back, what the actions act on, the level's title (MB40).
.commandMenu_stepHead {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  min-height: $touch-target-size;
  padding: $spacing-4 $spacing-10 $spacing-4 $spacing-4;
  font-size: $font-size-xl;
  border-bottom: 1px solid $color-border;
}

.commandMenu_stepChip {
  flex: none;
  color: $color-fg-2;
}

.commandMenu_stepTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

// A phone's rows: their icons at its size (MB223).
.commandMenu_phone .commandMenu_icon {
  width: $phone-row-icon-size;
  height: $phone-row-icon-size;
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

.commandMenu_detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

// A place's count follows its title (D41).
.commandMenu_count {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-dim;
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

.commandMenu_changed {
  flex: none;
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.commandMenu_external {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-dim;
}

.commandMenu_current {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-accent;
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
