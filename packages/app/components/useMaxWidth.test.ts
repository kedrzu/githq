import { expect, mock, test } from 'bun:test';
import { ref } from 'vue';

import type { MaxWidth } from '@/settings/sync/SettingsDocument.js';

import { useMaxWidth } from './useMaxWidth.js';

test('the box is drawn at the maximum within the room, never below the minimum; the default without one', () => {
    const { box, saved, room } = createBox({ saved: null, room: 1600 });
    expect(box.shown).toBe(1000);

    saved.value = 1400;
    expect(box.shown).toBe(1400);
    room.value = 1200;
    expect(box.shown).toBe(1200);
    room.value = 600;
    expect(box.shown).toBe(MIN);

    saved.value = 'full';
    room.value = 1500;
    expect(box.shown).toBe(1500);
    expect(box.current).toBe(1500);
});

test('a smaller room, a press without a move and a key that resizes nothing write nothing', () => {
    const { box, room, save } = createBox({ saved: 1400, room: 1600 });
    room.value = 1000;
    box.save();
    // What the handle sets on a move by nothing: the width the box is drawn at.
    box.current = box.shown;
    box.save();
    room.value = 1600;
    box.save();

    expect(save).not.toHaveBeenCalled();
    expect(box.shown).toBe(1400);
});

test('dragged to the edge of the room it saves "full", elsewhere the pixels, rounded; the same again writes nothing', () => {
    const { box, saved, save } = createBox({ saved: 1000, room: 1600 });
    box.current = 1200.4;
    expect(box.shown).toBe(1200);
    box.save();
    expect(save).toHaveBeenLastCalledWith(1200);
    expect(saved.value).toBe(1200);

    box.current = 1593;
    box.save();
    expect(save).toHaveBeenLastCalledWith('full');
    expect(box.shown).toBe(1600);

    box.current = 1594;
    box.save();
    expect(save).toHaveBeenCalledTimes(2);
});

test('a maximum changed elsewhere redraws the box, and a drag ends where it was let go', () => {
    const { box, saved } = createBox({ saved: 1000, room: 1600 });
    saved.value = 1300;
    expect(box.shown).toBe(1300);

    box.current = 1100;
    saved.value = 1400;
    expect(box.shown).toBe(1100);
    box.save();
    expect(box.shown).toBe(1100);
});

const MIN = 900;

/** What {@link createBox} starts from. */
interface BoxStart {
    readonly saved: MaxWidth | null;
    readonly room: number;
}

/** A box over a maximum kept in `saved`, as the store keeps it. */
function createBox(initial: BoxStart) {
    const saved = ref<MaxWidth | null>(initial.saved);
    const room = ref(initial.room);
    const save = mock((width: MaxWidth) => {
        saved.value = width;
    });
    const box = useMaxWidth({ saved, save, default: 1000, min: MIN, room });
    return { box, saved, room, save };
}
