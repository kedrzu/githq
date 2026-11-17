import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useLanguage } from '@nzyme/vue-i18n/useLanguage.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { BookMarked, Play } from 'lucide-vue-next';
import { onScopeDispose } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { bindCommand } from '@/commands/bindCommand.js';
import type { Command, CommandForm, CommandFormField, CommandFormValues } from '@/commands/CommandTypes.js';
import { runWorkflow } from '@/commands/definitions/index.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Clock } from '@/services/Clock.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { useDispatchableWorkflows } from './useDispatchableWorkflows.js';
import type { DispatchableWorkflow, DispatchableWorkflows } from './useDispatchableWorkflows.js';
import * as l from './useRunWorkflowCommand.loc.js';
import { getDispatchBlock } from './utils/getDispatchBlock.js';
import type { WorkflowDispatchBlock } from './utils/getDispatchBlock.js';
import { getDispatchFields } from './utils/getDispatchFields.js';
import { getDispatchInputs } from './utils/getDispatchInputs.js';
import { getRepositoryDispatchBlock } from './utils/getRepositoryDispatchBlock.js';
import { getWorkflowFile } from './utils/getWorkflowFile.js';
import { WorkflowDispatch } from './WorkflowDispatch.js';
import { WorkflowFileStore } from './WorkflowFileStore.js';
import type { WorkflowFileRead, WorkflowFileTarget } from './WorkflowFileStore.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { WorkflowState } from './WorkflowTypes.js';

/** The workflow "Run workflow · Deploy" runs: the one selected in a list, or the one open. */
export interface RunWorkflowTarget {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly state: WorkflowState;
    /** Where it is offered: the Workflows section, its selected workflow; an opened workflow, that one. */
    readonly place: 'workflows' | 'workflow';
}

/** "Run workflow" as the command menu offers it (actions W36, W37, W46–W48). */
export interface RunWorkflowCommands {
    /**
     * "Run workflow · Deploy" for one workflow, straight to its form; disabled saying why for a workflow nobody can run by
     * hand; `null` where the user can't run workflows at all (no write access, an archived repository).
     */
    forWorkflow(target: RunWorkflowTarget): Command | null;
    /**
     * "Run workflow…" for any workflow: the tracked repositories, each with how many workflows the user can run there, then
     * the workflows of the one picked, then the form. Inside a tracked repository it opens at that repository's
     * workflows, a step back showing the others.
     */
    anyWorkflow(repository: string | null): Command;
}

/** A ref typed in the form is read once typing pauses this long. */
const REF_DEBOUNCE_MS = 400;

/** The trigger running a workflow by hand, named in the texts: a parameter, as a `_` in a translation is a no-break space. */
const DISPATCH_TRIGGER = 'workflow_dispatch';

/** How many workflows' names a repository's line lists. */
const NAMES_SHOWN = 3;

/** A workflow whose form to build, and what is known of its file at the default branch. */
interface FormParams {
    readonly nameWithOwner: string;
    readonly workflow: GitHubWorkflow;
    /** Its file at the default branch, read with its repository's files; `null` when not. */
    readonly fallback: GitHubWorkflowFileParse | null;
}

/** A workflow's file as read at a ref, for the form to say why it can't run there. */
interface FileAt {
    readonly read: WorkflowFileRead;
    /** Its file name (`deploy.yml`). */
    readonly file: string;
    readonly ref: string;
}

/**
 * "Run workflow" (actions W36, W37, W46–W48): its steps follow where the user is — a workflow open or selected goes
 * straight to its form, a repository to its workflows, anywhere else the tracked repositories first. The form is built
 * from the workflow's file at the ref entered, read again (conditionally) as the ref changes, and runs it through
 * `WorkflowDispatch`. No key starts a run (D10).
 */
