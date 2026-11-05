import { Link } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { TemplatePreview } from "../components/TemplatePreview/TemplatePreview";
import { getDefaultRoom } from "../data/defaultRoom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { applyTemplate } from "../templates/applyTemplate";
import { TEMPLATES } from "../templates/templateRegistry";
import styles from "./pages.module.css";

const sampleRoom = getDefaultRoom();

const PRINCIPLES = [
  {
    title: "Get lost, not stuck.",
    text: "Wander, tinker, change your mind. Every room can be rearranged, restyled and started again.",
  },
  {
    title: "Made by you.",
    text: "Your words, your images, your music, your links. No algorithm decides what goes on your walls.",
  },
  {
    title: "Slow and personal.",
    text: "No likes, no feeds, no follower counts, no tracking. A small place on the internet that feels like yours.",
  },
];

export function HomePage() {
  useDocumentTitle();

  return (
    <SiteLayout>
      <section className={styles.hero} aria-labelledby="home-title">
        <h1 id="home-title" className={styles.heroTitle}>
          the internet belongs to you.
        </h1>
        <p className={styles.heroBody}>
          Build a room. Make it yours. Create something strange, beautiful,
          personal, or completely unexpected.
        </p>
        <div className={styles.actions}>
          <Link to="/templates" className={styles.primaryAction}>
            Create a room <span aria-hidden="true">→</span>
          </Link>
          <Link to="/edit" className={styles.secondaryAction}>
            Edit your room
          </Link>
        </div>
      </section>

      <hr className={styles.rule} />

      <section aria-labelledby="home-what" className={styles.split}>
        <h2 id="home-what" className={styles.sectionLabel}>
          What it is
        </h2>
        <div className={styles.prose}>
          <p>
            Internetrooms is a personal website builder for people who miss when
            the web felt handmade. Start from a template, then make it entirely
            your own: arrange widgets, write, add images and links, pick your
            fonts, colours and backgrounds, and scatter a few stars around.
          </p>
          <p>No code. No accounts. Everything stays in your browser.</p>
        </div>
      </section>

      <hr className={styles.rule} />

      <section aria-labelledby="home-templates" className={styles.split}>
        <h2 id="home-templates" className={styles.sectionLabel}>
          Starting points
        </h2>
        <div>
          <ul className={styles.templateRow}>
            {TEMPLATES.map((template) => (
              <li key={template.id} className={styles.templateItem}>
                <div className={styles.previewFrame}>
                  <TemplatePreview room={applyTemplate(sampleRoom, template.id)} />
                </div>
                <h3 className={styles.itemTitle}>{template.name}</h3>
                <p className={styles.itemText}>{template.tagline}</p>
              </li>
            ))}
          </ul>
          <Link to="/templates" className={styles.textLink}>
            Browse templates <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <hr className={styles.rule} />

      <section aria-labelledby="home-principles" className={styles.split}>
        <h2 id="home-principles" className={styles.sectionLabel}>
          Principles
        </h2>
        <ol className={styles.principles}>
          {PRINCIPLES.map((item) => (
            <li key={item.title}>
              <h3 className={styles.itemTitle}>{item.title}</h3>
              <p className={styles.itemText}>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </SiteLayout>
  );
}
