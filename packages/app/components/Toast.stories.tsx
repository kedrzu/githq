import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ArrowUpRight, CircleCheckBig, EyeOff, Undo2 } from 'lucide-vue-next';
import { defineComponent, onScopeDispose, ref } from 'vue';

import { StoryPage } from '@/.storybook/StoryLayout.jsx';
import type { Command } from '@/commands/CommandTypes.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';

import Button from './Button.vue';
import TextField from './TextField.vue';
import Toast from './Toast.vue';
import Toaster from './Toaster.vue';

const meta = {
    component: Toast,
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts a focus guard on each side of it — empty, `aria-hidden`, focusable —
                // that hands focus on to the toasts or out of them (F8). axe flags them; they hide nothing. Only
                // they are left out: every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** K1: a label GitHub refused — which edit, why, and the way to GitHub's labels. */
export const EditRejected: Story = {
    args: { title: 'Label “regression” wasn’t added to skyline-labs/portal#1187' },
    render: args =>
        defineComponent({
            setup() {
                const dismissed = ref(0);
                const escapes = ref(0);
                const note = ref('');
                // What the screen behind sees of Escape: an opened item would close on it.
                const onKey = (event: KeyboardEvent) => {
                    if (event.key === 'Escape') {
                        escapes.value++;
                    }
                };
                window.addEventListener('keydown', onKey);
                onScopeDispose(() => window.removeEventListener('keydown', onKey));

                return () => (
                    <StoryPage>
                        <TextField
                            label="Note"
                            modelValue={note.value}
                            onUpdate:modelValue={value => (note.value = String(value ?? ''))}
                        />
                        <span tid="dismissed">Dismissed: {dismissed.value}</span>
                        <span tid="escapes">Escapes seen behind: {escapes.value}</span>
                        <Toaster>
                            <Toast
                                {...args}
                                lasts="pinned"
                                onDismiss={() => dismissed.value++}
                            >
                                {{
                                    default: () =>
                                        'GitHub refused it: the label no longer exists in skyline-labs/portal. The label was removed again.',
                                    actions: () => (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={ArrowUpRight}
                                            link="https://github.com/skyline-labs/portal/labels"
                                        >
                                            Open labels on GitHub
                                        </Button>
                                    ),
                                }}
                            </Toast>
                        </Toaster>
                    </StoryPage>
                );
            },
        }),
};

/** Code review's discarded comment (CR98): Escape stays the screen's, so Dismiss has no key and Escape leaves it up. */
export const LeavesEscape: Story = {
    ...EditRejected,
    args: { ...EditRejected.args, dismissOnEscape: false },
};

/** K2: one of three items failed; the others went through. */
export const PartlyFailed: Story = {
    args: { title: '“q4-release” added to 2 of 3 items', tone: 'warning' },
    render: args => ({
        components: { Toast, Toaster },
        setup: () => ({ args }),
        template: `<Toaster><Toast v-bind="args" lasts="pinned">mobile#88 failed: you can read skyline-labs/mobile but not edit its labels, so that change was undone.</Toast></Toaster>`,
    }),
};

/** PM34: a merge GitHub confirmed after the user moved on — quiet, in the merged tone, and gone by itself. */
export const MergeConfirmed: Story = {
    args: { title: 'fitloop/api#477 merged into main', tone: 'done' },
    render: args => ({
        components: { Toast, Toaster },
        setup: () => ({ args }),
        template: `<Toaster><Toast v-bind="args" lasts="pinned" /></Toaster>`,
    }),
};

/** T20: nothing went wrong: what the user just did, with the way back. */
export const Neutral: Story = {
    args: { title: 'Stopped tracking fitloop/api', tone: 'neutral', icon: EyeOff },
    render: args => ({
        components: { Button, Toast, Toaster },
        setup: () => ({ args }),
        template: `<Toaster><Toast v-bind="args" lasts="pinned">Its copy in this browser goes when this closes.<template #actions><Button variant="secondary" size="sm" kbd="Mod+Z">Undo</Button></template></Toast></Toaster>`,
    }),
};

/** Props of the `Lifetimes` story. */
interface LifetimesArgs {
    /** Whether the toasts are open from the start; else "Show" opens them. */
    shown: boolean;
}

/** The three lifetimes: brief (6 s) and long (10 s) count down in the ring around the ×, pinned stays and has none. */
export const Lifetimes: StoryObj<LifetimesArgs> = {
    args: { shown: true },
    render: args => ({
        components: { Button, StoryPage, Toast, Toaster },
        setup: () => ({ shown: ref(args.shown), CircleCheckBig }),
        template: `<StoryPage>
            <Button variant="secondary" @click="shown = true">Show</Button>
            <Toaster v-if="shown">
                <Toast title="fitloop/api#477 merged into main" tone="done" lasts="brief" />
                <Toast title="Closed skyline-labs/portal#1187" tone="neutral" :icon="CircleCheckBig" lasts="long">
                    <template #actions><Button variant="secondary" size="sm">Undo</Button></template>
                </Toast>
                <Toast title="Syncing settings stopped" tone="warning" lasts="pinned">
                    GitHub refused the settings gist: the token can no longer write gists.
                </Toast>
            </Toaster>
        </StoryPage>`,
    }),
};

/** Props of the `Stack` story. */
interface StackArgs {
    /** Whether "Stopped tracking" is open from the start; else "Stop tracking" opens it, after the close. */
    untrackOpen: boolean;
}

const UNDO_KEY = 'Mod+Z';

/**
 * Two toasts on one key (⌘Z): the newest, at the bottom, takes the keys and shows them; the older one's buttons still
 * click. "Stopped tracking" comes first in the markup, so opening it later shows arrival beats markup.
 */
export const Stack: StoryObj<StackArgs> = {
    args: { untrackOpen: true },
    render: args =>
        defineComponent({
            setup() {
                const untrackOpen = ref(args.untrackOpen);
                const closeOpen = ref(true);
                const undone = ref<string[]>([]);
                const untrackCommands: readonly Command[] = [
                    command('story.undoUntrack', () => undone.value.push('untrack')),
                ];
                const closeCommands: readonly Command[] = [
                    command('story.undoClose', () => undone.value.push('close')),
                ];

                return () => (
                    <StoryPage>
                        <Button
                            variant="secondary"
                            onClick={() => (untrackOpen.value = true)}
                        >
                            Stop tracking
                        </Button>
                        <span tid="undone">Undone: {undone.value.join(', ') || 'nothing'}</span>
                        <Toaster>
                            <Toast
                                title="Stopped tracking fitloop/api"
                                tone="neutral"
                                icon={EyeOff}
                                lasts="pinned"
                                commands={untrackCommands}
                                open={untrackOpen.value}
                                onUpdate:open={value => (untrackOpen.value = value)}
                            >
                                {{
                                    default: () => 'Its copy in this browser goes when this closes.',
                                    actions: ({ active }: { active: boolean }) => undoButton(active, 'untrack'),
                                }}
                            </Toast>
                            <Toast
                                title="Closed skyline-labs/portal#1187"
                                tone="neutral"
                                icon={CircleCheckBig}
                                lasts="pinned"
                                commands={closeCommands}
                                open={closeOpen.value}
                                onUpdate:open={value => (closeOpen.value = value)}
                            >
                                {{ actions: ({ active }: { active: boolean }) => undoButton(active, 'close') }}
                            </Toast>
                        </Toaster>
                    </StoryPage>
                );

                function undoButton(active: boolean, what: string) {
                    return (
                        <Button
                            variant="secondary"
                            size="sm"
                            kbd={active ? UNDO_KEY : undefined}
                            keyshortcuts={active ? formatAriaKeyShortcuts(UNDO_KEY) : undefined}
                            onClick={() => undone.value.push(what)}
                        >
                            Undo
                        </Button>
                    );
                }
            },
        }),
};

function command(id: string, run: () => void): Command {
    return { id, title: 'Undo', section: 'app', key: UNDO_KEY, icon: Undo2, menu: false, run };
}
