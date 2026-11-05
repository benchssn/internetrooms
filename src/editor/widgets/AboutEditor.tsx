import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextAreaField, TextField } from "../EditorField";
import { patchWidgetContent, type WidgetEditorProps } from "../editorUtils";

export function AboutEditor({ widget, update, errorFor }: WidgetEditorProps<"about">) {
  const id = widget.id;
  return (
    <>
      <TextField
        id={`ed-${id}-displayName`}
        label="Display name"
        required
        value={widget.content.displayName}
        maxLength={LIMITS.displayName}
        error={errorFor(fieldPath.widget(id, "displayName"))}
        onChange={(displayName) =>
          update((r) => patchWidgetContent(r, id, "about", () => ({ displayName })), {
            coalesceKey: fieldPath.widget(id, "displayName"),
          })
        }
      />
      <TextAreaField
        id={`ed-${id}-bio`}
        label="Biography"
        hint="Line breaks are kept."
        rows={5}
        value={widget.content.bio}
        maxLength={LIMITS.bio}
        error={errorFor(fieldPath.widget(id, "bio"))}
        onChange={(bio) =>
          update((r) => patchWidgetContent(r, id, "about", () => ({ bio })), {
            coalesceKey: fieldPath.widget(id, "bio"),
          })
        }
      />
    </>
  );
}
