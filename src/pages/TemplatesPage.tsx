import { useNavigate } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { TemplatePreview } from "../components/TemplatePreview/TemplatePreview";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useRoomDraftContext } from "../hooks/roomDraftContext";
import { applyTemplate } from "../templates/applyTemplate";
import { TEMPLATES, type TemplateDefinition } from "../templates/templateRegistry";
import styles from "./pages.module.css";

export interface EditNavigationState {
  message?: string;
}

export function TemplatesPage() {
  useDocumentTitle("Templates");
  const navigate = useNavigate();
  const { draftRoom, isDirty, selectTemplate } = useRoomDraftContext();

  const choose = (template: TemplateDefinition) => {
    if (template.id === draftRoom.template) {
      // Keep the user's current colours when they stay on the same template.
      navigate("/edit");
      return;
    }
    selectTemplate(template.id);
    const state: EditNavigationState = {
      message: `Switched to ${template.name}. Your content came with you — press Save to keep this look.`,
    };
    navigate("/edit", { state });
  };

  return (
    <SiteLayout>
      <header className={styles.pageIntro}>
        <h1 className={styles.pageTitle}>choose your room template</h1>
        <p className={styles.pageLead}>
          Each template is a different mood for the same room. Previews show your
          current room content.
        </p>
      </header>

      <div className={styles.callout} role="note">
        <p>
          <strong>
            Choosing a new template changes your colours and background.
          </strong>{" "}
          Your writing, images, music, links, widget order and sizes, fonts and
          decorations all stay exactly as they are. Nothing is saved until you press{" "}
          <strong>Save</strong> in the editor.
        </p>
        {isDirty ? (
          <p>
            You have unsaved changes — they'll come with you.
          </p>
        ) : null}
      </div>

      <ul className={styles.templateList}>
        {TEMPLATES.map((template) => {
          const current = template.id === draftRoom.template;
          const headingId = `template-${template.id}`;
          return (
            <li key={template.id} className={styles.templateCard}>
              <article aria-labelledby={headingId}>
                <div className={styles.previewFrame}>
                  <TemplatePreview room={applyTemplate(draftRoom, template.id)} />
                </div>
                <div className={styles.templateBody}>
                  <div className={styles.templateHeading}>
                    <h2 id={headingId} className={styles.cardTitle}>
                      {template.name}
                    </h2>
                    {current ? (
                      <span className={styles.badge}>
                        Current template
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.cardTagline}>{template.tagline}</p>
                  <p className={styles.templateDescription}>
                    {template.description}
                  </p>
                  <button
                    type="button"
                    className={current ? styles.secondaryAction : styles.primaryAction}
                    onClick={() => choose(template)}
                  >
                    {current
                      ? `Keep ${template.name}`
                      : `Use ${template.name}`}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </SiteLayout>
  );
}
