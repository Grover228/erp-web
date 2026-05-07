import { useState } from "react";
import PurchasesPage from "./PurchasesPage";
import ReceiptsPage from "./warehouse/ReceiptsPage";

type WarehouseTab = "purchases" | "receipts" | "stock" | "shipments";

const tabs: {
  key: WarehouseTab;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    key: "purchases",
    title: "Закупки",
    subtitle: "Заказы поставщикам и связанные документы",
    icon: "📄",
  },
  {
    key: "receipts",
    title: "Поступления",
    subtitle: "Приёмки товаров и материалов на склад",
    icon: "📦",
  },
  {
    key: "stock",
    title: "Остатки",
    subtitle: "Текущие складские остатки",
    icon: "📊",
  },
  {
    key: "shipments",
    title: "Продажи / Отгрузки",
    subtitle: "Отгрузки покупателям и списание остатков",
    icon: "🚚",
  },
];

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>("purchases");

  return (
    <div style={pageStyle}>
      <div style={tabsGridStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={warehouseTabStyle(activeTab === tab.key)}
          >
            <span style={tabIconStyle}>{tab.icon}</span>

            <span style={tabTextWrapStyle}>
              <span style={tabTitleStyle}>{tab.title}</span>
              <span style={tabSubtitleStyle}>{tab.subtitle}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={contentStyle}>
        {activeTab === "purchases" && <PurchasesPage />}

        {activeTab === "receipts" && <ReceiptsPage />}

        {activeTab === "stock" && (
          <WarehouseStub
            title="Остатки"
            subtitle="Здесь будет складская ведомость: материалы, расходники, остатки, резервы и движения."
            icon="📊"
          />
        )}

        {activeTab === "shipments" && (
          <WarehouseStub
            title="Продажи / Отгрузки"
            subtitle="Здесь будут заказы покупателей, отгрузки и списание остатков со склада."
            icon="🚚"
          />
        )}
      </div>
    </div>
  );
}

function WarehouseStub({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div style={stubStyle}>
      <div style={stubIconStyle}>{icon}</div>
      <div style={stubTitleStyle}>{title}</div>
      <div style={stubSubtitleStyle}>{subtitle}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const tabsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

function warehouseTabStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#334155",
    borderRadius: 18,
    padding: 16,
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "36px 1fr",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    boxShadow: active ? "0 10px 22px rgba(37, 99, 235, 0.14)" : "none",
  };
}

const tabIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
};

const tabTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
};

const tabTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const tabSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.35,
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const stubStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 28,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  textAlign: "center",
  minHeight: 260,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const stubIconStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
};

const stubTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 24,
  fontWeight: 900,
};

const stubSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  maxWidth: 620,
  lineHeight: 1.6,
};