export function useRunWorkflowCommand(): RunWorkflowCommands {
    const t = useTranslate();
    const lang = useLanguage();
    const accounts = useService(AccountSession);
    const registry = useService(CommandRegistry);
    const repositories = useService(RepositoryStore);
    const tracking = useService(TrackingStore);
    const workflows = useService(WorkflowStore);
    const files = useService(WorkflowFileStore);
    const dispatches = useService(WorkflowDispatch);
    const clock = useService(Clock);
    const dispatchable = useDispatchableWorkflows();

    /** Reads asked from inside a computed, sent after it: what they write would be read back while it runs. */
    const pending = new Map<string, () => void>();
    /** The ref being typed: read once typing pauses. */
    let typed: { readonly key: string; readonly cancel: () => void } | null = null;
    onScopeDispose(() => {
        for (const cancel of pending.values()) {
            cancel();
        }

        typed?.cancel();
    });

    return { forWorkflow, anyWorkflow };

    function forWorkflow({ nameWithOwner, state, place }: RunWorkflowTarget): Command | null {
        const { workflow } = state;
        const target: WorkflowFileTarget = { nameWithOwner, path: workflow.path, ref: null };
        const read = state.generated ? null : files.get(target);
        const block = getDispatchBlock({
            workflow,
            generated: state.generated,
            metadata: repositories.get(nameWithOwner),
            parse: read?.parse ?? null,
        });
        if (block === 'noAccess' || block === 'archived') {
            return null;
        }

        // Its reason or its inputs come from its file: read while the menu is open.
        if (registry.menu && read && read.parse === null && read.status === 'idle') {
            readSoon(target);
        }

        const parse = read?.parse ?? null;
        const where = place === 'workflows' ? t(l.selectedWorkflow) : t(l.openWorkflow);
        const described = parse ? describeWorkflow(nameWithOwner, parse) : null;
        return bindCommand(
            runWorkflow,
            {
                place,
                title: t(l.runNamed, { workflow: workflow.name }),
                section: 'view',
                detail: described ? `${where} — ${described}` : where,
                hint: block ? t(l.pickAnother) : t(l.opensForm, { workflow: workflow.name }),
                unavailable: block ? describeBlock(block, workflow) : undefined,
                prepare: () => files.read(target),
                form: values => getForm({ nameWithOwner, workflow, fallback: null }, values),
            },
            t,
        );
    }

    function anyWorkflow(repository: string | null): Command {
        const tracked = tracking.repositories.map(entry => entry.nameWithOwner);
        const inRepository = repository !== null && tracked.includes(repository);
        const count = inRepository ? getRunnableCount(repository) : null;
        return bindCommand(
            runWorkflow,
            {
                place: 'app',
                section: 'app',
                detail: inRepository
                    ? [t(l.inRepository, { repository }), count === null ? null : t(l.canRun, { count })]
                          .filter(part => part !== null)
                          .join(' · ')
                    : undefined,
                start: inRepository ? getRepositoryRowId(repository) : undefined,
                placeholder: t(l.pickRepository),
                levelHint: t(l.firstStep),
                prepare: () => {
                    for (const name of tracked) {
                        void readRunnable(name);
                    }
                },
                children: () => getRepositoryRows(tracked),
                // Its repositories and workflows are found only through its own level: each one costs a read of GitHub.
                foundAlone: () => [],
            },
            t,
        );
    }

    /** Reads what the user can run in the repository: its files once its metadata says they may run workflows there. */
    async function readRunnable(nameWithOwner: string) {
        await repositories.ensure(nameWithOwner);
        if (getRepositoryBlock(nameWithOwner) === null) {
            dispatchable.read(nameWithOwner);
        }
    }

    /** The tracked repositories, those with a workflow to run first, then those with nothing to run. */
    function getRepositoryRows(tracked: readonly string[]): Command[] {
        const rows = tracked.map(getRepositoryRow);
        return [
            ...rows.filter(row => row.unavailable === undefined),
            ...rows.filter(row => row.unavailable !== undefined),
        ];
    }

    function getRepositoryRow(nameWithOwner: string): Command {
        const row: Command = {
            id: getRepositoryRowId(nameWithOwner),
            title: nameWithOwner,
            section: 'app',
            icon: BookMarked,
        };
        const cantRun: Command = { ...row, group: t(l.nothingToRunHeading) };
        // Until its metadata is read, whether the user may run anything there is not known: it reads as being read.
        const block = repositories.get(nameWithOwner) ? getRepositoryBlock(nameWithOwner) : null;
        if (block !== null) {
            return { ...cantRun, unavailable: block === 'archived' ? t(l.archived) : t(l.noAccess) };
        }

        const found = dispatchable.get(nameWithOwner);
        if (found.status === 'read' && found.workflows.length === 0) {
            return { ...cantRun, unavailable: t(l.nothingToRun, { trigger: DISPATCH_TRIGGER }) };
        }

        return {
            ...row,
            group: t(l.trackedRepositories),
            placeholder: t(l.pickWorkflow),
            levelHint:
                found.status === 'read'
                    ? t(l.onlyDispatchCounted, {
                          trigger: DISPATCH_TRIGGER,
                          count: found.workflows.length,
                          total: found.total,
                      })
                    : t(l.onlyDispatch, { trigger: DISPATCH_TRIGGER }),
            detail: describeRepository(found),
            message:
                found.status === 'reading' || found.status === 'unread'
                    ? t(l.readingWorkflows)
                    : t(l.noWorkflows, { trigger: DISPATCH_TRIGGER }),
            prepare: () => void readRunnable(nameWithOwner),
            children: () =>
                dispatchable.get(nameWithOwner).workflows.map(entry => getWorkflowRow(nameWithOwner, entry)),
        };
    }

    function getWorkflowRow(nameWithOwner: string, { workflow, parse }: DispatchableWorkflow): Command {
        return {
            id: `workflow:${workflow.id}`,
            title: workflow.name,
            section: 'app',
            icon: Play,
            group: t(l.workflowsIn, { repository: nameWithOwner }),
            detail: describeWorkflow(nameWithOwner, parse) ?? undefined,
            prepare: () => files.read({ nameWithOwner, path: workflow.path, ref: null }),
            form: values => getForm({ nameWithOwner, workflow, fallback: parse }, values),
        };
    }

    /** The form: the ref, then the inputs of the workflow's file at that ref — or why it can't run there. */
    function getForm({ nameWithOwner, workflow, fallback }: FormParams, values: CommandFormValues): CommandForm {
        const defaultBranch = workflows.get(nameWithOwner)?.defaultBranch ?? null;
        const ref = (typeof values.ref === 'string' ? values.ref : (defaultBranch ?? '')).trim();
        const refField: CommandFormField = {
            kind: 'text',
            name: 'ref',
            detail: t(l.refDetail),
            hint: defaultBranch === null ? undefined : t(l.defaultBranch),
            default: defaultBranch ?? undefined,
            required: true,
        };
        const login = accounts.current?.login;
        const base = {
            heading: t(l.heading),
            context: nameWithOwner,
            submitLabel: t(l.run),
            hint: login === undefined ? undefined : t(l.runsAs, { login }),
        };
        if (ref === '') {
            return { ...base, fields: [refField], submit: () => undefined };
        }

        const atDefault = ref === defaultBranch;
        const target: WorkflowFileTarget = { nameWithOwner, path: workflow.path, ref: atDefault ? null : ref };
        const read = getFileRead(target, atDefault ? fallback : null);
        const parse = read.parse;
        const file = getWorkflowFile(workflow);
        const inputs =
            parse?.kind === 'parsed' && parse.file.dispatch
                ? getDispatchFields(parse.file.dispatch.inputs, lang.value)
                : [];
        return {
            ...base,
            fields: [refField, ...inputs],
            message: describeFileAt({ read, file, ref }),
            submit: entered => {
                const chosen = typeof entered.ref === 'string' ? entered.ref.trim() : ref;
                void dispatches.dispatch({
                    nameWithOwner,
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    ref: chosen,
                    inputs: getDispatchInputs(inputs, entered),
                });
            },
        };
    }

    /**
     * The file at a ref as read, read when it never was: at once at the default branch, once typing pauses at another.
     * At the default branch, what the repository's files said stands in until the file itself is read.
     */
    function getFileRead(target: WorkflowFileTarget, fallback: GitHubWorkflowFileParse | null): WorkflowFileRead {
        const read = files.get(target);
        if (read.parse === null && read.status === 'idle') {
            if (target.ref === null) {
                readSoon(target);
            } else {
                readOnceTyped(target);
            }
        }

        return read.parse === null && fallback ? { parse: fallback, status: 'idle' } : read;
    }

    /** Why the form can't run at the ref; `undefined` when it can. */
    function describeFileAt({ read, file, ref }: FileAt) {
        const { parse } = read;
        switch (parse?.kind) {
            case undefined:
                return read.status === 'failed' ? t(l.failedAt, { file, ref }) : t(l.readingAt, { file, ref });
            case 'parsed':
                return parse.file.dispatch ? undefined : t(l.noDispatchAt, { trigger: DISPATCH_TRIGGER });
            case 'noTriggers':
                return t(l.noDispatchAt, { trigger: DISPATCH_TRIGGER });
            case 'missing':
                return t(l.missingAt, { file, ref });
            case 'notYaml':
                return t(l.notYamlAt, { file, ref });
            default:
                return assertNever(parse);
        }
    }

    function readSoon(target: WorkflowFileTarget) {
        const key = JSON.stringify(target);
        if (!pending.has(key)) {
            pending.set(
                key,
                clock.schedule(() => {
                    pending.delete(key);
                    files.read(target);
                }, 0),
            );
        }
    }

    function readOnceTyped(target: WorkflowFileTarget) {
        const key = JSON.stringify(target);
        if (typed?.key === key) {
            return;
        }

        typed?.cancel();
        typed = {
            key,
            cancel: clock.schedule(() => {
                typed = null;
                files.read(target);
            }, REF_DEBOUNCE_MS),
        };
    }

    function getRepositoryBlock(nameWithOwner: string) {
        return getRepositoryDispatchBlock(repositories.get(nameWithOwner));
    }

    function getRunnableCount(nameWithOwner: string) {
        const found = dispatchable.get(nameWithOwner);
        return getRepositoryBlock(nameWithOwner) === null && found.status === 'read' ? found.workflows.length : null;
    }

    function describeRepository({ status, workflows: found }: DispatchableWorkflows) {
        switch (status) {
            case 'read': {
                const names = found.slice(0, NAMES_SHOWN).map(entry => entry.workflow.name);
                return t(l.withNames, {
                    count: t(l.repositoryWorkflows, { count: found.length }),
                    names: found.length > NAMES_SHOWN ? `${names.join(', ')}, …` : names.join(', '),
                });
            }
            case 'failed':
                return t(l.filesFailed);
            case 'unread':
            case 'reading':
                return t(l.readingFiles);
            default:
                return assertNever(status);
        }
    }

    /** "main · 3 inputs"; `null` for a file without `workflow_dispatch`. */
    function describeWorkflow(nameWithOwner: string, parse: GitHubWorkflowFileParse) {
        if (parse.kind !== 'parsed' || !parse.file.dispatch) {
            return null;
        }

        const inputs = t(l.inputs, { count: parse.file.dispatch.inputs.length });
        const defaultBranch = workflows.get(nameWithOwner)?.defaultBranch;
        return defaultBranch ? t(l.onRef, { ref: defaultBranch, inputs }) : inputs;
    }

    function describeBlock(block: Exclude<WorkflowDispatchBlock, 'noAccess' | 'archived'>, workflow: GitHubWorkflow) {
        const params = { workflow: workflow.name, trigger: DISPATCH_TRIGGER };
        switch (block) {
            case 'generated':
                return t(l.blockGenerated, params);
            case 'disabled':
                return t(l.blockDisabled, params);
            case 'noDispatch':
                return t(l.blockNoDispatch, params);
            case 'unreadable':
                return t(l.blockUnreadable, params);
            default:
                return assertNever(block);
        }
    }
}

function getRepositoryRowId(nameWithOwner: string) {
    return `repository:${nameWithOwner}`;
}
