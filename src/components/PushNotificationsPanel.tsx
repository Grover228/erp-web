import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Config = { publicKey: string };
type Result = { subscribed?: boolean; sent?: boolean; accepted?: number; message?: string; error?: string };

async function invokePush<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("erp-push", { body });
  if (error) {
    let detail = error.message || "Ошибка подключения";
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") {
      try {
        const payload = await response.json() as { error?: string; message?: string };
        detail = payload.error || payload.message || detail;
      } catch { /* keep original detail */ }
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export default function PushNotificationsPanel() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) ||
      !("Notification" in window)) {
      setSupported(false);
      return;
    }
    let live = true;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => { if (live) setEnabled(!!sub && Notification.permission === "granted"); })
      .catch(() => { if (live) setSupported(false); });
    return () => { live = false; };
  }, []);

  async function sendTest() {
    const result = await invokePush<Result>({ action: "test" });
    setMessage(result.message || (
      result.sent ? "Тест отправлен. Проверь уведомления Android." : "Тест не отправлен."
    ));
  }

  async function enableAndTest() {
    if (!supported) return;
    setBusy(true);
    setMessage("");
    try {
      // Permission request must happen directly inside the user's click.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Разреши уведомления для ERP в настройках Android и браузера.");
      }
      const config = await invokePush<Config>({ action: "config" });
      if (!config.publicKey) throw new Error("Публичный ключ уведомлений не получен");
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: fromBase64Url(config.publicKey),
        });
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh) {
        throw new Error("Android не вернул ключи подписки. Попробуй переподключить уведомления.");
      }
      await invokePush<Result>({
        action: "subscribe",
        subscription: {
          endpoint: json.endpoint,
          keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
        },
      });
      setEnabled(true);
      await sendTest();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось подключить уведомления");
    } finally {
      setBusy(false);
    }
  }

  async function testAgain() {
    setBusy(true);
    setMessage("");
    try { await sendTest(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка теста"); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await invokePush<Result>({ action: "unsubscribe", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Уведомления отключены на этом устройстве.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отключить уведомления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{
      background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 14,
      padding: "12px 14px", display: "grid", gap: 9, width: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ fontSize: 16, color: "#075985", fontWeight: 900 }}>
        Уведомления ERP
      </div>
      <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
        {supported
          ? enabled
            ? "Push включены. При незакрытой смене напомним в 19:30 по московскому времени."
            : "Подключи уведомления на телефоне. Сразу отправим тестовое push-сообщение."
          : "Этот браузер не поддерживает Web Push. Открой установленную ERP через Chrome на Android."}
      </div>
      {supported && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" disabled={busy} onClick={enableAndTest}
            style={{ background: "#0284c7", color: "#fff", border: 0, borderRadius: 10,
              padding: "10px 13px", fontWeight: 800, cursor: "pointer" }}>
            {busy ? "Проверяем…" : enabled ? "Переподключить и проверить" : "Включить и отправить тест"}
          </button>
          {enabled && <button type="button" disabled={busy} onClick={testAgain}
            style={{ background: "#fff", color: "#075985", border: "1px solid #7dd3fc",
              borderRadius: 10, padding: "10px 13px", fontWeight: 800, cursor: "pointer" }}>
            Отправить тест
          </button>}
          {enabled && <button type="button" disabled={busy} onClick={disable}
            style={{ background: "transparent", color: "#475569", border: "1px solid #cbd5e1",
              borderRadius: 10, padding: "10px 13px", fontWeight: 700, cursor: "pointer" }}>
            Отключить
          </button>}
        </div>
      )}
      {!!message && <div role="status" style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.45 }}>{message}</div>}
    </section>
  );
}
