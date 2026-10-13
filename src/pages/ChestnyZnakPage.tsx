import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { getCryptoProCertificates, signChallengeWithCryptoPro, type CryptoProCertificateInfo } from "../integrations/cryptopro";

type Challenge = {
  uuid: string;
  data: string;
  apiVersion: "v3" | "v4";
};

type AuthResult = {
  connected: boolean;
  expiresAt: string;
  apiVersion?: string;
};

type ServerStatus = {
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  apiVersion: string | null;
  lastPingAt: string | null;
  lastPingOk: boolean | null;
  lastPingMessage: string | null;
};

type CatalogGood = {
  good_id?: number;
  gtin?: string;
  good_name?: string;
  tnved?: string;
  brand_name?: string;
  good_status?: string;
  good_detailed_status?: string[];
  to_date?: string;
};

type ErpProduct = {
  id: string;
  name: string;
  article?: string | null;
};

type ProductMapping = {
  id?: string;
  product_id: string;
  gtin: string;
  good_id?: number | null;
  good_name?: string | null;
  good_status?: string | null;
  good_mark_flag?: boolean | null;
  good_turn_flag?: boolean | null;
  brand_name?: string | null;
  tnved?: string | null;
  last_checked_at?: string | null;
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

function extractDnValue(subject: string, key: string) {
  const match = subject.match(new RegExp(`(?:^|,)\\s*${key}=([^,]+)`, "i"));
  return match?.[1]?.replace(/^"|"$/g, "").trim() || "";
}

function formatCertificateName(certificate: CryptoProCertificateInfo) {
  return (
    extractDnValue(certificate.subjectName, "CN") ||
    extractDnValue(certificate.subjectName, "SN") ||
    certificate.subjectName ||
    certificate.thumbprint
  );
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
  const [certificates, setCertificates] = useState<CryptoProCertificateInfo[]>([]);
  const [selectedCertificateThumbprint, setSelectedCertificateThumbprint] = useState("");
  const [cryptoProChecked, setCryptoProChecked] = useState(false);
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [catalogGoods, setCatalogGoods] = useState<CatalogGood[]>([]);
  const [erpProducts, setErpProducts] = useState<ErpProduct[]>([]);
  const [productMappings, setProductMappings] = useState<ProductMapping[]>([]);
  const [selectedProductByGtin, setSelectedProductByGtin] = useState<Record<string, string>>({});
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const configurationReady = Boolean(omsId.trim() && omsConnection.trim());

  useEffect(() => {
    void loadServerStatus();
  }, []);

  const tokenRemaining = useMemo(() => {
    if (!auth?.expiresAt) return "";
    const diff = new Date(auth.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "истёк";
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return `${hours} ч ${minutes} мин`;
  }, [auth]);

  async function loadServerStatus() {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: { action: "status" },
      });
      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const status: ServerStatus = {
        configured: Boolean(data?.configured),
        connected: Boolean(data?.connected),
        expiresAt: data?.expiresAt ? String(data.expiresAt) : null,
        apiVersion: data?.apiVersion ? String(data.apiVersion) : null,
        lastPingAt: data?.lastPingAt ? String(data.lastPingAt) : null,
        lastPingOk: typeof data?.lastPingOk === "boolean" ? data.lastPingOk : null,
        lastPingMessage: data?.lastPingMessage ? String(data.lastPingMessage) : null,
      };
      setServerStatus(status);
      setAuth(status.connected && status.expiresAt ? {
        connected: true,
        expiresAt: status.expiresAt,
        apiVersion: status.apiVersion || undefined,
      } : null);
    } catch {
      // Статус при открытии страницы не должен мешать ручной авторизации.
    }
  }

  async function testSuzConnection() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: { action: "ping" },
      });
      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      setMessage(`СУЗ API 3.0 отвечает. Проверка выполнена ${new Date(String(data?.checkedAt || new Date().toISOString())).toLocaleString("ru-RU")}.`);
      await loadServerStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось проверить СУЗ API 3.0.");
    } finally {
      setLoading(false);
    }
  }


  async function loadNationalCatalog() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: { action: "catalog" },
      });
      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const goods = Array.isArray(data?.goods) ? data.goods : [];
      const products = Array.isArray(data?.products) ? data.products : [];
      const mappings = Array.isArray(data?.mappings) ? data.mappings : [];

      setCatalogGoods(goods);
      setErpProducts(products);
      setProductMappings(mappings);
      setCatalogLoaded(true);

      const selected: Record<string, string> = {};
      for (const mapping of mappings) {
        if (mapping?.gtin && mapping?.product_id) selected[String(mapping.gtin)] = String(mapping.product_id);
      }
      setSelectedProductByGtin(selected);
      setMessage(`Национальный каталог загружен: ${goods.length} карточек. Существующих связей ERP ↔ GTIN: ${mappings.length}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить Национальный каталог.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProductMapping(gtin: string) {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const productId = String(selectedProductByGtin[gtin] || "");
      if (!productId) throw new Error("Сначала выберите товар ERP.");

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: { action: "save_mapping", productId, gtin },
      });
      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const nextMapping = data?.mapping as ProductMapping;
      setProductMappings((current) => [
        nextMapping,
        ...current.filter((row) => row.product_id !== nextMapping.product_id && row.gtin !== nextMapping.gtin),
      ]);
      setMessage(`GTIN ${gtin} связан с товаром ERP. Карточка дополнительно проверена через Национальный каталог.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить соответствие GTIN.");
    } finally {
      setLoading(false);
    }
  }

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

  async function loadCryptoProCertificates() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const rows = await getCryptoProCertificates();
      const now = Date.now();
      const usable = rows.filter((certificate) => new Date(certificate.validTo).getTime() > now);

      setCertificates(usable);
      setCryptoProChecked(true);

      if (!usable.length) {
        setSelectedCertificateThumbprint("");
        setError("КриптоПро доступен, но действующих сертификатов с закрытым ключом не найдено. Проверьте Рутокен и хранилище сертификатов Windows.");
        return;
      }

      setSelectedCertificateThumbprint((current) =>
        usable.some((certificate) => certificate.thumbprint === current)
          ? current
          : usable[0].thumbprint,
      );
      setMessage(`КриптоПро подключён. Найдено сертификатов с закрытым ключом: ${usable.length}.`);
    } catch (cause) {
      setCryptoProChecked(true);
      setCertificates([]);
      setSelectedCertificateThumbprint("");
      setError(cause instanceof Error ? cause.message : "Не удалось подключиться к КриптоПро.");
    } finally {
      setLoading(false);
    }
  }

  async function signWithCryptoPro() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setAuth(null);

      if (!challenge) throw new Error("Сначала получите данные для подписи.");
      if (!selectedCertificateThumbprint) throw new Error("Выберите сертификат УКЭП.");

      const createdSignature = await signChallengeWithCryptoPro(
        challenge.data,
        selectedCertificateThumbprint,
      );

      if (!createdSignature) throw new Error("КриптоПро не вернул подпись.");

      setSignature(createdSignature);
      setMessage("Строка подписана локально через КриптоПро. Закрытый ключ не покидал Рутокен. Проверяю авторизацию в Честном ЗНАКе…");
      await signIn(createdSignature);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подписать данные через КриптоПро.");
      setLoading(false);
    }
  }

  async function signIn(signatureOverride?: string) {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setAuth(null);

      if (!challenge) throw new Error("Сначала получите данные для подписи.");
      if (!configurationReady) throw new Error("Сначала укажите OMS ID и идентификатор соединения.");
      const signatureValue = String(signatureOverride || signature).trim();
      if (!signatureValue) throw new Error("Не получена подпись УКЭП.");

      const { data, error: invokeError } = await supabase.functions.invoke("chestny-znak-auth", {
        body: {
          action: "signin",
          omsId: omsId.trim(),
          omsConnection: omsConnection.trim(),
          uuid: challenge.uuid,
          signature: signatureValue.replace(/\s+/g, ""),
          apiVersion: challenge.apiVersion,
          ...(inn.trim() ? { inn: inn.trim() } : {}),
        },
      });

      if (invokeError) throw new Error(await getInvokeErrorMessage(invokeError));
      if (data?.error) throw new Error(data.error);

      const expiresAt = String(data?.expiresAt || "");
      if (!data?.connected || !expiresAt) throw new Error("Честный ЗНАК не подтвердил серверную сессию.");

      setAuth({
        connected: true,
        expiresAt,
        apiVersion: String(data?.apiVersion || challenge.apiVersion),
      });
      await loadServerStatus();
      setMessage("Авторизация успешна. Динамический clientToken сохранён на сервере; реальные заказы кодов не создавались.");
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
            OMS ID и идентификатор соединения не являются закрытым ключом. После успешной авторизации они сохраняются в защищённом серверном состоянии интеграции.
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
          <div style={{ fontWeight: 900, fontSize: 18 }}>3. Подпись УКЭП через КриптоПро</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            Подпись выполняется локально на этом компьютере. Закрытый ключ и PIN Рутокена не передаются в ERP или Supabase — в Честный ЗНАК уходит только готовая CAdES-BES подпись.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void loadCryptoProCertificates()}
            disabled={loading}
            style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 14px", background: "#fff", color: "#0f172a", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Проверяю…" : cryptoProChecked ? "Обновить сертификаты" : "Найти сертификаты КриптоПро"}
          </button>
          {cryptoProChecked && certificates.length > 0 && (
            <span style={{ color: "#15803d", fontWeight: 850, fontSize: 13 }}>● КриптоПро доступен</span>
          )}
        </div>

        {certificates.length > 0 && (
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>Сертификат для подписи</span>
            <select
              value={selectedCertificateThumbprint}
              onChange={(event) => setSelectedCertificateThumbprint(event.target.value)}
              style={inputStyle}
            >
              {certificates.map((certificate) => (
                <option key={certificate.thumbprint} value={certificate.thumbprint}>
                  {formatCertificateName(certificate)} · до {new Date(certificate.validTo).toLocaleDateString("ru-RU")} · {certificate.thumbprint.slice(-8)}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={() => void signWithCryptoPro()}
          disabled={loading || !challenge || !selectedCertificateThumbprint || !configurationReady}
          style={{
            justifySelf: "start",
            border: 0,
            borderRadius: 10,
            padding: "12px 16px",
            background: loading || !challenge || !selectedCertificateThumbprint || !configurationReady ? "#94a3b8" : "#16a34a",
            color: "#fff",
            fontWeight: 950,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Подписываю…" : "Подписать Рутокеном и авторизоваться"}
        </button>

        <details>
          <summary style={{ cursor: "pointer", color: "#64748b", fontWeight: 800 }}>Ручная подпись Base64 — резервный режим</summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <textarea
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
              rows={5}
              placeholder="Вставьте подпись Base64"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }}
            />
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={loading || !challenge || !signature.trim() || !configurationReady}
              style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "10px 14px", background: loading || !challenge || !signature.trim() || !configurationReady ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 900 }}
            >
              Авторизоваться с ручной подписью
            </button>
          </div>
        </details>
      </section>

      {auth && (
        <section style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 18, padding: 18, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Серверная сессия Честного ЗНАКа активна</div>
          <div>True API: <b>{auth.apiVersion || "v3"}</b></div>
          <div>Ориентировочно осталось: <b>{tokenRemaining}</b></div>
          <div style={{ fontSize: 12 }}>clientToken хранится только на сервере и не показывается браузеру.</div>
          <button
            type="button"
            onClick={() => void testSuzConnection()}
            disabled={loading}
            style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "10px 14px", background: loading ? "#94a3b8" : "#16a34a", color: "#fff", fontWeight: 900 }}
          >
            {loading ? "Проверяю СУЗ…" : "Проверить СУЗ API 3.0"}
          </button>
          {serverStatus?.lastPingAt && (
            <div style={{ fontSize: 12 }}>
              Последняя проверка: <b>{new Date(serverStatus.lastPingAt).toLocaleString("ru-RU")}</b> · {serverStatus.lastPingOk ? "успешно" : "ошибка"}
            </div>
          )}
        </section>
      )}


      {auth && (
        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 20 }}>4. Национальный каталог и GTIN</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              ERP читает только ваши карточки Национального каталога. Ничего в Честном ЗНАКе на этом этапе не создаётся и не изменяется.
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadNationalCatalog()}
            disabled={loading}
            style={{ justifySelf: "start", border: 0, borderRadius: 10, padding: "11px 15px", background: loading ? "#94a3b8" : "#005bff", color: "#fff", fontWeight: 900 }}
          >
            {loading ? "Загружаю…" : catalogLoaded ? "Обновить Национальный каталог" : "Загрузить Национальный каталог"}
          </button>

          {catalogLoaded && (
            <>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: "#475569", fontSize: 13 }}>
                <span>Карточек ЧЗ: <b>{catalogGoods.length}</b></span>
                <span>Товаров ERP: <b>{erpProducts.length}</b></span>
                <span>Связано: <b>{productMappings.length}</b></span>
              </div>

              {!catalogGoods.length ? (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 12, padding: 12 }}>
                  В Национальном каталоге не найдено собственных карточек за выбранный диапазон.
                </div>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>GTIN</th>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Товар ЧЗ</th>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Статус</th>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>ТН ВЭД</th>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Товар ERP</th>
                        <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogGoods.map((good) => {
                        const gtin = String(good?.gtin || "");
                        const mapping = productMappings.find((row) => row.gtin === gtin);
                        const selectedProductId = selectedProductByGtin[gtin] || mapping?.product_id || "";
                        const selectedProduct = erpProducts.find((product) => product.id === selectedProductId);
                        const isSaved = Boolean(mapping && mapping.product_id === selectedProductId);

                        return (
                          <tr key={`${good?.good_id || "good"}-${gtin}`}>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", fontFamily: "monospace", fontWeight: 800 }}>{gtin || "—"}</td>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                              <div style={{ fontWeight: 850 }}>{String(good?.good_name || "Без названия")}</div>
                              {good?.brand_name && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{String(good.brand_name)}</div>}
                            </td>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{String(good?.good_status || "—")}</td>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{String(good?.tnved || "—")}</td>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                              <select
                                value={selectedProductId}
                                onChange={(event) => setSelectedProductByGtin((current) => ({ ...current, [gtin]: event.target.value }))}
                                style={{ ...inputStyle, minWidth: 260 }}
                              >
                                <option value="">— выбрать товар ERP —</option>
                                {erpProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.article ? `${product.article} · ` : ""}{product.name}
                                  </option>
                                ))}
                              </select>
                              {isSaved && selectedProduct && (
                                <div style={{ color: "#15803d", fontSize: 11, marginTop: 4 }}>Связано: {selectedProduct.name}</div>
                              )}
                            </td>
                            <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                              <button
                                type="button"
                                onClick={() => void saveProductMapping(gtin)}
                                disabled={loading || !gtin || !selectedProductId || isSaved}
                                style={{
                                  border: 0,
                                  borderRadius: 9,
                                  padding: "8px 11px",
                                  background: !loading && gtin && selectedProductId && !isSaved ? "#0f172a" : "#cbd5e1",
                                  color: "#fff",
                                  fontWeight: 850,
                                }}
                              >
                                {isSaved ? "Связано" : "Связать"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {message && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>{message}</div>}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: 12 }}>{error}</div>}
    </div>
  );
}
