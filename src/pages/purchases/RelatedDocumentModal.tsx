import { useState } from "react";
import { supabase } from "../../supabase";
import type { SupplierOrder, SupplierOrderItem } from "./SupplierOrderModal";

type RelatedDocumentType = "receipt" | "payment" | "invoice";

type RelatedDocumentModalProps = {
  order: SupplierOrder;
  orderItems: SupplierOrderItem[];
  onClose: () => void;
};

const documentTypes: {
  type: RelatedDocumentType;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    type: "receipt",
    title: "Приёмка на склад",
    subtitle: "Зафиксировать приход и увеличить остатки материалов",
    icon: "📦",
  },
  {
    type: "payment",
    title: "Оплата поставщику",
    subtitle: "Создать исходящий платеж по заказу поставщику",
    icon: "💸",
  },
  {
    type: "invoice",
    title: "Накладная поставщика",
    subtitle: "Зарегистрировать документ, полученный от поставщика",
    icon: "📄",
  },
];

export default function RelatedDocumentModal({
  order,
  orderItems,
  onClose,
}: RelatedDocumentModalProps) {
  const [selectedType, setSelectedType] =
    useState<RelatedDocumentType>("receipt");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedDocument = documentTypes.find(
    (document) => document.type === selectedType,
  );

  function getDocumentDescription() {
    if (selectedType === "receipt") {
      return "Приёмка создаст складской документ на основании позиций заказа. Следующим шагом здесь будет проведение документа и увеличение остатков.";
    }

    if (selectedType === "payment") {
      return "Оплата создаст финансовый документ. Следующим шагом здесь будет выбор счёта списания и уменьшение баланса.";
    }

    return "Накладная поставщика позволит зафиксировать номер и дату входящего документа поставщика.";
  }

  async function createReceiptDraft() {
    if (orderItems.length === 0) {
      throw new Error("В заказе нет позиций для приёмки");
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("supplier_receipts")
      .insert({
        supplier_order_id: order.id,
        receipt_date: new Date().toISOString().slice(0, 10),
        supplier_id: order.supplier_id || null,
        supplier_name: order.supplier_name || null,
        status: "draft",
        comment: `Создано из заказа ${order.order_number || "без номера"}`,
        total_amount: order.total_amount || 0,
      })
      .select("id")
      .single();

    if (receiptError) throw receiptError;

    const { error: itemsError } = await supabase
      .from("supplier_receipt_items")
      .insert(
        orderItems.map((item) => ({
          supplier_receipt_id: receipt.id,
          item_type: item.item_type,
          material_id: item.item_type === "material" ? item.material_id : null,
          consumable_id:
            item.item_type === "consumable" ? item.consumable_id : null,
          quantity: item.quantity,
          price: item.price || 0,
        })),
      );

    if (itemsError) throw itemsError;
  }

  async function handleCreateDocument() {
    try {
      setCreating(true);
      setError("");

      if (selectedType === "receipt") {
        await createReceiptDraft();
        window.alert("Черновик приёмки создан");
        onClose();
        return;
      }

      if (selectedType === "payment") {
        window.alert("Создание оплаты поставщику будет следующим шагом.");
        return;
      }

      window.alert("Создание накладной поставщика будет следующим шагом.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка создания связанного документа",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Создать связанный документ</div>
            <div style={modalSubtitleStyle}>
              Заказ {order.order_number || "Без номера"} ·{" "}
              {order.supplier_name || "Поставщик не указан"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={contentGridStyle}>
          <div style={documentListStyle}>
            {documentTypes.map((document) => (
              <button
                key={document.type}
                type="button"
                onClick={() => setSelectedType(document.type)}
                style={documentTypeButtonStyle(
                  selectedType === document.type,
                )}
              >
                <span style={documentIconStyle}>{document.icon}</span>

                <span style={{ display: "grid", gap: 3 }}>
                  <span style={documentTitleStyle}>{document.title}</span>
                  <span style={documentSubtitleStyle}>{document.subtitle}</span>
                </span>
              </button>
            ))}
          </div>

          <div style={detailsCardStyle}>
            <div style={detailsHeaderStyle}>
              <div style={detailsIconStyle}>{selectedDocument?.icon}</div>

              <div>
                <div style={detailsTitleStyle}>{selectedDocument?.title}</div>
                <div style={detailsSubtitleStyle}>
                  {selectedDocument?.subtitle}
                </div>
              </div>
            </div>

            <div style={descriptionStyle}>{getDocumentDescription()}</div>

            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Заказ</div>
                <div style={summaryValueStyle}>
                  {order.order_number || "Без номера"}
                </div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Дата заказа</div>
                <div style={summaryValueStyle}>{order.order_date || "—"}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Сумма</div>
                <div style={summaryValueStyle}>
                  {Number(order.total_amount || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₽
                </div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Позиций</div>
                <div style={summaryValueStyle}>{orderItems.length}</div>
              </div>
            </div>

            {selectedType === "receipt" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Что попадёт в приёмку</div>

                {orderItems.length === 0 ? (
                  <div style={emptyStyle}>В заказе нет позиций.</div>
                ) : (
                  <div style={miniTableStyle}>
                    {orderItems.map((item) => (
                      <div key={item.id} style={miniTableRowStyle}>
                        <span>
                          {item.item_type === "material"
                            ? item.materials?.name || "Материал"
                            : item.consumables?.name || "Расходник"}
                        </span>
                        <strong>{item.quantity}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedType === "payment" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Параметры оплаты</div>
                <div style={emptyStyle}>
                  Следующим шагом добавим выбор финансового счёта, дату оплаты и
                  сумму платежа.
                </div>
              </div>
            )}

            {selectedType === "invoice" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Данные накладной</div>
                <div style={emptyStyle}>
                  Следующим шагом добавим номер документа поставщика, дату,
                  файл/скан и комментарий.
                </div>
              </div>
            )}

            <div style={actionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>
                Отмена
              </button>

              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={creating}
                style={{
                  ...createButtonStyle,
                  opacity: creating ? 0.65 : 1,
                  cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Создаю..." : "Создать документ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10060,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(980px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 16,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
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

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 12,
  fontWeight: 700,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: 14,
};

const documentListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

function documentTypeButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: "#0f172a",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: 10,
    textAlign: "left",
    boxShadow: active ? "0 8px 18px rgba(37, 99, 235, 0.12)" : "none",
  };
}

const documentIconStyle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.2,
};

const documentTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
};

const documentSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  lineHeight: 1.35,
};

const detailsCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 14,
};

const detailsHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: 12,
  alignItems: "center",
};

const detailsIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const detailsTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
};

const detailsSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 3,
  lineHeight: 1.4,
};

const descriptionStyle: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.6,
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const itemsPreviewStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
};

const miniTableStyle: React.CSSProperties = {
  display: "grid",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  overflow: "hidden",
  background: "#ffffff",
};

const miniTableRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 14,
  color: "#64748b",
  background: "#ffffff",
  lineHeight: 1.5,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: 900,
};

const createButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: 900,
};
