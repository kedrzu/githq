import { splitLines } from '../diff/splitLines.js';
import type { LineTokens } from './getLineSpans.js';
import type { SyntaxLanguage } from './getSyntaxLanguage.js';
import { loadGrammar, tokenizeLines } from './tokenizeLines.js';

/** A version of a file to tokenize. */
export interface TokenizeRequest {
    readonly language: SyntaxLanguage;
    readonly text: string;
}

/** Its tokens, or `null` to show it plain. */
export type TokenizeResponse = LineTokens | null;

onmessage = async ({ data }: MessageEvent<TokenizeRequest>) => {
    const tokens = await tokenize(data);
    // Moved, not copied: this is what makes the way back cost the main thread nothing.
    postMessage(tokens, { transfer: tokens ? [tokens.starts.buffer, tokens.ranges.buffer] : [] });
};

async function tokenize({ language, text }: TokenizeRequest): Promise<TokenizeResponse> {
    try {
        await loadGrammar(language);
        return tokenizeLines(language, splitLines(text));
    } catch {
        // A grammar's chunk that didn't load: this file stays plain.
        return null;
    }
}
