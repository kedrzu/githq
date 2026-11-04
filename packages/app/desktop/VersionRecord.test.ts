import { expect, test } from 'bun:test';

import { advanceVersionRecord, getUntoldChange, parseVersionRecord } from './VersionRecord.js';
import type { VersionRecord } from './VersionRecord.js';

const RUNNING: VersionRecord = { version: '0.1.0', previousVersion: null, untold: false };

test('the first ever run records the version and has nothing to tell', () => {
    const record = advanceVersionRecord(null, '0.1.0');

    expect(record).toEqual(RUNNING);
    expect(getUntoldChange(record)).toBeNull();
});

test('another version is an update to tell, up or down, and it replaces what counted as previous', () => {
    const updated = advanceVersionRecord(RUNNING, '0.2.0');
    expect(getUntoldChange(updated)).toEqual({ version: '0.2.0', previousVersion: '0.1.0' });

    expect(advanceVersionRecord({ ...updated, untold: false }, '0.3.0-dev.214')).toEqual({
        version: '0.3.0-dev.214',
        previousVersion: '0.2.0',
        untold: true,
    });
    expect(getUntoldChange(advanceVersionRecord(updated, '0.1.0'))).toEqual({
        version: '0.1.0',
        previousVersion: '0.2.0',
    });
});

test('the same version again keeps the previous one, told or not', () => {
    const told: VersionRecord = { version: '0.2.0', previousVersion: '0.1.0', untold: false };
    expect(advanceVersionRecord(told, '0.2.0')).toEqual(told);
    expect(getUntoldChange(advanceVersionRecord(told, '0.2.0'))).toBeNull();

    const untold: VersionRecord = { ...told, untold: true };
    expect(getUntoldChange(advanceVersionRecord(untold, '0.2.0'))).toEqual({
        version: '0.2.0',
        previousVersion: '0.1.0',
    });
});

test('what is kept reads back; anything else reads as nothing kept', () => {
    expect(parseVersionRecord(JSON.stringify(RUNNING))).toEqual(RUNNING);
    for (const raw of [null, '', '{', '[]', '{"version":1}', '{"version":"1","previousVersion":2,"untold":false}']) {
        expect(parseVersionRecord(raw)).toBeNull();
    }
});
