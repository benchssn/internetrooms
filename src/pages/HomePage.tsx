import { Link } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { TemplatePreview } from "../components/TemplatePreview/TemplatePreview";
import { Window } from "../components/Window/Window";
import { getDefaultRoom } from "../data/defaultRoom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { applyTemplate } from "../templates/applyTemplate";
import { TEMPLATES } from "../templates/templateRegistry";
import styles from "./pages.module.css";
import { PixelRoom } from "./PixelRoom";

const sampleRoom = getDefaultRoom();

const PHILOSOPHY = [
  {
    icon: "☁",
    title: "get lost, not stuck",
    text: "Wander, tinker, change your mind. Every room can be rearranged, recoloured and started again — nothing here is permanent or precious.",
  },
  {
    icon: "✎",
    title: "made by you",
    text: "Your words, your art, your music, your links. No algorithm decides what goes on your walls.",
  },
  {
    icon: "☾",
    title: "slow & personal",
    text: "No likes, no feeds, no follower counts, no tracking. Just a small place on the internet that feels like yours.",
  },
];

export function HomePage() {
  useDocumentTitle();

  return (
    <SiteLayout>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroText}>
          <p className={styles.kicker} aria-hidden="true">
            ★ welcome, traveller ★
          </p>
          <h1 id="home-title" className={styles.heroTitle}>
            internetrooms
          </h1>
          <p className={styles.heroTagline}>a place to get lost, not stuck.</p>
          <p className={styles.heroBody}>
            Create your own corner of the internet. Express yourself through
            art, music, writing and design.
          </p>
          <div className={styles.heroActions}>
            <Link to="/templates" className={styles.primaryAction}>
              Create your room
            </Link>
            <Link to="/edit" className={styles.secondaryAction}>
              Edit your room
            </Link>
          </div>
        </div>
        <div className={styles.heroArt}>
          <PixelRoom className={styles.pixelRoom} />
        </div>
      </section>

      <Window title="what is internetrooms?">
        <div className={styles.intro}>
          <p>
            Remember when every website felt like someone's bedroom? Internetrooms
            brings that feeling back. Pick a template, fill it with the things you
            love, and make it look exactly how you want — no code required.
          </p>
          <p>
            Your room has an about-me corner, an art gallery, a spot for the music
            you're into and a shelf of favourite links. Show what you like, hide
            what you don't, and change it whenever the mood strikes.
          </p>
        </div>
      </Window>

      <section aria-labelledby="home-templates" className={styles.block}>
        <h2 id="home-templates" className={styles.blockTitle}>
          <span aria-hidden="true">◫ </span>three rooms to start from
        </h2>
        <ul className={styles.cardGrid}>
          {TEMPLATES.map((template) => (
            <li key={template.id} className={styles.card}>
              <TemplatePreview room={applyTemplate(sampleRoom, template.id)} />
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{template.name}</h3>
                <p className={styles.cardTagline}>{template.tagline}</p>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/templates" className={styles.secondaryAction}>
          Browse all templates
        </Link>
      </section>

      <Window title="philosophy.txt">
        <ul className={styles.philosophy}>
          {PHILOSOPHY.map((item) => (
            <li key={item.title}>
              <h3 className={styles.philosophyTitle}>
                <span aria-hidden="true" className={styles.philosophyIcon}>
                  {item.icon}
                </span>
                {item.title}
              </h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </Window>
    </SiteLayout>
  );
}
