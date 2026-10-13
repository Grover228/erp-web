import { useMemo, useState } from "react";
import { supabase } from "../supabase";

type Challenge = {
  uuid: string;
  data: string;
  apiVersion: "v3" | "v4";
};

type AuthResult = {
  token: string;
  expiresAt: string;
};

const OMS_STORAGE_KEY = "erp:chz:oms-id";
const CONNECTION_STORAGE_KEY = "erp:chz:oms-connection";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "11px 12px",
  fontSize: 14,
  background: "#fff",
};

function masked(value: string) {
  if (!value) return "—";
  if (value.length <= 10) return "••••••";
  return `${value.slice(0, 5)}••••••${value.slice(-5)}`;
}

async function getInvokeErrorMessage(invokeError: any) {
  const context = invokeError?.context;
  if (context && typeof context.json === "function") {
    try {
      const payload = await context.json();
      const message =
        payload?.error ||
        payload?.error_message ||
        payload?.description ||
        payload?.message;
      if (message) return String(message);
    } catch {
      // Supabase уже вернёт исходное сообщение ниже.
    }
  }

  return String(invokeError?.message || "Edge Function returned an error");
}

export default function ChestnyZnakPage() {
  const [omsId, setOmsId] = useState(() => localStorage.getItem(OMS_STORAGE_KEY) || "");
  const [omsConnection, setOmsConnection] = useState(() => localStorage.getItem(CONNECTION_STORAGE_KEY) || "");
  const [inn, setInn] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signature, setSignature] = useState("");
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const configurationReady = Boolean(omsId.trim() && omsConnection.trim());

  const tokenRemaining = useMemo(() => {
    if (!auth?.expiresAt) return "";
    const diff = new Date(auth.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "истёк";
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return `${hours} ч ${minutes} мин`;
  }, [auth]);

  function saveConnectionSettings() {
    setError("");
    setMessage("");
    const nextOmsId = omsId.trim();
    const nextConnection = omsConnection.trim();

    if (!nextOmsId || !nextConnection) {
      setError("Укажите OMS ID и идентификатор соединения.");
      return;
    }

    localStorage.setItem(OMS_STORAGE_KEY, nextOmsId);
    localStorage.setItem(CONNECTION_STORAGE_KEY, nextConnection);
    setMessage("Параметры устройства сохранены только в этом браузере.");
  }

  async function requestChallenge() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setChallenge(null);
      setSignature("");
      setAuth(null);

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: { action: "challenge" },
      });

      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const uuid = String(data?.uuid || "");
      const challengeData = String(data?.data || "");
      const apiVersion = String(data?.apiVersion || "v3") === "v4" ? "v4" : "v3";
      if (!uuid || !challengeData) throw new Error("Честный ЗНАК не вернул данные для подписи.");

      setChallenge({ uuid, data: challengeData, apiVersion });
      setMessage("Данные для подписи получены. Подпишите строку своей УКЭП и вставьте подпись Base64 ниже.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось получить данные для подписи.");
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setAuth(null);

      if (!challenge) throw new Error("Сначала получите данные для подписи.");
      if (!configurationReady) throw new Error("Сначала укажите OMS ID и идентификатор соединения.");
      if (!signature.trim()) throw new Error("Вставьте подпись УКЭП в Base64.");

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: {
          action: "signin",
          omsConnection: omsConnection.trim(),
          uuid: challenge.uuid,
          signature: signature.trim().replace(/\s+/g, ""),
          apiVersion: challenge.apiVersion,
          ...(inn.trim() ? { inn: inn.trim() } : {}),
        },
      });

      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const token = String(data?.token || "");
      if (!token) throw new Error("Честный ЗНАК не вернул clientToken.");

      setAuth({
        token,
        expiresAt: String(data?.expiresAt || new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()),
      });
      setMessage("Авторизация успешна. Динамический clientToken получен; реальные заказы кодов не создавались.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось авторизоваться в Честном ЗНАКе.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>Честный ЗНАК</div>
            <div style={{ color: "#64748b", marginTop: 5 }}>Первый безопасный этап: авторизация СУЗ без заказа кодов и без операций с маркировкой.</div>
          </div>
          <span style={{
            borderRadius: 999,
            padding: "7px 11px",
            fontSize: 12,
            fontWeight: 900,
            background: auth ? "#ecfdf5" : "#fff7ed",
            color: auth ? "#047857" : "#b45309",
            border: auth ? "1px solid #a7f3d0" : "1px solid #fed7aa",
          }}>
            {auth ? "● Подключено" : "○ Не авторизовано"}
          </span>
        </div>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>1. Устройство СУЗ</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            OMS ID и идентификатор соединения не являются закрытым ключом. ERP сохраняет их локально в этом браузере; в базу данных они пока не записываются.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>OMS ID</span>
            <input value={omsId} onChange={(event) => setOmsId(event.target.value)} placeholder="UUID из раздела «Устройства»" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>Идентификатор соединения (omsConnection)</span>
            <input value={omsConnection} onChange={(event) => setOmsConnection(event.target.value)} placeholder="UUID устройства ERP Production" style={inputStyle} />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, maxWidth: 360 }}>
          <span style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>ИНН для МЧД — только если требуется</span>
          <input value={inn} onChange={(event) => setInn(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Обычно можно оставить пустым" style={inputStyle} />
        </label>

        <button type="button" onClick={saveConnectionSettings} style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "10px 14px", background: "#0f172a", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
          Сохранить параметры
        </button>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>2. Получить данные для подписи</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            ERP обращается к промышленному True API и получает одноразовые данные. Никаких заказов кодов на этом шаге нет.
          </div>
        </div>

        <button type="button" onClick={() => void requestChallenge()} disabled={loading || !configurationReady} style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "11px 15px", background: loading || !configurationReady ? "#94a3b8" : "#005bff", color: "#fff", fontWeight: 900, cursor: loading || !configurationReady ? "not-allowed" : "pointer" }}>
          {loading ? "Подождите…" : "Получить данные для подписи"}
        </button>

        {challenge && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>UUID авторизации</div>
              <div style={{ fontFamily: "monospace", marginTop: 4, wordBreak: "break-all" }}>{challenge.uuid}</div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>True API: {challenge.apiVersion}</div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Строка, которую нужно подписать УКЭП</div>
                <button type="button" onClick={() => void navigator.clipboard.writeText(challenge.data)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", padding: "6px 9px", fontWeight: 800, cursor: "pointer" }}>Копировать</button>
              </div>
              <div style={{ fontFamily: "monospace", marginTop: 7, wordBreak: "break-all" }}>{challenge.data}</div>
            </div>
          </div>
        )}
      </section>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>3. Подпись УКЭП и проверка подключения</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            На первом этапе вставьте CAdES-подпись Base64 вручную. Закрытый ключ и PIN не передаются ERP. Автоматическую подпись через КриптоПро добавим после этого контрольного теста.
          </div>
        </div>

        <textarea
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          rows={6}
          placeholder="Вставьте подпись Base64"
          style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
        />

        <button type="button" onClick={() => void signIn()} disabled={loading || !challenge || !signature.trim() || !configurationReady} style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "11px 15px", background: loading || !challenge || !signature.trim() || !configurationReady ? "#94a3b8" : "#16a34a", color: "#fff", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Проверяю…" : "Авторизоваться и проверить СУЗ"}
        </button>
      </section>

      {auth && (
        <section style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 18, padding: 18, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Соединение с Честным ЗНАКом подтверждено</div>
          <div>clientToken: <b>{masked(auth.token)}</b></div>
          <div>Ориентировочно осталось: <b>{tokenRemaining}</b></div>
          <div style={{ fontSize: 12 }}>Токен не записывается в Supabase и пропадёт после обновления страницы.</div>
        </section>
      )}

      {message && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>{message}</div>}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: 12 }}>{error}</div>}
    </div>
  );
}
