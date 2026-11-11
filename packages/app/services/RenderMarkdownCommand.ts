import type { RenderMarkdownParams } from '@githq/github/rest/renderMarkdown.js';
import { renderMarkdown } from '@githq/github/rest/renderMarkdown.js';
import { defineCommand } from '@nzyme/ioc/Command.js';
import { assert } from '@nzyme/utils/assert.js';

import { AccountSession } from '@/auth/AccountSession.js';

/**
 * Renders Markdown the user wrote as GitHub will show it, for a preview before it is posted, through the signed-in
 * account. Throws when nobody is signed in or GitHub refuses.
 */
export interface RenderMarkdownCommandShape {
    (params: RenderMarkdownParams): Promise<string>;
}

/** {@link RenderMarkdownCommandShape} */
export const RenderMarkdownCommand = defineCommand({
    name: 'RenderMarkdownCommand',
    deps: { session: AccountSession },
    setup({ session }): RenderMarkdownCommandShape {
        return params => {
            const account = session.current;
            assert(account, 'Rendering Markdown needs a signed-in account');
            return renderMarkdown(account.rest, params);
        };
    },
});
