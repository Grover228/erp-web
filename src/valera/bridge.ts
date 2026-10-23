import type { ValeraProfile } from "./skills";

export type ValeraLaunchContext = {
  requested: boolean;
  source: "android" | "pwa";
  profile: ValeraProfile | null;
};

export function readValeraLaunchContext(): ValeraLaunchContext {
  if (typeof window === "undefined") {
    return { requested: false, source: "pwa", profile: null };
  }

  const params = new URLSearchParams(window.location.search);
  const requested =
    params.get("valera") === "1" ||
    params.get("assistant") === "valera" ||
    window.location.hash === "#valera";

  const source = params.get("source") === "android" ? "android" : "pwa";
  const profileParam = params.get("profile");
  const profile: ValeraProfile | null =
    profileParam === "work" || profileParam === "home"
      ? profileParam
      : null;

  return { requested, source, profile };
}

export function shouldOpenValera(): boolean {
  return readValeraLaunchContext().requested;
}

export function updateValeraProfileInUrl(profile: ValeraProfile) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.set("valera", "1");
  url.searchParams.set("profile", profile);
  window.history.replaceState(null, "", url.toString());
}
