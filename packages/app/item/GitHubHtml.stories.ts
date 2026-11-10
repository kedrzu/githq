import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { withGitHubLinks } from '@/testing/withGitHubLinks.js';

import GitHubHtml from './GitHubHtml.vue';

/**
 * A body as GitHub renders it: links to an item, a repository's list, a profile, a commit and the same address on
 * another host, and a footnote.
 */
const BODY = [
    '<p>Follows up <a class="issue-link js-issue-link" data-hovercard-type="issue" href="https://github.com/acme/web/issues/12#issuecomment-5">a comment on #12</a>;',
    ' the rest is in <a href="https://github.com/acme/web/issues?q=is%3Aopen">the open issues</a>.',
    ' Thanks <a class="user-mention notranslate" href="https://github.com/octocat">@octocat</a>,',
    ' fixed in <a href="https://github.com/acme/web/commit/a1b2c3d"><tt>a1b2c3d</tt></a>',
    ' (mirrored on <a href="https://gitlab.com/acme/web/issues/12">GitLab</a>).',
    '<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref="" aria-describedby="footnote-label">1</a></sup></p>',
    '<section data-footnotes="" class="footnotes"><h2 id="footnote-label" class="sr-only">Footnotes</h2><ol>',
    '<li id="user-content-fn-1"><p>Seen in Safari only. <a href="#user-content-fnref-1" data-footnote-backref="" aria-label="Back to reference 1">↩</a></p></li>',
    '</ol></section>',
].join('');

const meta = {
    component: GitHubHtml,
    args: { html: BODY },
} satisfies Meta<typeof GitHubHtml>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Its links to an item and a repository's list open in githq; the profile, the commit, another host and the footnote stay as given. */
export const Body: Story = { decorators: [withGitHubLinks()] };

/** The same in an opened item: the item linked opens there. */
export const BodyInItem: Story = { decorators: [withGitHubLinks({ inItem: true })] };
