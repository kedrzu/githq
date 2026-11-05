/** Options of {@link decodeBase64Text}. */
export interface DecodeBase64TextOptions {
    /** Keeps a BOM at the start, which is otherwise dropped. */
    readonly keepBom?: boolean;
}

/**
 * UTF-8 text from base64 broken into lines, as GitHub sends a file's content. A BOM is dropped unless `keepBom`.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function decodeBase64Text(content: string, { keepBom = false }: DecodeBase64TextOptions = {}): string {
    // `atob` gives one character per byte, which must then be read as UTF-8.
    const binary = atob(content.replaceAll(/\s/g, ''));
    const bytes = Uint8Array.from(binary, character => character.codePointAt(0) ?? 0);
    return new TextDecoder('utf-8', { ignoreBOM: keepBom }).decode(bytes);
}
