/**
 * Why the app itself would not read a job's log (the desktop app reads it natively, actions D3): `tooLarge` — past what
 * it reads at most; `refused` — anything else it turned down.
 */
export type JobLogRefusalReason = 'tooLarge' | 'refused';

/** A job's log the app turned down, GitHub having no part in it: thrown where the log is read, kept apart from "no answer". */
export class JobLogRefusal extends Error {
    readonly reason: JobLogRefusalReason;

    constructor(reason: JobLogRefusalReason) {
        super(`The app refused a job's log: ${reason}`);
        this.reason = reason;
    }
}
