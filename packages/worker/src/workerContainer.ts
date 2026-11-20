import { envSource } from '@nzyme/config/envSource.js';
import { loadConfig } from '@nzyme/config/loadConfig.js';
import { createContainer } from '@nzyme/ioc/Container.js';
import type { Container } from '@nzyme/ioc/Container.js';
import type { EnvVariables } from '@nzyme/ioc/helpers/EnvVariables.js';

import type { WorkerEnv } from './WorkerEnv.js';

/** One container per bindings object, which Cloudflare keeps for the isolate's life: the config is loaded once. */
const containers = new WeakMap<WorkerEnv, Promise<Container>>();

/**
 * The Worker's container, its config loaded from its text bindings (the `vars` and the secrets). The Worker resolves
 * a secret of `@githq/secrets` through it, never from `env`: the value is set with `wrangler secret put` in
 * production and comes from `wrangler dev`'s environment in development. The Worker has no secret store of its own,
 * so it bundles only the declarations.
 */
export function getWorkerContainer(env: WorkerEnv): Promise<Container> {
    let container = containers.get(env);
    if (!container) {
        container = createWorkerContainer(env);
        containers.set(env, container);
    }
    return container;
}

async function createWorkerContainer(env: WorkerEnv): Promise<Container> {
    const container = createContainer();
    await loadConfig(container, [envSource(textBindings(env))]);
    return container;
}

/** The bindings holding text; the rest (the assets, the dataset) are objects that no config key can hold. */
function textBindings(env: WorkerEnv): EnvVariables {
    return Object.fromEntries(
        Object.entries(env).filter((binding): binding is [string, string] => typeof binding[1] === 'string'),
    );
}
