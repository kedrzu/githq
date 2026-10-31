// The test id attribute (`tid`, see `vitest.config.ts`) on any element in TSX: stories mark what a spec
// reads with `page.getByTestId`.
import 'vue';

declare module 'vue' {
    interface HTMLAttributes {
        /** Test id, found by `getByTestId` in component specs. */
        tid?: string;
    }
}
