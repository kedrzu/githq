/**
 * An issue form's label as one line (`### What happened`, `- [ ] No patient data`): a label written over several
 * lines in the YAML would break the heading or the task. The body is written and checked by it alike.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toFormLine(label: string): string {
    return label.replace(/\s+/gu, ' ').trim();
}
