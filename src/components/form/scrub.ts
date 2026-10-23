/**
 * While a number is being dragged (see `NumberInput`), every change it makes shares this key, so the whole drag is ONE undo step however many values it passed through. Set when the drag
 * starts and cleared when it ends; an editor with undo (the Map Editor's `DraftEditor.edit`) uses it for a change that names no key of its own.
 */
let active: string | undefined;
export const scrubKey = (): string | undefined => active;
export const setScrubKey = (key: string | undefined): void => {
  active = key;
};
