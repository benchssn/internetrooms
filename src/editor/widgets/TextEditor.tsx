import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextAreaField, TextField } from "../EditorField";
import { patchWidgetContent, type WidgetEditorProps } from "../editorUtils";

export function TextEditor({ widget, update, errorFor }: WidgetEditorProps<"text">) {
  const id = widget.id;
  return (
    <>
      <TextField
        id={`ed-${id}-title`}
        label="Heading"
        hint="Optional. Shown as “Notes” if left empty."
        value={widget.content.title}
        maxLength={LIMITS.widgetTitle}
        error={errorFor(fieldPath.widget(id, "title"))}
        onChange={(title) =>
          update((r) => patchWidgetContent(r, id, "text", () => ({ title })), {
            coalesceKey: fieldPath.widget(id, "title"),
          })
        }
      />
      <TextAreaField
        id={`ed-${id}-body`}
        label="Text"
        hint="Plain text. Leave a blank line between paragraphs."
        required
        rows={8}
        value={widget.content.body}
        maxLength={LIMITS.textBody}
        error={errorFor(fieldPath.widget(id, "body"))}
        onChange={(body) =>
          update((r) => patchWidgetContent(r, id, "text", () => ({ body })), {
            coalesceKey: fieldPath.widget(id, "body"),
          })
        }
      />
    </>
  );
}
