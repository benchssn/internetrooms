import { LIMITS } from "../../validation/roomValidation";
import { EditorSection, TextAreaField, TextField } from "../EditorField";
import type { SectionProps } from "../editorUtils";

export function IdentitySection({ room, update, errorFor }: SectionProps) {
  return (
    <EditorSection
      title="Room identity"
      icon="⌂"
      description="The name and welcome message at the top of your room."
    >
      <TextField
        label="Room title"
        required
        value={room.title}
        maxLength={LIMITS.title}
        error={errorFor("title")}
        onChange={(title) => update((r) => ({ ...r, title }))}
      />
      <TextAreaField
        label="Tagline"
        rows={2}
        value={room.tagline}
        maxLength={LIMITS.tagline}
        error={errorFor("tagline")}
        onChange={(tagline) => update((r) => ({ ...r, tagline }))}
      />
    </EditorSection>
  );
}
