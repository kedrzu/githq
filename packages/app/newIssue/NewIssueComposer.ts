import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import type { NewIssueInput, NewIssueParent } from '@/edits/createIssueEdit.js';
import type { EditFailureReason, ProjectFieldInput } from '@/edits/EditTypes.js';
import { hasRole } from '@/edits/getEditPermissions.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';

import { buildIssueFormBody } from './buildIssueFormBody.js';
import { getIssueFormUrl } from './getIssueFormUrl.js';
import type { IssueTemplate } from './IssueTemplateStore.js';

/** Where kept per user: `githq.newIssue.<login>` — the unsent text and the repository used last. */
const KEY_PREFIX = 'githq.newIssue.';

/** Where creating an issue was started from: it sets the defaults (`ui/new-issue.md`, step 1). */
export interface NewIssueContext {
    /** The repository of the screen (a repository's list, an opened item); else the one used last. */
    readonly repository: string | null;
    /** A project's screen: the issue is added to it, with the value of the column it was started in (H5). */
    readonly project: NewIssueProjectChoice | null;
    /** An opened issue: offered as the new one's parent (H6). */
    readonly parent: NewIssueParent | null;
}

/** A project a new issue goes to, with the fields set there. */
export interface NewIssueProjectChoice {
    readonly projectId: string;
    readonly title: string;
    readonly values: readonly NewIssueProjectValue[];
}

/** A field set on a new issue in a project ("Status: In progress"). */
export interface NewIssueProjectValue {
    readonly fieldId: string;
    readonly fieldName: string;
    readonly value: ProjectFieldInput;
    /** The value as the chip shows it. */
    readonly label: string;
}

/** The issue being written. */
export interface NewIssueDraft extends NewIssueInput {
    /** `owner/name`; `null` until chosen. */
    readonly repository: string | null;
    readonly projects: readonly NewIssueProjectChoice[];
    /** The issue form the body was written from (H8), by file name: its required fields are checked. */
    readonly form: string | null;
}

/** How a creation GitHub did not take ended, for the capture to say (H9). */
export interface NewIssueRejection {
    readonly repository: string;
    readonly reason: EditFailureReason;
}

/** An issue form continued on GitHub (H7, D14): the capture keeps what was written, and says so. */
export interface NewIssueHandoff {
    readonly repository: string;
    /** The form's name ("Bug report"). */
    readonly form: string;
}

/**
 * An issue's text waiting beside the one in the capture, until the user brings it back or drops it: GitHub did not
 * create it (H9), the app closed before GitHub answered, or it was set aside for another one.
 */
export interface NewIssueWaiting {
    /** Unique among those waiting. */
    readonly id: number;
    readonly draft: NewIssueDraft;
    readonly why: NewIssueWaitingReason;
}

/** Why an issue's text waits. */
export type NewIssueWaitingReason =
    | { readonly kind: 'refused'; readonly reason: EditFailureReason }
    /** Sent, but the app closed before GitHub answered: it may have been created. */
    | { readonly kind: 'unconfirmed' }
    /** Put aside to bring another one back. */
    | { readonly kind: 'setAside' };

/** An issue's text as kept in the browser. */
interface KeptDraft {
    readonly repository: string | null;
    readonly title: string;
    readonly body: string;
}

/** What is kept across a closed window, per user: the draft shown last, and those of other repositories. */
interface KeptText extends KeptDraft {
    readonly others: readonly KeptDraft[];
    readonly lastRepository: string | null;
    /** Those sent and not answered yet: waiting as unconfirmed when read back. */
    readonly sending: readonly KeptDraft[];
    readonly waiting: readonly (KeptDraft & { readonly why: NewIssueWaitingReason })[];
}

