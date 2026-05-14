import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import LinkedDocumentsModal from "../purchases/LinkedDocumentsModal";

export type PurchaseItemType = "material" | "consumable";

export type SupplierReceipt = {
  id: string;
  supplier_order_id: string | null;
  receipt_number: string | null;
  receipt_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  comment: string | null;
  total_amount: number;
  created_at: string | null;
};

export type SupplierReceiptItem = {
  id: string;
  item_type: PurchaseItemType;
  material_id: string | null;
  consumable_id: string | null;
  quantity: number;
  price: number;
  amount: number;
  materials?: {
    name: string | null;
    article: string | null;
    color_id: string | null;
  } | null;
  consumables?: {
    name: string | null;
    article: string | null;
  } | null;
};

export type Color = {
  id: string;
  name: string;
  hex: string | null;
};

type DocumentType = "supplier_order" | "supplier_receipt" | "supplier_payment";

type ReceiptItemDraft = {
  id: string;
  item_type: PurchaseItemType;
  material_id: string;
  consumable_id: string;
  quantity: string;
  price: string;
};

type ReceiptModalProps = {
  receipt: SupplierReceipt;
  colors: Color[];
  onClose: () => void;
  onSaved: () => void;
  onOpenDocument?: (type: DocumentType, id: string) => void;
};

function receiptItemToDraft(item: SupplierReceiptItem): ReceiptItemDraft {
  return {
    id: item.id,
    item_type: item.item_type,
    material_id: item.material_id || "",
    consumable_id: item.consumable_id || "",
    quantity: String(item.quantity ?? 0),
    price: String(item.price ?? 0),
  };
}

