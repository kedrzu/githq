/**
 * The broken workflows of every tracked repository (actions W2), under a first segment GitHub reserves
 * (`/dashboard`), so the address is never an owner's or a repository's.
 */
export const BROKEN_WORKFLOWS_PATH = '/dashboard/workflows';

/**
 * The address of the broken workflows of every tracked repository.
 * @__NO_SIDE_EFFECTS__
 */
export function getBrokenWorkflowsPath() {
    return BROKEN_WORKFLOWS_PATH;
}
