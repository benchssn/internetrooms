import { LIMITS } from "../../validation/roomValidation";
import { EditorSection, TextAreaField, TextField } from "../EditorField";
import type { SectionProps } from "../editorUtils";

export function AboutSection({ room, update, errorFor }: SectionProps) {
  return (
    <EditorSection
      title="About me"
      icon="☺"
      description="Who lives here? Line breaks in your biography are kept."
    >
      <TextField
        label="Display name"
        required
        value={room.owner.displayName}
        maxLength={LIMITS.displayName}
        error={errorFor("owner.displayName")}
        onChange={(displayName) =>
          update((r) => ({ ...r, owner: { ...r.owner, displayName } }))
        }
      />
      <TextAreaField
        label="Biography"
        rows={5}
        value={room.owner.bio}
        maxLength={LIMITS.bio}
        error={errorFor("owner.bio")}
        onChange={(bio) => update((r) => ({ ...r, owner: { ...r.owner, bio } }))}
      />
    </EditorSection>
  );
}
