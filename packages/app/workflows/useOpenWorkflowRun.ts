import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { useService } from '@nzyme/vue-ioc/useService.js';

import { Browser } from '@/services/Browser.js';

/**
 * Opening a workflow's run when it is pressed: on GitHub, in a new tab, for now — the one place that changes once
 * githq has a run page of its own, apart from `RunStrip`'s ticks, which are links to the run.
 */
export function useOpenWorkflowRun() {
    const browser = useService(Browser);

    return openWorkflowRun;

    function openWorkflowRun(run: GitHubWorkflowRun) {
        browser.openInNewTab(run.htmlUrl);
    }
}
