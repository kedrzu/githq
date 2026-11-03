/**
 * A repeatable `Math.random` for tests on random data: a failure has to reproduce.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}
