import { fieldPath, LIMITS } from "../../validation/roomValidation";
import { TextField } from "../EditorField";
import { patchWidgetContent, type WidgetEditorProps } from "../editorUtils";
import { ImageSourceField } from "../ImageSourceField";

export function ImageEditor({ widget, update, errorFor, announce }: WidgetEditorProps<"image">) {
  const id = widget.id;
  return (
    <>
      <ImageSourceField
        idBase={`ed-${id}-image`}
        label="Image"
        value={widget.content.image}
        error={errorFor(fieldPath.widget(id, "image"))}
        announce={announce}
        onChange={(image, options) =>
          update((r) => patchWidgetContent(r, id, "image", () => ({ image })), options)
        }
      />
      <TextField
        id={`ed-${id}-alt`}
        label="Alternative text"
        hint="Describe the image for people who can't see it."
        required
        value={widget.content.alt}
        maxLength={LIMITS.artworkAlt}
        error={errorFor(fieldPath.widget(id, "alt"))}
        onChange={(alt) =>
          update((r) => patchWidgetContent(r, id, "image", () => ({ alt })), {
            coalesceKey: fieldPath.widget(id, "alt"),
          })
        }
      />
      <TextField
        id={`ed-${id}-caption`}
        label="Caption"
        hint="Optional."
        value={widget.content.caption}
        maxLength={LIMITS.imageCaption}
        error={errorFor(fieldPath.widget(id, "caption"))}
        onChange={(caption) =>
          update((r) => patchWidgetContent(r, id, "image", () => ({ caption })), {
            coalesceKey: fieldPath.widget(id, "caption"),
          })
        }
      />
    </>
  );
}
