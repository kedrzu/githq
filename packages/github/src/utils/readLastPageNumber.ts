const LAST_PAGE_PATTERN = /<[^>]*[?&]page=(\d+)[^>]*>\s*;\s*rel="last"/;

/**
 * Reads how many pages a REST list has from its answer's `Link` header, the `page` of the URL GitHub marks `rel="last"`;
 * `undefined` when it marks none, as on the last page itself.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function readLastPageNumber(headers: Headers): number | undefined {
    const page = LAST_PAGE_PATTERN.exec(headers.get('link') ?? '')?.[1];
    return page === undefined ? undefined : Number(page);
}
