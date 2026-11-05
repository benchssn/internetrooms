import { Link } from "react-router";
import {
  FALLBACK_TEMPLATE_ID,
  getTemplate,
  TEMPLATE_REGISTRY,
} from "../../templates/templateRegistry";
import { EditorSection } from "../EditorField";
import type { SectionProps } from "../editorUtils";
import styles from "../RoomEditor.module.css";

export function TemplateSection({ room }: SectionProps) {
  const template =
    getTemplate(room.template) ?? TEMPLATE_REGISTRY[FALLBACK_TEMPLATE_ID];

  return (
    <EditorSection title="Template" icon="◫">
      <p className={styles.templateCurrent}>
        <span className={styles.templateLabel}>Current template:</span>{" "}
        <strong>{template.name}</strong>
        <span className={styles.hint}> — {template.tagline}</span>
      </p>
      <Link to="/templates" className={styles.linkButton}>
        <span aria-hidden="true">◫ </span>Change template
      </Link>
    </EditorSection>
  );
}
