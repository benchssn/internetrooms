import { createContext, useContext } from "react";
import type { CloudApi, Profile } from "./cloudTypes";

export type ProfileStatus =
  /** Not signed in, or accounts unavailable. */
  | "none"
  | "loading"
  | "ready"
  /** Signed in but no username chosen yet: guide them to /settings. */
  | "missing"
  | "error";

export interface ProfileContextValue {
  status: ProfileStatus;
  profile: Profile | null;
  /** Null until loaded, or when Supabase isn't configured. */
  cloud: CloudApi | null;
  setProfile: (profile: Profile) => void;
  reload: () => void;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside <ProfileProvider>");
  return value;
}
