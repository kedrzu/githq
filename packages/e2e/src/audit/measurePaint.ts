/** One thing painted on the page, with the colors it ends up in on the screen. */
export interface PaintSample {
    kind: 'text' | 'placeholder' | 'icon' | 'outline' | 'focus-ring';
    /** The final color after alpha and opacity, as `#rrggbb`. */
    fg: string;
    bg: string;
    ratio: number;
    fontSize: number;
    fontWeight: number;
    /** A disabled control: WCAG exempts it. */
    disabled: boolean;
    /** Over an image or gradient: `bg` is only what's beneath it. */
    overImage: boolean;
    className: string;
    sample: string;
}

/**
 * Runs in the page: what the subtree of `root` (the whole document without one) paints. Self-contained, because it is
 * passed to `page.evaluate`.
 */
export function measurePaint(this: unknown, rootOrFlag: unknown, flag?: boolean): PaintSample[] {
    const root = rootOrFlag instanceof Element ? rootOrFlag : document.body;
    const onlyInside = rootOrFlag instanceof Element || flag === true;
    const samples: PaintSample[] = [];

    type Rgba = [number, number, number, number];

    function parse(color: string): Rgba | null {
        const match = /rgba?\(([^)]+)\)/.exec(color);
        if (match) {
            const parts = match[1]!
                .split(/[\s,/]+/)
                .filter(Boolean)
                .map(Number);
            return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
        }
        const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(color);
        if (srgb) {
            return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, Number(srgb[4] ?? 1)];
        }
        return null;
    }

    function over(top: Rgba, bottom: Rgba): Rgba {
        const alpha = top[3];
        return [
            top[0] * alpha + bottom[0] * (1 - alpha),
            top[1] * alpha + bottom[1] * (1 - alpha),
            top[2] * alpha + bottom[2] * (1 - alpha),
            1,
        ];
    }

    function hex(color: Rgba) {
        return `#${[color[0], color[1], color[2]]
            .map(part => Math.round(part).toString(16).padStart(2, '0'))
            .join('')}`;
    }

    function luminance(color: Rgba) {
        const [r, g, b] = [color[0], color[1], color[2]].map(part => {
            const c = part / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrast(a: Rgba, b: Rgba) {
        const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number];
        return (hi + 0.05) / (lo + 0.05);
    }

    /** What `element` paints on: its own background and everything behind it, by the DOM's ancestors. */
    function backdrop(element: Element | null, skipOwn = false) {
        const layers: Rgba[] = [];
        let overImage = false;
        let current: Element | null = element;
        let first = true;
        while (current) {
            const style = getComputedStyle(current);
            if (!(skipOwn && first)) {
                if (style.backgroundImage !== 'none') {
                    overImage = true;
                }
                const layer = parse(style.backgroundColor);
                if (layer && layer[3] > 0) {
                    layers.push([layer[0], layer[1], layer[2], layer[3] * Number(style.opacity)]);
                    if (layer[3] === 1 && Number(style.opacity) === 1) {
                        break;
                    }
                }
            }
            first = false;
            current = current.parentElement;
        }
        let color: Rgba = [255, 255, 255, 1];
        for (const layer of layers.toReversed()) {
            color = over(layer, color);
        }
        return { color, overImage };
    }

    function opacityOf(element: Element | null) {
        let opacity = 1;
        for (let current = element; current; current = current.parentElement) {
            opacity *= Number(getComputedStyle(current).opacity);
        }
        return opacity;
    }

    function isVisible(element: Element) {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
            style.visibility === 'visible' &&
            style.display !== 'none' &&
            box.width > 0 &&
            box.height > 0 &&
            opacityOf(element) > 0
        );
    }

    function isDisabled(element: Element) {
        return !!element.closest(':disabled, [aria-disabled="true"], [data-disabled]');
    }

    function classOf(element: Element) {
        return (element.getAttribute('class') ?? element.tagName.toLowerCase()).slice(0, 120);
    }

    function push(
        kind: PaintSample['kind'],
        element: Element,
        foreground: string,
        sample: string,
        backgroundOf: Element = element,
        skipOwnBackground = false,
    ) {
        const parsed = parse(foreground);
        if (!parsed || parsed[3] === 0) {
            return;
        }
        const { color: bg, overImage } = backdrop(backgroundOf, skipOwnBackground);
        const fg = over([parsed[0], parsed[1], parsed[2], parsed[3] * opacityOf(element)], bg);
        const style = getComputedStyle(element);
        samples.push({
            kind,
            fg: hex(fg),
            bg: hex(bg),
            ratio: Math.round(contrast(fg, bg) * 100) / 100,
            fontSize: Number.parseFloat(style.fontSize),
            fontWeight: Number(style.fontWeight),
            disabled: isDisabled(element),
            overImage,
            className: classOf(element),
            sample: sample.trim().slice(0, 40),
        });
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !node.textContent?.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
            continue;
        }
        if (isVisible(parent) && getComputedStyle(parent).clipPath !== 'inset(50%)') {
            push('text', parent, getComputedStyle(parent).color, node.textContent);
        }
    }

    const elements = [...(onlyInside ? [root] : []), ...root.querySelectorAll('*')];
    for (const element of elements) {
        if (!isVisible(element)) {
            continue;
        }
        const style = getComputedStyle(element);

        if (element.matches('input, textarea')) {
            const placeholder = element.getAttribute('placeholder');
            if (placeholder) {
                push('placeholder', element, getComputedStyle(element, '::placeholder').color, placeholder);
            }
        }

        if (element.tagName === 'svg' || element.matches('svg')) {
            const inner = element.querySelector('path, circle, rect, line, polyline, polygon') ?? element;
            const innerStyle = getComputedStyle(inner);
            const paint = innerStyle.stroke !== 'none' ? innerStyle.stroke : innerStyle.fill;
            if (paint !== 'none' && !paint.startsWith('url')) {
                push('icon', element, paint, element.getAttribute('aria-label') ?? '');
            }
        }

        // The outline a control is recognized by (WCAG 1.4.11): an input, a checkbox and the like.
        if (
            element.matches(
                'input:not([type=hidden]), select, textarea, [role=checkbox], [role=switch], [role=radio]',
            ) &&
            style.borderTopWidth !== '0px' &&
            style.borderTopStyle !== 'none'
        ) {
            push('outline', element, style.borderTopColor, '', element.parentElement ?? element);
        }

        if (element === document.activeElement && style.outlineStyle !== 'none' && style.outlineWidth !== '0px') {
            push('focus-ring', element, style.outlineColor, '', element.parentElement ?? element);
        }
    }

    return samples;
}
