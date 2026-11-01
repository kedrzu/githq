import type { IssueForm } from '@githq/github/issueForms/parseIssueForm.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, defineComponent, ref } from 'vue';
import type { PropType } from 'vue';

import type { PickerOption } from '@/components/Picker.vue';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { SAMPLE_PORTAL_METADATA } from '@/testing/sampleRepositories.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { buildIssueFormBody } from './buildIssueFormBody.js';
import { findMissingFormFields } from './findMissingFormFields.js';
import type { IssueTemplate, RepositoryTemplates } from './IssueTemplateStore.js';
import type { NewIssueDraft } from './NewIssueComposer.js';
import NewIssueDialog from './NewIssueDialog.vue';
import type { NewIssueRepositoryState, NewIssueWaitingEntry } from './NewIssueDialog.vue';
import type { RepositoryChoiceSection } from './RepositoryChooser.vue';

const EMPTY: NewIssueDraft = {
    repository: 'skyline-labs/portal',
    title: '',
    body: '',
    assignees: [],
    labels: [],
    milestone: null,
    issueType: null,
    parent: null,
    projects: [],
    form: null,
};

const BUG_FORM: IssueForm = {
    filename: 'bug_report.yml',
    name: 'Bug report',
    description: 'Create a report to help us improve',
    title: null,
    labels: ['bug'],
    assignees: [],
    type: null,
    fields: [
        {
            kind: 'textarea',
            label: 'What happened',
            description: null,
            required: true,
            placeholder: 'What happened?',
            value: null,
        },
        {
            kind: 'dropdown',
            label: 'Browser',
            description: null,
            required: true,
            options: ['Chrome', 'Safari', 'Firefox'],
        },
    ],
};

const VITE_METADATA: RepositoryMetadata = {
    ...SAMPLE_PORTAL_METADATA,
    nameWithOwner: 'vitejs/vite',
    id: 'R_vite',
    viewerPermission: 'READ',
};

const VITE_TEMPLATES: RepositoryTemplates = {
    nameWithOwner: 'vitejs/vite',
    blankIssuesEnabled: false,
    templates: [
        { kind: 'form', form: { ...BUG_FORM, name: 'Bug report' } },
        {
            kind: 'markdown',
            filename: 'docs.md',
            name: 'Documentation',
            about: 'Something in the docs is wrong or missing',
            title: 'docs: ',
            body: '### What is wrong\n\n',
            labels: ['documentation'],
            assignees: [],
            type: null,
        },
    ],
    fetchedAt: 0,
};

const CHOICES: readonly RepositoryChoiceSection[] = [
    {
        key: 'tracked',
        heading: 'Tracked',
        choices: [{ nameWithOwner: 'skyline-labs/api', isPrivate: true, detail: '96 open' }],
    },
    {
        key: 'others',
        heading: 'Other repositories you can create issues in',
        choices: [
            { nameWithOwner: 'skyline-labs/api-gateway', isPrivate: true, detail: 'private' },
            { nameWithOwner: 'stripe/stripe-node', isPrivate: false, detail: 'public' },
        ],
    },
    {
        key: 'unavailable',
        heading: "Won't take an issue",
        choices: [
            {
                nameWithOwner: 'skyline-labs/api-v1',
                isPrivate: true,
                unavailable: 'Archived repositories are read-only',
            },
        ],
    },
];

const PROJECTS: readonly PickerOption[] = [{ value: 'PVT_q4', label: 'Platform Q4', detail: 'skyline-labs' }];
const PARENTS: readonly PickerOption[] = [
    { value: 'I_1187', label: 'Recurring bookings ignore the team timezone', detail: 'portal#1187' },
];

/**
 * The capture as the composer drives it: what it asks for is written out under it (`created`, `template`), and a
 * create closes it — or, "create another", clears the title — as the composer does.
 */
const Harness = defineComponent({
    props: {
        draft: { type: Object as PropType<NewIssueDraft>, default: () => EMPTY },
        repository: {
            type: Object as PropType<NewIssueRepositoryState>,
            default: (): NewIssueRepositoryState => ({
                kind: 'ready',
                metadata: SAMPLE_PORTAL_METADATA,
                isPrivate: true,
            }),
        },
        templates: { type: Object as PropType<RepositoryTemplates | null>, default: null },
        form: { type: Object as PropType<IssueForm | null>, default: null },
        rejection: { type: String as PropType<string | null>, default: null },
        contextHint: { type: String as PropType<string | null>, default: 'last used repository' },
        waiting: { type: Array as PropType<readonly NewIssueWaitingEntry[]>, default: () => [] },
    },
    setup(props) {
        const open = ref(true);
        const draft = ref<NewIssueDraft>(props.draft);
        const query = ref('');
        const created = ref('Nothing created');
        const createdCount = ref(0);
        const template = ref('No template');
        const missing = computed(() => (props.form ? findMissingFormFields(props.form, draft.value.body) : []));
        // A repository chosen in the chooser is ready at once, as one read before.
        const repository = computed((): NewIssueRepositoryState => {
            const name = draft.value.repository;
            if (name === null) {
                return { kind: 'none' };
            }

            return props.repository.kind === 'none'
                ? { kind: 'ready', metadata: { ...SAMPLE_PORTAL_METADATA, nameWithOwner: name }, isPrivate: true }
                : props.repository;
        });

        return () => (
            <div style={{ padding: '16px' }}>
                <p>
                    <span tid="created">{created.value}</span> · <span tid="template">{template.value}</span> ·{' '}
                    <span tid="kept">{draft.value.title}</span> · <span tid="count">{createdCount.value}</span>
                </p>
                <NewIssueDialog
                    open={open.value}
                    onUpdate:open={(value: boolean) => (open.value = value)}
                    repositoryQuery={query.value}
                    onUpdate:repositoryQuery={(value: string) => (query.value = value)}
                    draft={draft.value}
                    repository={repository.value}
                    contextHint={props.contextHint}
                    templates={props.templates}
                    viewerLogin={SAMPLE_VIEWER.login}
                    parentOptions={PARENTS}
                    projectOptions={PROJECTS}
                    repositoryChoices={CHOICES}
                    searching={false}
                    rejection={props.rejection}
                    missingFields={missing.value}
                    waiting={props.waiting}
                    onRestore={(id: number) => (template.value = `restore ${id}`)}
                    onDiscard={(id: number) => (template.value = `discard ${id}`)}
                    onUpdate={(patch: Partial<NewIssueDraft>) => (draft.value = { ...draft.value, ...patch })}
                    onCreate={(another: boolean) => {
                        createdCount.value++;
                        created.value = `${another ? 'Created, another' : 'Created'}: ${draft.value.title}`;
                        if (another) {
                            draft.value = { ...draft.value, title: '', body: '' };
                        } else {
                            open.value = false;
                        }
                    }}
                    onUseTemplate={(picked: IssueTemplate) => {
                        template.value = picked.kind === 'form' ? `form ${picked.form.filename}` : picked.filename;
                    }}
                />
            </div>
        );
    },
});

