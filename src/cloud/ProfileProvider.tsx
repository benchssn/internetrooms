import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/authContext";
import { loadCloudApi } from "./cloudClient";
import type { CloudApi, Profile } from "./cloudTypes";
import { ProfileContext, type ProfileContextValue, type ProfileStatus } from "./profileContext";

interface Loaded {
  userId: string;
  status: Exclude<ProfileStatus, "none" | "loading">;
  profile: Profile | null;
}

/** Loads the signed-in user's public profile (if they have chosen a username). */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [cloud, setCloud] = useState<CloudApi | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [generation, setGeneration] = useState(0);
  const userId = authStatus === "signed-in" ? (user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    const lifetime = new AbortController();
    void loadCloudApi().then(async (api) => {
      if (lifetime.signal.aborted) return;
      setCloud(api);
      if (!api) {
        setLoaded({ userId, status: "error", profile: null });
        return;
      }
      const result = await api.getProfileById(userId);
      if (lifetime.signal.aborted) return;
      setLoaded(
        !result.ok
          ? { userId, status: "error", profile: null }
          : { userId, status: result.data ? "ready" : "missing", profile: result.data },
      );
    });
    return () => lifetime.abort();
  }, [userId, generation]);

  const setProfile = useCallback(
    (profile: Profile) => setLoaded({ userId: profile.id, status: "ready", profile }),
    [],
  );
  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  const value = useMemo<ProfileContextValue>(() => {
    const current = userId && loaded?.userId === userId ? loaded : null;
    return {
      status: !userId ? "none" : current ? current.status : "loading",
      profile: current?.profile ?? null,
      cloud,
      setProfile,
      reload,
    };
  }, [userId, loaded, cloud, setProfile, reload]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
