import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';

/** A repository or project as the user names it to track it (G10, G8): by its name or its address. */
export type TrackingReference =
    | { readonly kind: 'repository'; readonly owner: string; readonly name: string }
    | {
          readonly kind: 'project';
          readonly owner: string;
          readonly ownerKind: ProjectOwnerKind;
          readonly number: number;
      };

const OWNER = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const PROJECT_PATTERN = new RegExp(`^(orgs|users)/(${OWNER})/projects/(\\d+)(?:[/?#].*)?$`);
const REPOSITORY_PATTERN = new RegExp(`^(${OWNER})/([A-Za-z0-9._-]+?)(?:\\.git)?(?:[/?#].*)?$`);

/**
 * What the user typed to track something: `owner/name`, a repository's address (`github.com/owner/name/…`), or
 * a project's (`github.com/orgs/<login>/projects/<n>`, `…/users/<login>/projects/<n>`, a view's included).
 * `null` for anything else.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseTrackingReference(text: string): TrackingReference | null {
    const path = text
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.)?github\.com\//i, '');

    const project = PROJECT_PATTERN.exec(path);
    if (project) {
        const [, kind, owner = '', number = ''] = project;
        return { kind: 'project', owner, ownerKind: kind === 'orgs' ? 'org' : 'user', number: Number(number) };
    }

    const repository = REPOSITORY_PATTERN.exec(path);
    if (repository) {
        const [, owner = '', name = ''] = repository;
        if (name !== '.' && name !== '..') {
            return { kind: 'repository', owner, name };
        }
    }

    return null;
}
