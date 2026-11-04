/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { getWorkflowRunPathOfUrl } from './trackingRoutes.js';

test('a run and a job of github.com become the app path of the repository in the address', () => {
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web/actions/runs/123')).toBe('/acme/web/actions/runs/123');
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web.js/actions/runs/123/job/456')).toBe(
        '/acme/web.js/actions/runs/123/job/456',
    );
});

test('query, fragment and a trailing slash are ignored', () => {
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web/actions/runs/123/?pr=9#step:3:1')).toBe(
        '/acme/web/actions/runs/123',
    );
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web/actions/runs/123/job/456?pr=9')).toBe(
        '/acme/web/actions/runs/123/job/456',
    );
});

test('another host, scheme or authority is never an app link', () => {
    for (const url of [
        'https://example.com/acme/web/actions/runs/123',
        'https://github.com.evil.test/acme/web/actions/runs/123',
        'https://evil.test/github.com/acme/web/actions/runs/123',
        'https://www.github.com/acme/web/actions/runs/123',
        'https://github.com:8443/acme/web/actions/runs/123',
        'http://github.com/acme/web/actions/runs/123',
        'javascript:https://github.com/acme/web/actions/runs/123',
    ]) {
        expect(getWorkflowRunPathOfUrl(url)).toBeNull();
    }
});

test('anything under runs/ other than a run or a job is not an app link', () => {
    for (const path of [
        'runs/123/attempts/2',
        'runs/abc',
        'runs/123/job',
        'runs/123/job/abc',
        'runs/123/usage',
        'runs/123/job/456/extra',
        'runs',
        'runs/',
        'workflows/ci.yml',
    ]) {
        expect(getWorkflowRunPathOfUrl(`https://github.com/acme/web/actions/${path}`)).toBeNull();
    }
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web/runs/123')).toBeNull();
    expect(getWorkflowRunPathOfUrl('https://github.com/acme/web/x/actions/runs/123')).toBeNull();
});

test('a malformed address gives null without throwing', () => {
    for (const url of [
        '',
        'not a url',
        '//github.com/acme/web/actions/runs/1',
        'https://',
        '/acme/web/actions/runs/1',
    ]) {
        expect(getWorkflowRunPathOfUrl(url)).toBeNull();
    }
});
