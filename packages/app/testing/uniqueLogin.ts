/**
 * A login no other test uses, so a test's session, storage and database keep nothing in common with another's.
 *
 * @util
 */
export function uniqueLogin() {
    return `user-${crypto.randomUUID()}`;
}
