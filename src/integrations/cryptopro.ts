export type CryptoProCertificateInfo = {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  validFrom: string;
  validTo: string;
  hasPrivateKey: boolean;
};

declare global {
  interface Window {
    cadesplugin?: any;
  }
}

let pluginLoadPromise: Promise<any> | null = null;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function utf8ToBase64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

async function loadCryptoProPlugin() {
  if (window.cadesplugin) {
    try {
      await window.cadesplugin;
    } catch {
      // Ошибка плагина будет разобрана ниже.
    }
    return window.cadesplugin;
  }

  if (!pluginLoadPromise) {
    pluginLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-cryptopro-cades="1"]');

      const finish = async () => {
        try {
          if (!window.cadesplugin) {
            throw new Error("КриптоПро Browser plug-in не обнаружен.");
          }
          await window.cadesplugin;
          resolve(window.cadesplugin);
        } catch (cause) {
          reject(cause);
        }
      };

      if (existing) {
        void finish();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.cryptopro.ru/sites/default/files/products/cades/cadesplugin_api.js";
      script.async = true;
      script.dataset.cryptoproCades = "1";
      script.onload = () => void finish();
      script.onerror = () => reject(new Error("Не удалось загрузить официальный cadesplugin_api.js КриптоПро."));
      document.head.appendChild(script);
    });
  }

  return pluginLoadPromise;
}

async function getPlugin() {
  const plugin = await loadCryptoProPlugin();
  if (!plugin?.CreateObjectAsync) {
    throw new Error(
      "КриптоПро Browser plug-in не готов. Проверьте, что установлены КриптоПро CSP, ЭЦП Browser plug-in и расширение CryptoPro Extension for CAdES Browser Plug-in, затем перезапустите браузер.",
    );
  }
  return plugin;
}

async function openMyStore(plugin: any) {
  const store = await plugin.CreateObjectAsync("CAdESCOM.Store");
  await store.Open(
    plugin.CAPICOM_CURRENT_USER_STORE,
    plugin.CAPICOM_MY_STORE,
    plugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED,
  );
  return store;
}

export async function getCryptoProCertificates(): Promise<CryptoProCertificateInfo[]> {
  const plugin = await getPlugin();
  const store = await openMyStore(plugin);

  try {
    const certificates = await store.Certificates;
    const count = Number(await certificates.Count);
    const result: CryptoProCertificateInfo[] = [];

    for (let index = 1; index <= count; index += 1) {
      const certificate = await certificates.Item(index);
      const [thumbprint, subjectName, issuerName, validFromRaw, validToRaw, hasPrivateKeyRaw] = await Promise.all([
        certificate.Thumbprint,
        certificate.SubjectName,
        certificate.IssuerName,
        certificate.ValidFromDate,
        certificate.ValidToDate,
        certificate.HasPrivateKey(),
      ]);

      result.push({
        thumbprint: String(thumbprint || "").replace(/\s+/g, "").toUpperCase(),
        subjectName: String(subjectName || ""),
        issuerName: String(issuerName || ""),
        validFrom: new Date(validFromRaw).toISOString(),
        validTo: new Date(validToRaw).toISOString(),
        hasPrivateKey: Boolean(hasPrivateKeyRaw),
      });
    }

    return result
      .filter((certificate) => certificate.hasPrivateKey)
      .sort((a, b) => new Date(b.validTo).getTime() - new Date(a.validTo).getTime());
  } finally {
    try {
      await store.Close();
    } catch {
      // Закрытие Store не должно ломать основной сценарий.
    }
  }
}

export async function signChallengeWithCryptoPro(
  challenge: string,
  thumbprint: string,
): Promise<string> {
  const plugin = await getPlugin();
  const normalizedThumbprint = thumbprint.replace(/\s+/g, "").toUpperCase();
  const store = await openMyStore(plugin);

  try {
    const certificates = await store.Certificates;
    const found = await certificates.Find(
      plugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
      normalizedThumbprint,
    );
    const count = Number(await found.Count);

    if (!count) {
      throw new Error("Выбранный сертификат не найден в хранилище Windows.");
    }

    const certificate = await found.Item(1);
    const signer = await plugin.CreateObjectAsync("CAdESCOM.CPSigner");
    await signer.propset_Certificate(certificate);
    await signer.propset_CheckCertificate(true);
    await signer.propset_Options(plugin.CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN);

    const signedData = await plugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
    await signedData.propset_ContentEncoding(plugin.CADESCOM_BASE64_TO_BINARY);
    await signedData.propset_Content(utf8ToBase64(challenge));

    const signature = await signedData.SignCades(
      signer,
      plugin.CADESCOM_CADES_BES,
      true,
    );

    return String(signature || "").replace(/\s+/g, "");
  } catch (cause: any) {
    const pluginError = window.cadesplugin?.getLastError;
    const message =
      typeof pluginError === "function"
        ? String(pluginError(cause))
        : cause instanceof Error
          ? cause.message
          : String(cause || "Ошибка подписи КриптоПро");
    throw new Error(message);
  } finally {
    try {
      await store.Close();
    } catch {
      // Закрытие Store не должно ломать основной сценарий.
    }
  }
}