const meta = {
    component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

/** H1: the quick capture in the repository used last — the title, then Enter. */
export const QuickCapture: Story = {};

/** H2: no repository chosen yet — the chooser first: tracked, others, and those that won't take an issue. */
export const ChoosingRepository: Story = {
    args: { draft: { ...EMPTY, repository: null }, repository: { kind: 'none' } },
};

/** H3: expanded to every field, the body beside them. */
export const Expanded: Story = {
    args: {
        draft: {
            ...EMPTY,
            title: 'Reminders skip the first visit after a DST change',
            body: 'Visits created before Oct 27 keep their reminder at the old offset.',
            labels: ['bug', 'docs'],
            assignees: [SAMPLE_VIEWER.login],
        },
    },
};

/**
 * Values kept from another repository (or set by a form) that this one does not have: their chips are marked and a
 * line names them — they will be left out.
 */
export const NotInRepository: Story = {
    args: {
        draft: {
            ...EMPTY,
            title: 'Reminders skip the first visit after a DST change',
            labels: ['bug', 'needs-design'],
            milestone: 'v9 — Someday',
            issueType: 'Epic',
        },
    },
};

/** H5: started in Platform Q4's "In progress" column — added there with that value. */
export const InProjectColumn: Story = {
    args: {
        draft: {
            ...EMPTY,
            projects: [
                {
                    projectId: 'PVT_q4',
                    title: 'Platform Q4',
                    values: [
                        {
                            fieldId: 'status',
                            fieldName: 'Status',
                            value: { kind: 'singleSelect', optionId: 'status-progress' },
                            label: 'In progress',
                        },
                    ],
                },
            ],
        },
        contextHint: 'in Platform Q4 · In progress',
    },
};

/** H6: started from an open issue — a sub-issue of it unless taken out. */
export const FromOpenIssue: Story = {
    args: { draft: { ...EMPTY, parent: { id: 'I_1187', reference: 'portal#1187' } }, contextHint: 'from portal#1187' },
};

/** H7: a repository asking for a template, where the user can't push — forms continue on GitHub. */
export const Templates: Story = {
    args: {
        draft: { ...EMPTY, repository: 'vitejs/vite' },
        repository: { kind: 'ready', metadata: VITE_METADATA, isPrivate: false },
        templates: VITE_TEMPLATES,
    },
};

/** H8: an issue form as a pre-filled body; the required fields still empty are named. */
export const IssueFormBody: Story = {
    args: {
        draft: {
            ...EMPTY,
            title: 'Exported calendar drops the team timezone',
            body: buildIssueFormBody(BUG_FORM),
            labels: ['bug'],
            form: BUG_FORM.filename,
        },
        templates: { ...VITE_TEMPLATES, nameWithOwner: 'skyline-labs/portal', blankIssuesEnabled: true },
        form: BUG_FORM,
    },
};

/** H9: GitHub refused the creation — the reason above the text it kept. */
export const Rejected: Story = {
    args: {
        draft: {
            ...EMPTY,
            title: 'Reminders skip the first visit after a DST change',
            body: 'Visits created before Oct 27 keep their reminder at the old offset.',
        },
        rejection: 'GitHub said: Repository was archived so is read-only.',
    },
};

/** H9: two issues GitHub refused while another was being written — each waits to be restored or dropped. */
export const Waiting: Story = {
    args: {
        draft: { ...EMPTY, title: 'Being written now' },
        waiting: [
            {
                id: 1,
                title: 'Reminders skip DST',
                repository: 'skyline-labs/portal',
                why: 'GitHub said: Repository was archived so is read-only.',
            },
            {
                id: 2,
                title: 'Export drops the timezone',
                repository: 'skyline-labs/portal',
                why: "githq closed before GitHub answered. Check it wasn't created before sending it again.",
            },
        ],
    },
};

/** States: a repository that won't take an issue, said before anything is typed. */
export const Archived: Story = {
    args: {
        draft: { ...EMPTY, repository: 'skyline-labs/api-v1' },
        repository: { kind: 'unavailable', nameWithOwner: 'skyline-labs/api-v1', isPrivate: true, why: 'archived' },
    },
};
