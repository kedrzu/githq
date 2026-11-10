import { shallowReactive } from 'vue';

import type {
    ReviewCommentStatus,
    ReviewCommentTarget,
    ReviewCommentWay,
    ReviewWriteFailure,
    ReviewWriting,
} from '@/review/writing/ReviewWriting.js';
import { NO_REVIEW_SUBMISSION, REVIEW_FINISH_IDLE } from '@/review/writing/ReviewWriting.js';

/** A send {@link FakeReviewWriting} recorded. */
export interface FakeReviewSend {
    readonly body: string;
    readonly way: ReviewCommentWay;
    readonly threadId: string | null;
}

/** A change of a thread's state {@link FakeReviewWriting} recorded. */
export interface FakeReviewResolve {
    readonly threadId: string;
    readonly resolved: boolean;
}

/**
 * A pull request's writing for an item thread's stories and specs: it keeps its boxes in memory as code review's does —
 * opened, typed in, closed, sent ("Sending…" until {@link answer}) — and records sends and resolves; nothing reaches
 * GitHub. A class, so that Storybook hands it over as it is rather than merging it as a plain object.
 */
export class FakeReviewWriting implements ReviewWriting {
    readonly draftOpen: boolean;
    readonly draftCount = 0;
    readonly finish = REVIEW_FINISH_IDLE;
    readonly canRetry = false;
    readonly canDismiss = false;
    readonly submission = NO_REVIEW_SUBMISSION;

    private readonly state = shallowReactive<FakeState>({
        targets: [],
        texts: new Map(),
        statuses: new Map(),
        sent: [],
        resolved: [],
    });

    private next = 0;

    constructor(options: FakeReviewWritingOptions = {}) {
        this.draftOpen = options.draftOpen ?? false;
    }

    get targets(): readonly ReviewCommentTarget[] {
        return this.state.targets;
    }

    get hasText(): boolean {
        return [...this.state.texts.values()].some(text => text.trim() !== '');
    }

    /** What {@link send} was asked to send, oldest first. */
    get sent(): readonly FakeReviewSend[] {
        return this.state.sent;
    }

    /** What {@link setResolved} was asked, oldest first. */
    get resolved(): readonly FakeReviewResolve[] {
        return this.state.resolved;
    }

    setSubmission(): void {}

    open(wanted: Omit<ReviewCommentTarget, 'id'>): ReviewCommentTarget {
        const held = this.state.targets.find(
            target => target.threadId === wanted.threadId && this.getStatus(target.id).kind !== 'sending',
        );
        if (held) {
            return held;
        }

        const target = { ...wanted, id: `box${++this.next}` };
        this.state.targets = [...this.state.targets, target];
        return target;
    }

    setRange(): void {}

    hasCodeChanged(): boolean {
        return false;
    }

    close(id: string): void {
        this.state.targets = this.state.targets.filter(target => target.id !== id);
        this.state.texts = withValue(this.state.texts, id, null);
        this.state.statuses = withValue(this.state.statuses, id, null);
    }

    getText(id: string): string {
        return this.state.texts.get(id) ?? '';
    }

    setText(id: string, text: string): void {
        this.state.texts = withValue(this.state.texts, id, text);
    }

    getStatus(id: string): ReviewCommentStatus {
        return this.state.statuses.get(id) ?? { kind: 'editing' };
    }

    send(id: string, way: ReviewCommentWay): void {
        const body = this.getText(id).trim();
        const target = this.state.targets.find(other => other.id === id);
        if (!target || body === '') {
            return;
        }

        this.state.sent = [...this.state.sent, { body, way, threadId: target.threadId }];
        this.state.statuses = withValue(this.state.statuses, id, { kind: 'sending', way, body });
    }

    /** GitHub's answer to the box, as the real writing would show it: a failure keeps the text. */
    answer(id: string, status: ReviewCommentStatus): void {
        this.state.statuses = withValue(this.state.statuses, id, status);
    }

    submit(): void {}

    discard(): void {}

    retry(): void {}

    dismiss(): void {}

    setResolved(threadId: string, resolved: boolean): void {
        this.state.resolved = [...this.state.resolved, { threadId, resolved }];
    }

    getResolveFailure(): ReviewWriteFailure | null {
        return null;
    }
}

/** What {@link FakeReviewWriting} starts with. */
export interface FakeReviewWritingOptions {
    /** The viewer's draft review is open: a reply can only join it. */
    readonly draftOpen?: boolean;
}

/** What the fake holds, replaced whole on each change. */
interface FakeState {
    targets: readonly ReviewCommentTarget[];
    texts: ReadonlyMap<string, string>;
    statuses: ReadonlyMap<string, ReviewCommentStatus>;
    sent: readonly FakeReviewSend[];
    resolved: readonly FakeReviewResolve[];
}

function withValue<T>(map: ReadonlyMap<string, T>, id: string, value: T | null): ReadonlyMap<string, T> {
    const copy = new Map(map);
    if (value === null) {
        copy.delete(id);
    } else {
        copy.set(id, value);
    }

    return copy;
}
