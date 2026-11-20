#!/usr/bin/env -S bun --conditions=source
/**
 * The githq CLI, `bun githq …` from the repo root: the `secrets` commands (the `secrets` skill) and the `pen`
 * commands for `githq.pen` (the merge driver, the check in `lint`, diff and render; the `design` skill).
 */
import { execute } from '@nzyme/cli-core/execute.js';
import { definePenCommands } from '@nzyme/pen/definePenCommands.js';
import { defineSecretsCommands } from '@nzyme/secrets/commands/defineSecretsCommands.js';

import { GithqSecrets } from './secrets/GithqSecrets.js';

await execute({
    name: 'githq',
    commands: [...defineSecretsCommands({ provider: GithqSecrets }), ...definePenCommands()],
});
