import type { FunctionalComponent } from 'vue';

/** Props of `StorySection`. */
export interface StorySectionProps {
    /** What the section shows ("Variants"). */
    title: string;
}

/** A page of a component's stories: sections one under the other, with room around them. */
export const StoryPage: FunctionalComponent = (_props, { slots }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>{slots.default?.()}</div>
);

/** A titled group of examples. */
export const StorySection: FunctionalComponent<StorySectionProps> = (props, { slots }) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={{ fontSize: '11.5px', fontWeight: 500, color: '#838992' }}>{props.title}</h2>
        {slots.default?.()}
    </section>
);

/** Examples side by side, centred on one line. */
export const StoryRow: FunctionalComponent = (_props, { slots }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>{slots.default?.()}</div>
);
