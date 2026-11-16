/** How a list's toolbar (`ListToolbar`) fitted at one width. */
export interface ToolbarFit {
    readonly width: number;
    /** How far it has given way: 0 as drawn in full, 1 "Display" an icon, 2 the tabs one menu as well. */
    readonly step: number;
    /** The keys of the view options left on the toolbar. */
    readonly options: readonly string[];
    /** The keys (or text) of the controls whose box crosses the left part's. */
    readonly overlaps: readonly string[];
}

/**
 * Draws the toolbar inside `frame` at each width in turn, waiting for it to measure itself, and reports how it fitted.
 * Reads the parts `ListToolbar` marks with test ids.
 */
export async function narrowToolbar(frame: HTMLElement, widths: readonly number[]) {
    const fits: ToolbarFit[] = [];
    for (const width of widths) {
        frame.style.width = `${width}px`;
        // The observer, the frame `fit` waits for, the render, and once more for what the render resized.
        for (let turn = 0; turn < 6; turn++) {
            await new Promise(resolve => {
                requestAnimationFrame(resolve);
            });
        }

        fits.push(readToolbarFit(frame, width));
    }

    return fits;
}

function readToolbarFit(frame: HTMLElement, width: number): ToolbarFit {
    const lead = frame.querySelector('[tid="list-toolbar-lead"]');
    const controls = frame.querySelector('[tid="list-toolbar-controls"]');
    if (!lead || !controls) {
        throw new Error('No list toolbar in the frame');
    }

    const tabs = lead.querySelector('[tid="list-toolbar-tabs"]');
    const display = controls.querySelector('[aria-haspopup="dialog"]');
    const compact = tabs?.querySelector('[aria-haspopup="menu"]') != null;
    const iconOnly = display != null && display.textContent.trim() === '';
    const leadBox = lead.getBoundingClientRect();
    const overlaps: string[] = [];
    const options: string[] = [];
    for (const control of controls.children) {
        if (!(control instanceof HTMLElement)) {
            continue;
        }

        if (control.dataset.key) {
            options.push(control.dataset.key);
        }

        const box = control.getBoundingClientRect();
        const crosses =
            box.width > 0 &&
            box.left < leadBox.right - 0.5 &&
            box.right > leadBox.left + 0.5 &&
            box.top < leadBox.bottom &&
            box.bottom > leadBox.top;
        if (crosses) {
            overlaps.push(control.dataset.key ?? control.textContent.trim());
        }
    }

    return { width, step: compact ? 2 : iconOnly ? 1 : 0, options, overlaps };
}
