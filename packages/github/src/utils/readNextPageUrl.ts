const NEXT_LINK_PATTERN = /<([^>]+)>\s*;\s*rel="next"/;

/**
 * Reads the URL of the next page from a REST answer's `Link` header — GitHub pages its lists by handing out
 * that URL (`<…&page=2>; rel="next"`); `undefined` on the last page.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function readNextPageUrl(headers: Headers): string | undefined {
    return NEXT_LINK_PATTERN.exec(headers.get('link') ?? '')?.[1];
}
