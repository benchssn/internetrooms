import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { SiteLayout } from "../components/SiteLayout/SiteLayout";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { readSupabaseConfig } from "../supabase/config";
import { checkSupabaseConnection, type ConnectionCheckResult } from "../supabase/connectionCheck";
import styles from "./pages.module.css";

/*
 * TEMPORARY diagnostic page (Milestone 5 setup).
 * Lets the owner confirm on the live site that Supabase is configured and
 * reachable. Remove this file, its route in App.tsx and its test once
 * connectivity is confirmed.
 *
 * It never displays the publishable key or any other credential — only the
 * project URL and the check's own explanatory messages.
 */

type Status =
  | { kind: "checking" }
  | { kind: "config-error"; problems: string[] }
  | { kind: "connected"; result: Extract<ConnectionCheckResult, { ok: true }>; checkedAt: Date }
  | { kind: "failed"; result: Extract<ConnectionCheckResult, { ok: false }>; checkedAt: Date };

const LABELS: Record<Status["kind"], string> = {
  checking: "Checking",
  "config-error": "Configuration Error",
  connected: "Connected",
  failed: "Connection Failed",
};

const MARKS: Record<Status["kind"], string> = {
  checking: "…",
  "config-error": "!",
  connected: "✓",
  failed: "✕",
};

const FAILURE_HELP: Record<Extract<ConnectionCheckResult, { ok: false }>["reason"], string> = {
  "not-configured": "The Supabase environment variables are missing or invalid.",
  "key-rejected":
    "The project answered, but didn't accept the publishable key. Check that VITE_SUPABASE_PUBLISHABLE_KEY in Render belongs to this project, then redeploy.",
  "unexpected-response":
    "The project answered with an unexpected status. Check that the project isn't paused in the Supabase dashboard.",
  unreachable:
    "The browser couldn't reach the project. Check VITE_SUPABASE_URL in Render, and that the project isn't paused.",
  timeout: "The project didn't answer within 8 seconds. Try again; if it keeps happening, check the project's status in Supabase.",
};

export function SupabaseTestPage() {
  useDocumentTitle("Supabase connection test");
  const config = readSupabaseConfig();
  const projectUrl = config.ok ? config.config.url : null;
  const [status, setStatus] = useState<Status>(() =>
    config.ok ? { kind: "checking" } : { kind: "config-error", problems: config.problems },
  );

  /** Runs the check and records the outcome (state updates happen after awaiting). */
  const finishCheck = useCallback(async () => {
    const current = readSupabaseConfig();
    if (!current.ok) {
      setStatus({ kind: "config-error", problems: current.problems });
      return;
    }
    const result = await checkSupabaseConnection({ config: current.config });
    setStatus(
      result.ok
        ? { kind: "connected", result, checkedAt: new Date() }
        : { kind: "failed", result, checkedAt: new Date() },
    );
  }, []);

  const checkAgain = () => {
    setStatus({ kind: "checking" });
    void finishCheck();
  };

  useEffect(() => {
    // Keep this temporary page out of search engines.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  // First check on arrival. Initial state is already "checking" (or a
  // configuration error), so nothing needs setting before the request.
  const configured = config.ok;
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const current = readSupabaseConfig();
    if (!current.ok) return;
    void checkSupabaseConnection({ config: current.config }).then((result) => {
      if (cancelled) return;
      setStatus(
        result.ok
          ? { kind: "connected", result, checkedAt: new Date() }
          : { kind: "failed", result, checkedAt: new Date() },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  return (
    <SiteLayout>
      <section className={styles.pageIntro} aria-labelledby="supabase-test-title">
        <p className={styles.notFoundCode}>Temporary diagnostic</p>
        <h1 id="supabase-test-title" className={styles.pageTitle}>
          supabase connection test
        </h1>
        <p className={styles.pageLead}>
          Checks that this site can reach its Supabase project. It needs no database
          tables and no sign-in, and changes nothing.
        </p>
      </section>

      <hr className={styles.rule} />

      <section aria-labelledby="supabase-test-result" className={styles.diagnostic}>
        <h2 id="supabase-test-result" className={styles.sectionLabel}>
          Result
        </h2>
        <div className={styles.diagnosticBody}>
          <p
            className={styles.diagnosticStatus}
            data-status={status.kind}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" className={styles.diagnosticMark}>
              {MARKS[status.kind]}
            </span>
            {LABELS[status.kind]}
          </p>

          <dl className={styles.diagnosticList}>
            <dt>Project URL</dt>
            <dd>
              {projectUrl ? <code className={styles.path}>{projectUrl}</code> : "Not set or invalid"}
            </dd>

            {status.kind === "connected" ? (
              <>
                <dt>Response</dt>
                <dd>
                  HTTP {status.result.status} in {status.result.latencyMs} ms
                  {status.result.service ? ` · ${status.result.service}` : ""}
                </dd>
                <dt>Checked</dt>
                <dd>{status.checkedAt.toLocaleTimeString()}</dd>
              </>
            ) : null}

            {status.kind === "failed" ? (
              <>
                <dt>What happened</dt>
                <dd>{status.result.message}</dd>
                <dt>What to check</dt>
                <dd>{FAILURE_HELP[status.result.reason]}</dd>
                <dt>Checked</dt>
                <dd>{status.checkedAt.toLocaleTimeString()}</dd>
              </>
            ) : null}

            {status.kind === "config-error" ? (
              <>
                <dt>What's wrong</dt>
                <dd>
                  <ul className={styles.diagnosticProblems}>
                    {status.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </dd>
                <dt>How to fix it</dt>
                <dd>
                  In Render, open the service's <strong>Environment</strong> settings, set{" "}
                  <code className={styles.path}>VITE_SUPABASE_URL</code> and{" "}
                  <code className={styles.path}>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then
                  redeploy. These are read when the site is built, so a redeploy is needed
                  after any change.
                </dd>
              </>
            ) : null}
          </dl>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={checkAgain}
              disabled={status.kind === "checking"}
            >
              Check again
            </button>
            <Link to="/" className={styles.secondaryAction}>
              Back to the homepage
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
