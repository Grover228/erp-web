import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import ReceiptModal, {
  type Color,
  type SupplierReceipt,
} from "./ReceiptModal";

function getStatusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "posted") return "Проведена";
  if (status === "cancelled") return "Отменена";
  return status || "—";
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<SupplierReceipt[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [selectedReceipt, setSelectedReceipt] =
    useState<SupplierReceipt | null>(null);

  const [loading, setLoading] = useState(false);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReceipts();
    loadDirectories();
  }, []);

  async function loadReceipts() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("supplier_receipts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReceipts((data as SupplierReceipt[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки поступлений",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDirectories() {
    try {
      setDirectoriesLoading(true);

      const { data, error } = await supabase
        .from("colors")
        .select("id, name, hex")
        .order("name", { ascending: true });

      if (error) throw error;

      setColors((data as Color[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки справочников",
      );
    } finally {
      setDirectoriesLoading(false);
    }
  }

  async function handleReceiptSaved() {
    setSelectedReceipt(null);
    await loadReceipts();
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={titleStyle}>Поступления</div>

          <div style={subtitleStyle}>
            Складские приёмки товаров и материалов от поставщиков.
          </div>
        </div>

        <button type="button" onClick={loadReceipts} style={refreshButtonStyle}>
          Обновить
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {directoriesLoading && (
        <div style={{ color: "#64748b", fontWeight: 700 }}>
          Загружаю справочники...
        </div>
      )}

      {loading ? (
        <div style={emptyStyle}>Загружаю поступления...</div>
      ) : receipts.length === 0 ? (
        <div style={emptyStyle}>Поступлений пока нет.</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Номер</th>
                <th style={thStyle}>Дата</th>
                <th style={thStyle}>Поставщик</th>
                <th style={thStyle}>Сумма</th>
                <th style={thStyle}>Статус</th>
              </tr>
            </thead>

            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(receipt)}
                      style={linkButtonStyle}
                    >
                      {receipt.receipt_number || "Черновик приёмки"}
                    </button>
                  </td>

                  <td style={tdStyle}>{receipt.receipt_date || "—"}</td>

                  <td style={tdStyle}>{receipt.supplier_name || "—"}</td>

                  <td style={tdStyle}>
                    {Number(receipt.total_amount || 0).toLocaleString(
                      "ru-RU",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}{" "}
                    ₽
                  </td>

                  <td style={tdStyle}>
                    <span style={statusBadgeStyle}>
                      {getStatusLabel(receipt.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          colors={colors}
          onClose={() => setSelectedReceipt(null)}
          onSaved={handleReceiptSaved}
        />
      )}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 20,
  border: "1px solid #dbe4f0",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 6,
  fontSize: 16,
};

const refreshButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
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

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  padding: 0,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  textDecoration: "underline",
};

const statusBadgeStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
};
