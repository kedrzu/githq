/**
 * Every secret githq uses. Code resolves them through the container (a script after `loadGithqConfig`, the Worker
 * from its bindings), never from `process.env`. `GITHQ_ENV` (`githqEnv.ts`: `dev` by default, `prod`, `stats`) picks
 * the store's prefix (`GithqSecretStore`) and which secrets apply. Nothing but declarations lives here, so the Worker
 * bundle that imports this module pulls no store code. How to use them: the `secrets` skill.
 */
import type { EnvVariables } from '@nzyme/ioc/helpers/EnvVariables.js';
import { defineSecret } from '@nzyme/secrets/defineSecret.js';

function githqEnv(env: EnvVariables) {
    return env.GITHQ_ENV ?? 'dev';
}

function inProd(env: EnvVariables) {
    return githqEnv(env) === 'prod';
}

/** Its client ID is public, in `packages/github/src/oauthClientIds.json`. */
export const GITHUB_CLIENT_SECRET = defineSecret('GITHUB_CLIENT_SECRET', {
    description: "The OAuth App's client secret, for the Worker's token exchange",
    enabled: env => githqEnv(env) === 'dev' || githqEnv(env) === 'prod',
});

// Production only, so that `bun run dev` never holds what signs updates and the app.

export const TAURI_SIGNING_PRIVATE_KEY = defineSecret('TAURI_SIGNING_PRIVATE_KEY', {
    description: "The key signing the desktop app's updates",
    enabled: inProd,
});

export const TAURI_SIGNING_PRIVATE_KEY_PASSWORD = defineSecret('TAURI_SIGNING_PRIVATE_KEY_PASSWORD', {
    description: 'The password of TAURI_SIGNING_PRIVATE_KEY',
    enabled: inProd,
});

export const APPLE_CERTIFICATE = defineSecret('APPLE_CERTIFICATE', {
    description: 'The Developer ID Application certificate, a base64 .p12',
    enabled: inProd,
});

export const APPLE_CERTIFICATE_PASSWORD = defineSecret('APPLE_CERTIFICATE_PASSWORD', {
    description: "The .p12's export password",
    enabled: inProd,
});

export const APPLE_SIGNING_IDENTITY = defineSecret('APPLE_SIGNING_IDENTITY', {
    description: 'The signing identity, "Developer ID Application: Name (TEAMID)"',
    enabled: inProd,
});

export const APPLE_ID = defineSecret('APPLE_ID', {
    description: "The Apple Account's email, for notarization",
    enabled: inProd,
});

export const APPLE_PASSWORD = defineSecret('APPLE_PASSWORD', {
    description: 'An app-specific password of APPLE_ID, for notarization',
    enabled: inProd,
});

export const APPLE_TEAM_ID = defineSecret('APPLE_TEAM_ID', {
    description: 'The Apple Developer team ID',
    enabled: inProd,
});

/** Read by the release workflow only (Universal Links); a local build stays without it. */
export const APPLE_PROVISIONING_PROFILE = defineSecret('APPLE_PROVISIONING_PROFILE', {
    description: 'The provisioning profile, base64',
    enabled: inProd,
});

/**
 * Its own environment: `secrets run` refuses to start with an enabled secret missing, so the token must not join
 * `dev` or `prod`, where it would stop `bun run dev` and the release builds until it is stored.
 */
export const CLOUDFLARE_ANALYTICS_TOKEN = defineSecret('CLOUDFLARE_ANALYTICS_TOKEN', {
    description: 'A Cloudflare API token with Account Analytics: Read, for `bun --cwd packages/worker stats`',
    enabled: env => githqEnv(env) === 'stats',
});
