import type { IssueTypeColor, ProjectV2SingleSelectFieldOptionColor } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

/**
 * The hex colour, without `#`, githq draws one of GitHub's named colours in — an issue type's or a project
 * option's — on its dark background (what `LabelPill` and a field's dot take).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getGitHubColor(color: IssueTypeColor | ProjectV2SingleSelectFieldOptionColor) {
    switch (color) {
        case 'BLUE':
            return '4493f8';
        case 'GRAY':
            return '9198a1';
        case 'GREEN':
            return '3fb950';
        case 'ORANGE':
            return 'db6d28';
        case 'PINK':
            return 'db61a2';
        case 'PURPLE':
            return 'ab7df8';
        case 'RED':
            return 'f85149';
        case 'YELLOW':
            return 'd29922';
        default:
            return assertNever(color);
    }
}
