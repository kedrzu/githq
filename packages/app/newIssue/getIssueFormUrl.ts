/** What {@link getIssueFormUrl} opens. */
export interface GetIssueFormUrlParams {
    /** `owner/name`. */
    readonly repository: string;
    /** The form's file name (`bug_report.yml`). */
    readonly filename: string;
    readonly title: string;
}

/**
 * GitHub's own page for a new issue from the form, with the title already in it (D14): where an issue form
 * continues in a repository the user can't push to — GitHub applies the form's labels and checks its fields there,
 * which it does not for an issue githq creates.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getIssueFormUrl(params: GetIssueFormUrlParams): string {
    const url = new URL(`https://github.com/${params.repository}/issues/new`);
    url.searchParams.set('template', params.filename);
    if (params.title.trim()) {
        url.searchParams.set('title', params.title.trim());
    }

    return url.toString();
}
