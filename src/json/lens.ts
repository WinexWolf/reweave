import { type Json, type Op, diff } from "../ops";
import { type Lens } from "../lens";

/**
 * A partial-projection lens for structured config objects.
 *
 * You declare which top-level keys the editor is allowed to touch. `get` projects
 * exactly those into the view; `put` folds the edited view back over the original
 * document, leaving every *other* key — comments-as-fields, vendor extensions,
 * keys added by a newer schema version — exactly as it found them. This is the
 * "edit a subset, preserve the rest" pattern that keeps a form-based editor from
 * clobbering data it doesn't understand.
 */
export function configLens(
  editableKeys: string[],
): Lens<{ [k: string]: Json }, { [k: string]: Json }> {
  const keys = new Set(editableKeys);
  return {
    get(model) {
      const view: { [k: string]: Json } = {};
      for (const key of editableKeys) {
        if (Object.prototype.hasOwnProperty.call(model, key)) {
          view[key] = model[key];
        }
      }
      return view;
    },

    put(model, view) {
      const next: { [k: string]: Json } = { ...model };
      // Apply the view over editable keys only.
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(view, key)) next[key] = view[key];
        else delete next[key]; // key was removed in the editor
      }
      // Never let the editor introduce keys it wasn't given authority over.
      for (const key of Object.keys(view)) {
        if (!keys.has(key)) {
          throw new Error(`configLens: key "${key}" is not editable`);
        }
      }
      const ops: Op[] = diff(model, next);
      return { model: next, ops };
    },
  };
}
