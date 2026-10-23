/** Browser-only structural check. This does not verify the signer or signed bytes. */
export type ChzSignatureCheck =
  | { ok: true; mode: "detached" | "attached"; details: string }
  | { ok: false; details: string };

type Asn1Element = { tag: number; start: number; end: number; next: number };

function readAsn1(bytes: Uint8Array, offset: number, limit: number, depth = 0): Asn1Element {
  if (depth > 32 || offset + 2 > limit) throw new Error("повреждена ASN.1-структура");
  const tag = bytes[offset];
  if ((tag & 0x1f) === 0x1f) throw new Error("неподдерживаемый ASN.1-тег");
  let position = offset + 2;
  const lengthCode = bytes[offset + 1];

  if (lengthCode === 0x80) {
    if ((tag & 0x20) === 0) throw new Error("недопустимая длина ASN.1");
    const start = position;
    while (position < limit) {
      if (position + 1 < limit && bytes[position] === 0 && bytes[position + 1] === 0) {
        return { tag, start, end: position, next: position + 2 };
      }
      position = readAsn1(bytes, position, limit, depth + 1).next;
    }
    throw new Error("ASN.1-объект не завершён");
  }

  let length = lengthCode;
  if (lengthCode > 0x80) {
    const lengthBytes = lengthCode & 0x7f;
    if (lengthBytes < 1 || lengthBytes > 4 || position + lengthBytes > limit) {
      throw new Error("недопустимая длина ASN.1");
    }
    length = 0;
    for (let index = 0; index < lengthBytes; index += 1) {
      length = length * 256 + bytes[position++];
    }
  }
  if (length > limit - position) throw new Error("ASN.1-объект обрезан");
  return { tag, start: position, end: position + length, next: position + length };
}

function children(bytes: Uint8Array, container: Asn1Element): Asn1Element[] {
  const result: Asn1Element[] = [];
  let position = container.start;
  while (position < container.end) {
    const next = readAsn1(bytes, position, container.end);
    result.push(next);
    position = next.next;
    if (result.length > 1000) throw new Error("слишком много ASN.1-элементов");
  }
  if (position !== container.end) throw new Error("ASN.1-структура не завершена");
  return result;
}

export function checkChzSignature(value: string): ChzSignatureCheck {
  const signature = value.replace(/\s/g, "");
  if (!signature) return { ok: false, details: "Подпись Base64 не заполнена." };
  if (signature.length > 2_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature)) {
    return { ok: false, details: "Подпись содержит некорректные символы Base64 или повреждена при копировании." };
  }

  try {
    const decoded = atob(signature);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const root = readAsn1(bytes, 0, bytes.length);
    if (root.tag !== 0x30 || root.next !== bytes.length) throw new Error("подпись не является цельным ASN.1-контейнером");

    const info = children(bytes, root);
    const signedDataOid = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
    const oid = info[0];
    if (!oid || oid.tag !== 0x06 || oid.end - oid.start !== signedDataOid.length ||
        !signedDataOid.every((part, index) => bytes[oid.start + index] === part)) {
      throw new Error("это не контейнер CMS SignedData");
    }
    if (info.length !== 2 || info[1].tag !== 0xa0) throw new Error("отсутствует содержимое CMS SignedData");

    const signedWrapper = children(bytes, info[1]);
    if (signedWrapper.length !== 1 || signedWrapper[0].tag !== 0x30) throw new Error("неверное содержимое CMS SignedData");
    const signed = children(bytes, signedWrapper[0]);
    if (signed.length < 4 || signed[0].tag !== 0x02 || signed[1].tag !== 0x31 || signed[2].tag !== 0x30) {
      throw new Error("в CMS отсутствуют обязательные поля SignedData");
    }
    const signerInfos = signed[signed.length - 1];
    if (signerInfos.tag !== 0x31 || !children(bytes, signerInfos).some((signer) => signer.tag === 0x30)) {
      throw new Error("в CMS отсутствует информация о подписанте");
    }
    const encap = children(bytes, signed[2]);
    if (!encap[0] || encap[0].tag !== 0x06) throw new Error("не указан тип подписанных данных");
    const mode = encap.some((field) => field.tag === 0xa0) ? "attached" : "detached";
    return {
      ok: true,
      mode,
      details: `Структура CMS SignedData распознана (${mode === "detached" ? "отделённая" : "присоединённая"} подпись). Подлинность и совпадение с запросом ЧЗ не проверены.`,
    };
  } catch (cause) {
    return { ok: false, details: `Не удалось распознать структуру подписи: ${cause instanceof Error ? cause.message : "неизвестная ошибка"}.` };
  }
}
