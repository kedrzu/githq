import type { GitHubMock } from '../github/GitHubMock.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

const REPOSITORY_PATH = `/repos/${SAMPLE_VIEWER.viewer.login}/githq-settings`;
const FILE_PATH = `${REPOSITORY_PATH}/contents/settings.json`;

/** The sample user's settings repository as a test keeps it: whether it exists, and its file. */
export interface SettingsRepository {
    exists: boolean;
    file: { text: string; sha: string } | null;
    /** It holds commits of something else than githq's file: a repository of that name that isn't githq's. */
    foreign?: boolean;
}

/** A write of the settings file as the app sent it: the content in base64, over the version `sha`. */
interface SettingsWrite {
    readonly content: string;
    readonly sha: string | undefined;
}

/**
 * Answers the sample user's settings repository and its file as `repository` says, keeping what is written to it —
 * its creation (`POST /user/repos`) too. Returns `repository`, which changes as the app writes.
 */
export function answerSettingsRepository(github: GitHubMock, repository: SettingsRepository): SettingsRepository {
    let version = 0;
    github.rest('GET', REPOSITORY_PATH, () =>
        repository.exists
            ? { status: 200, json: { private: true, node_id: 'R_settings' } }
            : { status: 404, json: { message: 'Not Found' } },
    );
    github.rest('GET', `${REPOSITORY_PATH}/commits`, () => {
        if (!repository.exists) {
            return { status: 404, json: { message: 'Not Found' } };
        }

        return repository.file || repository.foreign
            ? { status: 200, json: [{ sha: 'commit' }] }
            : { status: 409, json: { message: 'Git Repository is empty.' } };
    });
    github.rest('POST', '/user/repos', () => {
        repository.exists = true;
        return { status: 201, json: { name: 'githq-settings' } };
    });
    github.rest('GET', FILE_PATH, ({ ifNoneMatch }) => {
        const { file } = repository;
        if (!repository.exists || !file) {
            return { status: 404, json: { message: 'Not Found' } };
        }

        const etag = `"${file.sha}"`;
        return ifNoneMatch === etag
            ? { status: 304, etag }
            : {
                  status: 200,
                  etag,
                  json: { encoding: 'base64', content: Buffer.from(file.text).toString('base64'), sha: file.sha },
              };
    });
    github.rest('PUT', FILE_PATH, ({ body }) => {
        if (!repository.exists) {
            return { status: 404, json: { message: 'Not Found' } };
        }

        const sent = readWrite(body);
        if (repository.file && sent.sha !== repository.file.sha) {
            return { status: 409, json: { message: `settings.json does not match ${String(sent.sha)}` } };
        }

        repository.file = { text: Buffer.from(sent.content, 'base64').toString(), sha: `sha${++version}` };
        return { status: 200, json: { content: { sha: repository.file.sha } } };
    });
    return repository;
}

/** The writes to GitHub the app made so far: creating the repository, and writing the file. */
export function getSettingsWrites(github: GitHubMock) {
    return github.restCalls.filter(call => call.method === 'PUT' || call.method === 'POST');
}

/** How many times the app created the settings repository so far. */
export function countSettingsCreations(github: GitHubMock) {
    return github.restCalls.filter(call => call.method === 'POST' && call.url.pathname === '/user/repos').length;
}

function readWrite(body: unknown): SettingsWrite {
    if (typeof body !== 'object' || body === null || !('content' in body) || typeof body.content !== 'string') {
        throw new Error('A settings write without content');
    }

    return { content: body.content, sha: 'sha' in body && typeof body.sha === 'string' ? body.sha : undefined };
}
