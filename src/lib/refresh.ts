// Hard refresh for testers. A normal `location.reload()` on iOS standalone
// PWAs often serves the cached service-worker bundle — testers had no way to
// pick up a fresh deploy without removing and re-adding the home-screen icon.
// This sequence unregisters every SW, clears every Cache Storage entry, and
// then reloads with a cache-busting query so the network fetch is forced.
export async function hardRefresh(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    console.warn("[VYou] service-worker unregister failed", err);
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn("[VYou] cache clear failed", err);
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString(36));
  window.location.replace(url.toString());
}
