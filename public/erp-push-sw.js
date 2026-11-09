/* ERP push handler injected into the existing Workbox-generated service worker.
   Keep this independent of React so notifications work when the PWA is closed. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof payload.title === "string" ? payload.title : "Стритстрим ERP";
  const body = typeof payload.body === "string" ? payload.body : "Новое уведомление ERP";
  const url = typeof payload.url === "string" && payload.url.startsWith("/")
    ? payload.url : "/?erp_screen=employee-home";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: typeof payload.tag === "string" ? payload.tag : "erp-push",
      renotify: true,
      data: { url },
      actions: [{ action: "open", title: "Открыть ERP" }],
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const raw = event.notification.data?.url || "/?erp_screen=employee-home";
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== url.origin) continue;
      await client.navigate(url.href);
      return client.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
