/**
 * The ref a typed filter means (actions W3b): none for nothing typed; the ref named exactly; else the first ref
 * seen whose name holds what was typed, in any case; else what was typed, as an exact ref not seen yet.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function matchTypedRef(typed: string, refs: readonly string[]): string | null {
    const text = typed.trim();
    if (text === '') {
        return null;
    }

    const lower = text.toLowerCase();
    return refs.find(ref => ref === text) ?? refs.find(ref => ref.toLowerCase().includes(lower)) ?? text;
}