export default function ReceiptModal({
  receipt,
  colors,
  onClose,
  onSaved,
  onOpenDocument,
}: ReceiptModalProps) {
  const [items, setItems] = useState<SupplierReceiptItem[]>([]);
  const [draftItems, setDraftItems] = useState<ReceiptItemDraft[]>([]);
  const [receiptDate, setReceiptDate] = useState(receipt.receipt_date || "");
  const [supplierName, setSupplierName] = useState(receipt.supplier_name || "");
  const [comment, setComment] = useState(receipt.comment || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(receipt);
  const [isLinkedDocumentsModalOpen, setIsLinkedDocumentsModalOpen] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentReceipt(receipt);
    setReceiptDate(receipt.receipt_date || "");
    setSupplierName(receipt.supplier_name || "");
    setComment(receipt.comment || "");
    loadItems();
  }, [receipt.id]);

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("supplier_receipt_items")
        .select(
          `
          *,
          materials(name, article, color_id),
          consumables(name, article)
        `,
        )
        .eq("supplier_receipt_id", receipt.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedItems = (data as SupplierReceiptItem[]) || [];

      setItems(loadedItems);
      setDraftItems(loadedItems.map(receiptItemToDraft));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки позиций приёмки",
      );
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setReceiptDate(currentReceipt.receipt_date || "");
    setSupplierName(currentReceipt.supplier_name || "");
    setComment(currentReceipt.comment || "");
    setDraftItems(items.map(receiptItemToDraft));
    setIsEditing(true);
    setError("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setError("");
  }

  function updateDraftItem(id: string, patch: Partial<ReceiptItemDraft>) {
    setDraftItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function getDraftItemAmount(item: ReceiptItemDraft) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return quantity * price;
  }

  function getDraftTotalAmount() {
    return draftItems.reduce((sum, item) => sum + getDraftItemAmount(item), 0);
  }

  async function saveChanges() {
    try {
      setSaving(true);
      setError("");

      const totalAmount = getDraftTotalAmount();

      const { error: receiptError } = await supabase
        .from("supplier_receipts")
        .update({
          receipt_date: receiptDate,
          supplier_name: supplierName.trim() || null,
          comment: comment.trim() || null,
          total_amount: totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      if (receiptError) throw receiptError;

      for (const item of draftItems) {
        const { error: itemError } = await supabase
          .from("supplier_receipt_items")
          .update({
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
          })
          .eq("id", item.id);

        if (itemError) throw itemError;
      }

      setIsEditing(false);
      await loadItems();
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка сохранения приёмки",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteReceipt() {
    const confirmed = window.confirm(
      `Удалить приёмку ${receipt.receipt_number || "Черновик приёмки"}?`,
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const { error } = await supabase
        .from("supplier_receipts")
        .delete()
        .eq("id", receipt.id);

      if (error) throw error;

      onSaved();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка удаления приёмки",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function postReceipt() {
    if (currentReceipt.status === "posted") return;

    const confirmed = window.confirm(
      "Провести приёмку? Остатки будут увеличены по позициям документа.",
    );

    if (!confirmed) return;

    try {
      setPosting(true);
      setError("");

      const receiptItems = items.length > 0 ? items : await loadItemsForPosting();

      if (receiptItems.length === 0) {
        throw new Error("В приёмке нет позиций для проведения");
      }

      const now = new Date().toISOString();

      const { error: deleteMovementsError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("source_document_type", "supplier_receipt")
        .eq("source_document_id", currentReceipt.id);

      if (deleteMovementsError) throw deleteMovementsError;

      const movementRows = receiptItems
        .map((item) => ({
          movement_type: "supplier_receipt",
          source_document_type: "supplier_receipt",
          source_document_id: currentReceipt.id,
          production_order_id: null,
          item_type: item.item_type,
          product_id: null,
          material_id: item.item_type === "material" ? item.material_id : null,
          consumable_id:
            item.item_type === "consumable" ? item.consumable_id : null,
          quantity: Number(item.quantity || 0),
          created_at: now,
        }))
        .filter((item) => Number(item.quantity || 0) > 0);

      if (movementRows.length === 0) {
        throw new Error("В приёмке нет положительных количеств");
      }

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(movementRows);

      if (movementsError) throw movementsError;

      const { error: receiptError } = await supabase
        .from("supplier_receipts")
        .update({
          status: "posted",
          updated_at: now,
        })
        .eq("id", currentReceipt.id);

      if (receiptError) throw receiptError;

      setCurrentReceipt((prev) => ({
        ...prev,
        status: "posted",
      }));

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка проведения приёмки",
      );
    } finally {
      setPosting(false);
    }
  }

  async function loadItemsForPosting() {
    const { data, error } = await supabase
      .from("supplier_receipt_items")
      .select(
        `
        *,
        materials(name, article, color_id),
        consumables(name, article)
      `,
      )
      .eq("supplier_receipt_id", currentReceipt.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const loadedItems = (data as SupplierReceiptItem[]) || [];
    setItems(loadedItems);
    setDraftItems(loadedItems.map(receiptItemToDraft));

    return loadedItems;
  }

  function handleOpenLinkedDocument(type: DocumentType, id: string) {
    if (type === "supplier_receipt" && id === receipt.id) return;

    onOpenDocument?.(type, id);
  }

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "posted") return "Проведена";
    if (status === "cancelled") return "Отменена";
    return status || "—";
  }

  function getItemName(item: SupplierReceiptItem) {
    if (item.item_type === "material") {
      return item.materials?.name || "Материал";
    }

    return item.consumables?.name || "Расходник";
  }

  function getItemArticle(item: SupplierReceiptItem) {
    if (item.item_type === "material") {
      return item.materials?.article || "";
    }

    return item.consumables?.article || "";
  }

  function getColorById(colorId: string | null | undefined) {
    if (!colorId) return null;
    return colors.find((color) => color.id === colorId) || null;
  }

  function getItemColor(item: SupplierReceiptItem) {
    if (item.item_type !== "material") return null;
    return getColorById(item.materials?.color_id || null);
  }

  function renderColorChip(color: Color | null) {
    if (!color) {
      return <span style={emptyColorChipStyle}>—</span>;
    }

    return (
      <span style={colorChipStyle}>
        <span
          style={{
            ...colorDotStyle,
            background: color.hex || "#e2e8f0",
          }}
        />
        {color.name}
      </span>
    );
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>
              Приёмка {currentReceipt.receipt_number || "Черновик"}
            </div>

            <div style={modalSubtitleStyle}>
              Дата: {currentReceipt.receipt_date || "—"} · Поставщик:{" "}
              {currentReceipt.supplier_name || "—"}
            </div>
          </div>

          <div style={modalActionsStyle}>
            {!isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsLinkedDocumentsModalOpen(true)}
                  style={linkedDocumentsButtonStyle}
                >
                  🔗 Связанные документы
                </button>

                {currentReceipt.status !== "posted" && (
                  <button
                    type="button"
                    onClick={postReceipt}
                    disabled={posting}
                    style={{
                      ...postReceiptButtonStyle,
                      opacity: posting ? 0.65 : 1,
                      cursor: posting ? "not-allowed" : "pointer",
                    }}
                  >
                    {posting ? "Провожу..." : "✓ Провести приёмку"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={startEdit}
                  style={editButtonStyle}
                >
                  ✏️ Редактировать
                </button>

                <button
                  type="button"
                  onClick={deleteReceipt}
                  disabled={deleting}
                  style={{
                    ...deleteButtonStyle,
                    opacity: deleting ? 0.65 : 1,
                    cursor: deleting ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting ? "Удаляю..." : "Удалить"}
                </button>
              </>
            )}

            <button type="button" onClick={onClose} style={closeButtonStyle}>
              ×
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {isEditing ? (
          <div style={formCardStyle}>
            <div style={grid2Style}>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Дата приёмки</span>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(event) => setReceiptDate(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={labelTextStyle}>Поставщик</span>
                <input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Поставщик"
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={itemsBlockStyle}>
              <div style={sectionTitleStyle}>Позиции приёмки</div>

              {draftItems.length === 0 ? (
                <div style={emptyStyle}>В приёмке нет позиций.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {draftItems.map((draftItem, index) => {
                    const sourceItem = items.find(
                      (item) => item.id === draftItem.id,
                    );

                    return (
                      <div key={draftItem.id} style={editItemRowStyle}>
                        <div style={{ fontWeight: 900, color: "#64748b" }}>
                          #{index + 1}
                        </div>

                        <div style={itemNameBoxStyle}>
                          <div style={itemNameStyle}>
                            {sourceItem ? getItemName(sourceItem) : "Позиция"}
                          </div>
                          <div style={itemMetaStyle}>
                            {draftItem.item_type === "material"
                              ? "Материал"
                              : "Расходник"}
                            {sourceItem && getItemArticle(sourceItem)
                              ? ` · ${getItemArticle(sourceItem)}`
                              : ""}
                          </div>
                        </div>

                        <label style={labelStyle}>
                          <span style={labelTextStyle}>Количество</span>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={draftItem.quantity}
                            onChange={(event) =>
                              updateDraftItem(draftItem.id, {
                                quantity: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          <span style={labelTextStyle}>Цена</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftItem.price}
                            onChange={(event) =>
                              updateDraftItem(draftItem.id, {
                                price: event.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </label>

                        <div style={{ display: "grid", gap: 4 }}>
                          <span style={labelTextStyle}>Сумма</span>
                          <div style={amountBoxStyle}>
                            {getDraftItemAmount(draftItem).toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}{" "}
                            ₽
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={totalStyle}>
                Итого:{" "}
                {getDraftTotalAmount().toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ₽
              </div>
            </div>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Комментарий</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                placeholder="Комментарий к приёмке"
                style={{ ...inputStyle, resize: "vertical", minHeight: 76 }}
              />
            </label>

            <div style={footerActionsStyle}>
              <button
                type="button"
                onClick={saveChanges}
                disabled={saving}
                style={saveButtonStyle(saving)}
              >
                {saving ? "Сохраняю..." : "Сохранить изменения"}
              </button>

              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                style={cancelButtonStyle}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={modalInfoGridStyle}>
              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Статус</div>
                <div style={modalInfoValueStyle}>
                  {getStatusLabel(currentReceipt.status)}
                </div>
              </div>

              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Сумма</div>
                <div style={modalInfoValueStyle}>
                  {Number(currentReceipt.total_amount || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₽
                </div>
              </div>
            </div>

            {currentReceipt.status !== "posted" && (
              <div style={statusHintStyle}>
                Чтобы приёмка увеличила складские остатки, нажми кнопку
                <strong> «Провести приёмку»</strong>. Можно также оставить
                документ черновиком и провести позже.
              </div>
            )}

            {currentReceipt.comment && (
              <div style={commentBoxStyle}>{currentReceipt.comment}</div>
            )}

            <div>
              <div style={sectionTitleStyle}>Позиции приёмки</div>

              {loading ? (
                <div style={emptyStyle}>Загружаю позиции...</div>
              ) : items.length === 0 ? (
                <div style={emptyStyle}>В приёмке нет позиций.</div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Тип</th>
                        <th style={thStyle}>Номенклатура</th>
                        <th style={thStyle}>Артикул</th>
                        <th style={thStyle}>Цвет</th>
                        <th style={thStyle}>Кол-во</th>
                        <th style={thStyle}>Цена</th>
                        <th style={thStyle}>Сумма</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td style={tdStyle}>
                            {item.item_type === "material"
                              ? "Материал"
                              : "Расходник"}
                          </td>
                          <td style={tdStyle}>{getItemName(item)}</td>
                          <td style={tdStyle}>{getItemArticle(item) || "—"}</td>
                          <td style={tdStyle}>
                            {item.item_type === "material"
                              ? renderColorChip(getItemColor(item))
                              : "—"}
                          </td>
                          <td style={tdStyle}>{item.quantity}</td>
                          <td style={tdStyle}>
                            {Number(item.price || 0).toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </td>
                          <td style={tdStyle}>
                            {Number(item.amount || 0).toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        {isLinkedDocumentsModalOpen && (
          <LinkedDocumentsModal
            sourceType="supplier_receipt"
            sourceId={currentReceipt.id}
            supplierOrderId={currentReceipt.supplier_order_id}
            onClose={() => setIsLinkedDocumentsModalOpen(false)}
            onOpenDocument={handleOpenLinkedDocument}
          />
        )}

      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 14,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 16,
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const postReceiptButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#15803d",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const statusHintStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 12,
  lineHeight: 1.5,
};

const linkedDocumentsButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const editButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};

const formCardStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 12,
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#334155",
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
};

const itemsBlockStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
  background: "#ffffff",
  display: "grid",
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 10,
};

const editItemRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(220px, 1fr) 130px 120px 140px",
  gap: 8,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 10,
  background: "#f8fafc",
  overflowX: "auto",
};

const itemNameBoxStyle: React.CSSProperties = {
  minHeight: 42,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#ffffff",
  padding: "8px 12px",
  display: "grid",
  gap: 2,
  boxSizing: "border-box",
};

const itemNameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
};

const itemMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const amountBoxStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 10px",
  background: "#ffffff",
  fontWeight: 900,
  color: "#0f172a",
  minHeight: 38,
  boxSizing: "border-box",
  fontSize: 14,
};

const totalStyle: React.CSSProperties = {
  textAlign: "right",
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const saveButtonStyle = (saving: boolean): React.CSSProperties => ({
  border: "none",
  background: saving ? "#94a3b8" : "#16a34a",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 15px",
  cursor: saving ? "not-allowed" : "pointer",
  fontWeight: 900,
});

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "10px 15px",
  cursor: "pointer",
  fontWeight: 900,
};

const footerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const modalInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const modalInfoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
};

const modalInfoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 4,
};

const modalInfoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const commentBoxStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
  color: "#334155",
  lineHeight: 1.5,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 22,
  textAlign: "center",
  color: "#64748b",
};

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  minWidth: 760,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  color: "#334155",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
  verticalAlign: "middle",
};

const colorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  width: "fit-content",
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const emptyColorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#94a3b8",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const colorDotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  flexShrink: 0,
};
