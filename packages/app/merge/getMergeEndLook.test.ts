/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { CircleHelp, CircleX, TriangleAlert } from 'lucide-vue-next';

import { getMergeEndLook } from './getMergeEndLook.js';

test('PM37, PM38: refused in red, a new commit in amber, no answer in grey — the same wherever it is said', () => {
    expect(getMergeEndLook('refused')).toEqual({ tone: 'danger', icon: CircleX });
    expect(getMergeEndLook('methodNotAllowed')).toEqual({ tone: 'danger', icon: CircleX });
    expect(getMergeEndLook('headMoved')).toEqual({ tone: 'warning', icon: TriangleAlert });
    expect(getMergeEndLook('unknown')).toEqual({ tone: 'muted', icon: CircleHelp });
});
