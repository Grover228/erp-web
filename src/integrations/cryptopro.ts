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

async function waitForCadesPlugin(timeoutMs = 7000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (window.cadesplugin) {
      try {
        await window.cadesplugin;
      } catch {
        // Сам объект уже появился; ниже проверим, доступны ли методы плагина.
      }

      if (window.cadesplugin?.CreateObjectAsync) {
        return window.cadesplugin;
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }

  throw new Error(
    "Расширение КриптоПро установлено, но не подключилось к streetstream.ru. Откройте настройки расширения CryptoPro Extension for CAdES Browser Plug-in и разрешите ему доступ к этому сайту (или ко всем сайтам), затем обновите страницу.",
  );
}

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
  if (!pluginLoadPromise) {
    pluginLoadPromise = waitForCadesPlugin().catch((cause) => {
      pluginLoadPromise = null;
      throw cause;
    });
  }

  return pluginLoadPromise;
}

async function getPlugin() {
  const plugin = await loadCryptoProPlugin();
  if (!plugin?.CreateObjectAsync) {
    throw new Error(
      "КриптоПро установлен, но браузер не дал ERP доступ к расширению. Разрешите расширению CryptoPro Extension for CAdES Browser Plug-in работать на streetstream.ru и обновите страницу.",
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
      false, // True API simpleSignIn requires an attached CMS/CAdES signature.
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

export type CryptoProDetachedVerification = {
  matchedEncoding: "utf8" | "utf16le" | "attached" | null;
  message: string;
};

/** Verify a detached CMS/CAdES signature against the exact current challenge.
 * Runs in the browser's CryptoPro extension; nothing is sent to ERP or Supabase.
 */
export async function verifyDetachedSignatureWithCryptoPro(
  challenge: string,
  signature: string,
): Promise<CryptoProDetachedVerification> {
  const plugin = await getPlugin();
  const cleanSignature = signature.replace(/\s+/g, "");

  async function verify(encodedContent: string): Promise<void> {
    const signedData = await plugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
    await signedData.propset_ContentEncoding(plugin.CADESCOM_BASE64_TO_BINARY);
    await signedData.propset_Content(encodedContent);
    await signedData.VerifyCades(cleanSignature, plugin.CADESCOM_CADES_BES, true);
  }

  try {
    await verify(utf8ToBase64(challenge));
    return {
      matchedEncoding: "utf8",
      message: "КриптоПро подтвердил подпись именно этой строки в UTF-8. Это не проверяет права в ЧЗ.",
    };
  } catch (utf8Error) {
    // Browser demo pages sometimes sign UCS-2/UTF-16LE by default,
    // whereas our native ERP signing path explicitly signs UTF-8 bytes.
    const bytes = new Uint8Array(challenge.length * 2);
    for (let i = 0; i < challenge.length; i += 1) {
      const code = challenge.charCodeAt(i);
      bytes[i * 2] = code & 0xff;
      bytes[i * 2 + 1] = code >>> 8;
    }

    try {
      await verify(bytesToBase64(bytes));
      return {
        matchedEncoding: "utf16le",
        message: "Подпись действительна для UTF-16LE, но НЕ совпадает с UTF-8 исходной строки. Проверьте кодировку на странице КриптоПро перед авторизацией.",
      };
    } catch (utf16Error) {
      const getReason = (cause: unknown) => {
        const pluginError = window.cadesplugin?.getLastError;
        const raw = typeof pluginError === "function"
          ? String(pluginError(cause))
          : cause instanceof Error ? cause.message : String(cause);
        return raw.slice(0, 240);
      };
      return {
        matchedEncoding: null,
        message: `КриптоПро не подтвердил подпись для этой строки ни в UTF-8, ни в UTF-16LE. UTF-8: ${getReason(utf8Error)}; UTF-16LE: ${getReason(utf16Error)}. Проверьте исходную строку и сертификат.`,
      };
    }
  }
}

/** Verify the embedded CMS/CAdES signature locally via CryptoPro.
 * This confirms cryptographic integrity of the attached content, not whether
 * the embedded text matches a particular True API challenge or grants access.
 */
export async function verifyAttachedSignatureWithCryptoPro(
  signature: string,
): Promise<CryptoProDetachedVerification> {
  const plugin = await getPlugin();
  const signedData = await plugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
  await signedData.VerifyCades(signature.replace(/\s+/g, ""), plugin.CADESCOM_CADES_BES, false);
  return {
    matchedEncoding: "attached",
    message: "КриптоПро подтвердил действительность присоединённой подписи. Соответствие вложенного текста запросу и права в ЧЗ отдельно не проверены.",
  };
}
