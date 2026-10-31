import type { RepositoryIssueTemplatesQuery } from '@githq/github/generated.gen.js';
import { parseIssueForm } from '@githq/github/issueForms/parseIssueForm.js';
import type { IssueForm } from '@githq/github/issueForms/parseIssueForm.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { createExpiringReads } from '@/utils/createExpiringReads.js';
import type { ExpiringReads } from '@/utils/createExpiringReads.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

/** How long a repository's templates are used without reading them again. */
const TEMPLATES_TTL_MS = 10 * 60_000;

/** What a repository asks a new issue to start from (H7, H8). */
export interface RepositoryTemplates {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** `false`: the repository turned blank issues off — a template must be used. */
    readonly blankIssuesEnabled: boolean;
    /** Markdown templates first, then forms, each in GitHub's order. */
    readonly templates: readonly IssueTemplate[];
    /** When they were read (epoch ms). */
    readonly fetchedAt: number;
}

/** A template a new issue can start from: markdown, filled in here, or a form (YAML). */
export type IssueTemplate = MarkdownIssueTemplate | FormIssueTemplate;

/** A markdown template (`.github/ISSUE_TEMPLATE/*.md`): its title, body and what it sets. */
export interface MarkdownIssueTemplate {
    readonly kind: 'markdown';
    readonly filename: string;
    readonly name: string;
    readonly about: string | null;
    readonly title: string | null;
    readonly body: string;
    readonly labels: readonly string[];
    readonly assignees: readonly string[];
    readonly type: string | null;
}

/** An issue form (`.github/ISSUE_TEMPLATE/*.yml`). */
export interface FormIssueTemplate {
    readonly kind: 'form';
    readonly form: IssueForm;
}

/**
 * The issue templates and forms of repositories (H7, H8, D10): read when a new issue's repository is chosen, in
 * one request (`RepositoryIssueTemplates` — forms are not among GitHub's `issueTemplates`, so their files are read
 * with them), and used for 10 minutes. Kept in memory only, for the signed-in user.
 */
export type IssueTemplateStore = Resolved<typeof IssueTemplateStore>;
export const IssueTemplateStore = defineService({
    name: 'IssueTemplateStore',
    deps: {
        accounts: AccountSession,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, clock, logger }) {
        const templatesRef = shallowRef<ReadonlyMap<string, RepositoryTemplates>>(new Map());
        let reads: ExpiringReads<string, RepositoryTemplates> | null = null;

        accounts.onChange(account => {
            templatesRef.value = new Map();
            reads = account
                ? createExpiringReads({
                      now: () => clock.now(),
                      maxAgeMs: TEMPLATES_TTL_MS,
                      getKept: nameWithOwner => templatesRef.value.get(nameWithOwner),
                      read: nameWithOwner => read(account, nameWithOwner),
                  })
                : null;
        });

        return {
            /** The repository's templates as last read, or `undefined`; reactive. */
            get(nameWithOwner: string) {
                return templatesRef.value.get(nameWithOwner);
            },
            ensure,
        };

        /**
         * The repository's templates: the copy in memory while it is under 10 minutes old, else read. Never rejects:
         * `null` when GitHub does not answer or does not show the repository — the issue is then written blank.
         */
        function ensure(nameWithOwner: string): Promise<RepositoryTemplates | null> {
            return reads?.ensure(nameWithOwner) ?? Promise.resolve(null);
        }

        async function read(current: Account, nameWithOwner: string) {
            let answer: RepositoryIssueTemplatesQuery;
            try {
                answer = await current.sdk.RepositoryIssueTemplates(parseRepositoryName(nameWithOwner));
            } catch (error) {
                if (accounts.isCurrent(current)) {
                    logger.warn('Issue templates could not be read', { nameWithOwner, error });
                }

                return null;
            }

            const { repository } = answer;
            if (!repository || !accounts.isCurrent(current)) {
                return null;
            }

            const forms = await readForms(repository.templateFiles);
            if (!accounts.isCurrent(current)) {
                return null;
            }

            const templates: RepositoryTemplates = {
                nameWithOwner,
                blankIssuesEnabled: repository.isBlankIssuesEnabled,
                templates: [
                    ...(repository.issueTemplates ?? []).map((template): MarkdownIssueTemplate => ({
                        kind: 'markdown',
                        filename: template.filename,
                        name: template.name,
                        about: template.about ?? null,
                        title: template.title ?? null,
                        body: template.body ?? '',
                        labels: filterNotNull(template.labels?.nodes ?? []).map(label => label.name),
                        assignees: filterNotNull(template.assignees.nodes ?? []).map(user => user.login),
                        type: template.type?.name ?? null,
                    })),
                    ...forms.map((form): FormIssueTemplate => ({ kind: 'form', form })),
                ],
                fetchedAt: clock.now(),
            };
            templatesRef.value = new Map(templatesRef.value).set(nameWithOwner, templates);
            return templates;
        }
    },
});

/** The files of the template folder that are issue forms (`config.yml` and markdown templates are not). */
type TemplateFiles = NonNullable<RepositoryIssueTemplatesQuery['repository']>['templateFiles'];

async function readForms(files: TemplateFiles): Promise<IssueForm[]> {
    // Not a folder (a file of that name), or none: no forms.
    if (!files || !('entries' in files)) {
        return [];
    }

    const forms: IssueForm[] = [];
    for (const entry of files.entries ?? []) {
        const blob = entry.object && 'text' in entry.object ? entry.object : null;
        if (!/\.ya?ml$/u.test(entry.name) || /^config\.ya?ml$/u.test(entry.name) || !blob?.text || blob.isTruncated) {
            continue;
        }

        const form = await parseIssueForm(entry.name, blob.text);
        if (form) {
            forms.push(form);
        }
    }

    return forms;
}
