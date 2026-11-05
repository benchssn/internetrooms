import { formatConfigProblems, readSupabaseConfig } from "./config";
import { checkSupabaseConnection } from "./connectionCheck";

/**
 * Development-only startup check. Logs whether Supabase is configured and
 * reachable. Imported from main.tsx behind `import.meta.env.DEV`, so it is
 * removed from production builds entirely.
 */
export async function runDevConnectionCheck(): Promise<void> {
  const config = readSupabaseConfig();
  if (!config.ok) {
    console.error(`[internetrooms] ${formatConfigProblems(config.problems)}`);
    return;
  }

  const result = await checkSupabaseConnection({ config: config.config });
  if (result.ok) {
    console.info(
      `[internetrooms] Supabase reachable: ${config.config.url} (HTTP ${result.status}, ${result.latencyMs} ms${
        result.service ? `, ${result.service}` : ""
      }).`,
    );
  } else {
    console.error(`[internetrooms] Supabase connection check failed (${result.reason}): ${result.message}`);
  }
}