const EMPTY_DRAFT: NewIssueDraft = {
    repository: null,
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

/**
 * The quick capture of a new issue (H1, D20): whether it is open, what it was started from and what is written in
 * it. Closing it keeps the draft, one per repository — the next `C` there brings it back, and so does reopening
 * the app: the repository, title and body are kept in this browser per user until sent (forgotten on sign-out). Creating goes through the
 * edit engine; a creation GitHub refuses opens the capture again with everything as it was and the reason (H9) —
 * or, over what is being written meanwhile, waits beside it to be restored. An issue's text is kept until GitHub
 * created it: one sent when the app closed waits, after a reload, to be checked and sent again.
 */
export type NewIssueComposer = Resolved<typeof NewIssueComposer>;
export const NewIssueComposer = defineService({
    name: 'NewIssueComposer',
    deps: {
        accounts: AccountSession,
        editor: ItemEditor,
        repositories: RepositoryStore,
        browser: Browser,
    },
    setup({ accounts, editor, repositories, browser }) {
        const openRef = shallowRef(false);
        const contextRef = shallowRef<NewIssueContext | null>(null);
        const draftRef = shallowRef<NewIssueDraft>(EMPTY_DRAFT);
        const rejectionRef = shallowRef<NewIssueRejection | null>(null);
        const lastRepositoryRef = shallowRef<string | null>(null);
        const handoffRef = shallowRef<NewIssueHandoff | null>(null);
        const waitingRef = shallowRef<readonly NewIssueWaiting[]>([]);
        /** The issues sent and not answered yet, by id: their text is kept until GitHub created them. */
        const sending = new Map<number, NewIssueDraft>();
        /**
         * The drafts written in other repositories than the one shown, by repository (`''`: none chosen), the
         * one left last at the end: each comes back when the capture is started there.
         */
        const others = new Map<string, NewIssueDraft>();
        let nextId = 1;

        const slot = createAccountSlot({ accounts, browser, keyPrefix: KEY_PREFIX, parse: read, follow });

        return {
            /** Whether the capture is open; reactive. */
            get open() {
                return openRef.value;
            },
            /** What it was started from; reactive. */
            get context() {
                return contextRef.value;
            },
            /** What is written in it; reactive. */
            get draft() {
                return draftRef.value;
            },
            /** The repository the last issue was created in; reactive. */
            get lastRepository() {
                return lastRepositoryRef.value;
            },
            /** Why GitHub did not create the issue in it last; reactive. */
            get rejection() {
                return rejectionRef.value;
            },
            /** The issues' texts waiting to be brought back, oldest first; reactive. */
            get waiting() {
                return waitingRef.value;
            },
            /** The issue form last continued on GitHub from this repository; reactive. */
            get handoff() {
                return handoffRef.value;
            },
            start,
            update,
            useTemplate,
            close,
            submit,
            restore,
            discard,
        };

        /**
         * Opens the capture with the defaults of where it was started (`ui/new-issue.md`, step 1): in a repository,
         * that repository with the draft written there, if any — the one shown before is kept for its own;
         * elsewhere, the draft shown last, else one left in another repository, else the repository used last.
         * Nothing when it is open already.
         */
        function start(context: NewIssueContext) {
            if (openRef.value) {
                return;
            }

            const current = draftRef.value;
            const { repository } = context;
            let next: NewIssueDraft;
            if (repository !== null && current.repository !== repository) {
                park(current);
                next = take(repository) ?? { ...EMPTY_DRAFT, repository };
            } else if (repository !== null || isWritten(current)) {
                next = current;
            } else {
                const left = [...others.keys()].at(-1);
                next = (left === undefined ? null : take(left)) ?? {
                    ...EMPTY_DRAFT,
                    repository: lastRepositoryRef.value,
                };
            }

            const written = isWritten(next);
            contextRef.value = context;
            handoffRef.value = null;
            show({
                ...(written ? next : { ...EMPTY_DRAFT, repository: next.repository }),
                // An opened issue is offered as the parent where the new one goes into its repository.
                parent:
                    context.parent && (repository === null || repository === next.repository)
                        ? context.parent
                        : written
                          ? next.parent
                          : null,
                projects: context.project ? [context.project] : written ? next.projects : [],
            });
            openRef.value = true;
        }

        /**
         * Changes what is written. Another repository chosen takes the text along — the parent stays behind, an issue
         * of the repository left — and a draft kept for that repository waits beside it ({@link restore}).
         */
        function update(patch: Partial<NewIssueDraft>) {
            const current = draftRef.value;
            const moved = patch.repository !== undefined && patch.repository !== current.repository;
            const next = { ...current, ...patch };
            if (moved) {
                show(patch.parent === undefined ? { ...next, parent: null } : next);
            } else {
                draftRef.value = next;
            }

            if (patch.repository !== undefined && patch.repository !== rejectionRef.value?.repository) {
                rejectionRef.value = null;
            }

            if (patch.repository !== undefined && patch.repository !== handoffRef.value?.repository) {
                handoffRef.value = null;
            }

            keep();
        }

        /**
         * Fills the issue from a template of its repository (H7, H8). Text already written stays: the template goes
         * below it, never in its place. A form in a repository the user can't push to continues on GitHub's own form
         * in a new tab (D14) with the title — GitHub's forms take their fields from a link, not a description, so
         * what was written stays here and the capture says so; with nothing written below the title it closes. The
         * permission decides only once it is known: read first when it is not in memory.
         */
        async function useTemplate(template: IssueTemplate) {
            const repository = draftRef.value.repository;
            if (repository === null) {
                return;
            }

            // In memory nothing is awaited: the new tab opens within the click that asked for it.
            const metadata = repositories.get(repository) ?? (await repositories.ensure(repository));
            const current = draftRef.value;
            if (current.repository !== repository) {
                return;
            }

            const canPush = hasRole(metadata?.viewerPermission, 'WRITE');
            if (template.kind === 'form' && !canPush) {
                browser.openInNewTab(
                    getIssueFormUrl({
                        repository,
                        filename: template.form.filename,
                        title: current.title || (template.form.title ?? ''),
                    }),
                );
                handoffRef.value = { repository, form: template.form.name };
                if (current.body.trim() === '') {
                    close();
                }

                return;
            }

            const filled =
                template.kind === 'form'
                    ? {
                          title: template.form.title,
                          body: buildIssueFormBody(template.form),
                          labels: template.form.labels,
                          assignees: template.form.assignees,
                          type: template.form.type,
                          form: template.form.filename,
                      }
                    : { ...template, form: null };
            update({
                title: current.title.trim() ? current.title : (filled.title ?? ''),
                body: current.body.trim() ? `${current.body.trimEnd()}\n\n${filled.body}` : filled.body,
                form: filled.form,
                // Where the user can't push, GitHub drops these: not offered (D14).
                labels: canPush ? unique([...current.labels, ...filled.labels]) : current.labels,
                assignees: canPush ? unique([...current.assignees, ...filled.assignees]) : current.assignees,
                issueType: canPush ? (filled.type ?? current.issueType) : current.issueType,
            });
        }

        /** Closes it; what is written stays for the next time. */
        function close() {
            openRef.value = false;
        }

        /**
         * Creates the issue written: the capture closes — or, `another`, stays open with the title and body cleared
         * for the next one (its repository, fields and projects kept). Its text is kept, in the browser too, until
         * GitHub created it. Resolves once GitHub answered; when it did not create the issue, the capture opens again
         * with the issue as written and the reason — or, over something written meanwhile, with it waiting to be
         * brought back ({@link restore}).
         */
        async function submit(another: boolean) {
            const sent = draftRef.value;
            const repository = sent.repository;
            if (repository === null || !sent.title.trim()) {
                return;
            }

            const id = nextId++;
            sending.set(id, sent);
            lastRepositoryRef.value = repository;
            rejectionRef.value = null;
            handoffRef.value = null;
            draftRef.value = another ? { ...sent, title: '', body: '', form: null } : { ...EMPTY_DRAFT, repository };
            if (!another) {
                openRef.value = false;
            }

            keep();

            const { title, body, assignees, labels, milestone, issueType, parent } = sent;
            const outcome = await editor.createIssue({
                repository,
                issue: { title: title.trim(), body, assignees, labels, milestone, issueType, parent },
                projects: sent.projects.map(project => ({
                    projectId: project.projectId,
                    values: project.values.map(({ fieldId, value }) => ({ fieldId, value })),
                })),
            });
            // Signed out, or another account in, meanwhile: its text went with the account's.
            if (!sending.delete(id)) {
                return;
            }

            const failed = outcome.failed.find(entry => entry.edit.subject.kind === 'issueCreated');
            if (!outcome.created && failed) {
                // H9: the issue as written comes back — never over what the user is writing now, which it waits beside.
                if (isWritten(draftRef.value)) {
                    waitingRef.value = [
                        ...waitingRef.value,
                        { id, draft: sent, why: { kind: 'refused', reason: failed.reason } },
                    ];
                } else {
                    show(sent);
                    rejectionRef.value = { repository, reason: failed.reason };
                }

                openRef.value = true;
            }

            keep();
        }

        /** Brings a waiting issue's text back into the capture; what is written there now waits in its place. */
        function restore(id: number) {
            const restored = waitingRef.value.find(entry => entry.id === id);
            if (!restored) {
                return;
            }

            const current = draftRef.value;
            const left = waitingRef.value.filter(entry => entry !== restored);
            waitingRef.value = isWritten(current)
                ? [...left, { id: nextId++, draft: current, why: { kind: 'setAside' } }]
                : left;
            show(restored.draft);
            const { repository } = restored.draft;
            rejectionRef.value =
                restored.why.kind === 'refused' && repository !== null
                    ? { repository, reason: restored.why.reason }
                    : null;
            handoffRef.value = null;
            keep();
        }

        /** Shows `next` in the capture; a draft kept for its repository waits beside it, never lost. */
        function show(next: NewIssueDraft) {
            const kept = take(next.repository ?? '');
            if (kept) {
                waitingRef.value = [...waitingRef.value, { id: nextId++, draft: kept, why: { kind: 'setAside' } }];
            }

            draftRef.value = next;
        }

        /** Keeps a written draft for when the capture is started in its repository again. */
        function park(draft: NewIssueDraft) {
            const key = draft.repository ?? '';
            others.delete(key);
            if (isWritten(draft)) {
                others.set(key, draft);
            }
        }

        /** The draft kept for the repository (`''`: none chosen), taken out of the kept ones. */
        function take(key: string) {
            const kept = others.get(key) ?? null;
            others.delete(key);
            return kept;
        }

        /** Drops a waiting issue's text. */
        function discard(id: number) {
            waitingRef.value = waitingRef.value.filter(entry => entry.id !== id);
            keep();
        }

        function keep() {
            slot.save({
                ...toKept(draftRef.value),
                others: [...others.values()].map(draft => toKept(draft)),
                lastRepository: lastRepositoryRef.value,
                sending: [...sending.values()].map(draft => toKept(draft)),
                waiting: waitingRef.value.map(entry => ({ ...toKept(entry.draft), why: entry.why })),
            });
        }

        /** Another user signed in, with what was kept for them, or none. */
        function follow(kept: KeptText | null) {
            openRef.value = false;
            contextRef.value = null;
            rejectionRef.value = null;
            handoffRef.value = null;
            sending.clear();
            others.clear();
            for (const draft of kept?.others ?? []) {
                others.set(draft.repository ?? '', fromKept(draft));
            }

            lastRepositoryRef.value = kept?.lastRepository ?? null;
            draftRef.value = kept ? fromKept(kept) : EMPTY_DRAFT;
            // What was on its way when the app closed may or may not have been created: it waits, to check.
            waitingRef.value = [
                ...(kept?.waiting ?? []).map(entry => ({ id: nextId++, draft: fromKept(entry), why: entry.why })),
                ...(kept?.sending ?? []).map(entry => ({
                    id: nextId++,
                    draft: fromKept(entry),
                    why: { kind: 'unconfirmed' } as const,
                })),
            ];
        }

        function read(stored: unknown): KeptText | null {
            if (!isPlainObject(stored)) {
                return null;
            }

            return {
                ...readDraft(stored),
                others: readList(stored.others).map(entry => readDraft(entry)),
                lastRepository: typeof stored.lastRepository === 'string' ? stored.lastRepository : null,
                sending: readList(stored.sending).map(entry => readDraft(entry)),
                waiting: readList(stored.waiting).flatMap(entry => {
                    const why = readWaitingReason(entry.why);
                    return why ? [{ ...readDraft(entry), why }] : [];
                }),
            };
        }
    },
});

function unique(values: readonly string[]) {
    return [...new Set(values)];
}

function isWritten(draft: NewIssueDraft) {
    return draft.title.trim() !== '' || draft.body.trim() !== '';
}

function toKept({ repository, title, body }: NewIssueDraft): KeptDraft {
    return { repository, title, body };
}

function fromKept({ repository, title, body }: KeptDraft): NewIssueDraft {
    return { ...EMPTY_DRAFT, repository, title, body };
}

function readDraft(stored: Record<string, unknown>): KeptDraft {
    return {
        repository: typeof stored.repository === 'string' ? stored.repository : null,
        title: typeof stored.title === 'string' ? stored.title : '',
        body: typeof stored.body === 'string' ? stored.body : '',
    };
}

function readList(stored: unknown): Record<string, unknown>[] {
    return Array.isArray(stored) ? stored.filter(entry => isPlainObject(entry)) : [];
}

function readWaitingReason(stored: unknown): NewIssueWaitingReason | null {
    if (!isPlainObject(stored)) {
        return null;
    }

    switch (stored.kind) {
        case 'unconfirmed':
        case 'setAside':
            return { kind: stored.kind };
        case 'refused': {
            const reason = readFailureReason(stored.reason);
            return reason && { kind: 'refused', reason };
        }
        default:
            return null;
    }
}

function readFailureReason(stored: unknown): EditFailureReason | null {
    if (!isPlainObject(stored)) {
        return null;
    }

    switch (stored.kind) {
        case 'dropped':
        case 'notAllowed':
        case 'missing':
        case 'offline':
            return { kind: stored.kind };
        case 'refused':
            return typeof stored.message === 'string' ? { kind: 'refused', message: stored.message } : null;
        default:
            return null;
    }
}
