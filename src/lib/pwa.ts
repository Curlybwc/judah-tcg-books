// In-app updates (Jen, 2026-11-07). The PWA is built with registerType
// "autoUpdate": a new version's service worker activates silently in the
// background and normally takes over on the next app reopen. This module adds
// the deliberate path Jen asked for — an Update button that checks NOW, waits
// for the new worker to take control, then reloads into the new version.

export type UpdateCheckResult = "reloading" | "current" | "unavailable";

let backgroundStarted = false;

export function startBackgroundUpdateChecks(): void {
  if (backgroundStarted || !("serviceWorker" in navigator)) return;
  backgroundStarted = true;
  const poke = () => {
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => { /* offline etc. */ });
  };
  // Stage updates quietly while the app sits open, and whenever it comes back
  // to the foreground. Staging never reloads on its own — the books stay put
  // until Judah reopens the app or taps the update button.
  window.setInterval(poke, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poke(); });
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!("serviceWorker" in navigator)) return "unavailable";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unavailable";
  // Only reload on controllerchange when a previous worker already controlled
  // the page — that's a real update, not the first-ever install claiming it.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  const onController = () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    try { sessionStorage.setItem("jtb-just-updated", "1"); } catch { /* ignore */ }
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", onController);
  try {
    await reg.update();
    // Give an installing worker a few seconds to activate (autoUpdate
    // skip-waits, so this is quick when there really is a new version).
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (reloaded) return "reloading";
      if (!reg.installing && !reg.waiting) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    return reloaded ? "reloading" : "current";
  } catch {
    return "unavailable";
  } finally {
    navigator.serviceWorker.removeEventListener("controllerchange", onController);
  }
}

// True once, right after the update button reloaded the app into a new version.
export function consumeJustUpdated(): boolean {
  try {
    const v = sessionStorage.getItem("jtb-just-updated");
    if (v) sessionStorage.removeItem("jtb-just-updated");
    return !!v;
  } catch {
    return false;
  }
}
