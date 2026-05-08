import { CSSProperties } from "react";

type StatusesDirectoryProps = {
  onOpenProcurement: () => void;
  onOpenWarehouse: () => void;
};

const modules = [
  {
    icon: "📦",
    title: "Закупки",
    description:
      "Статусы заказов поставщикам, поступлений и закупочных процессов.",
    color: "#2563eb",
    statuses: ["Черновик", "Заказан", "Частично получен", "Получен"],
  },
  {
    icon: "🏬",
    title: "Склад",
    description:
      "Движения склада, резервирование, списания и внутренние операции.",
    color: "#059669",
    statuses: ["Черновик", "Проведено", "Отменено"],
  },
  {
    icon: "🏭",
    title: "Производство",
    description:
      "Производственные этапы, запуск задач и контроль выполнения.",
    color: "#ea580c",
    statuses: ["Создано", "В работе", "Завершено"],
  },
  {
    icon: "🚚",
    title: "Отгрузки",
    description:
      "Статусы сборки, отгрузки, доставки и завершения отправок.",
    color: "#7c3aed",
    statuses: ["Сборка", "Отгружено", "Доставлено"],
  },
  {
    icon: "💰",
    title: "Финансы",
    description:
      "Финансовые документы, оплаты, задолженности и закрытие периодов.",
    color: "#dc2626",
    statuses: ["Ожидает оплаты", "Оплачено", "Просрочено"],
  },
  {
    icon: "🤝",
    title: "Сделки",
    description:
      "CRM-воронка, работа с клиентами и коммерческими предложениями.",
    color: "#0891b2",
    statuses: ["Новая", "Переговоры", "Успешно"],
  },
];

export default function StatusesDirectory({
  onOpenProcurement,
  onOpenWarehouse,
}: StatusesDirectoryProps) {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>

        <h1 style={styles.heroTitle}>
          Статусы и бизнес-процессы
        </h1>

        <div style={styles.heroText}>
          Настройка workflow, переходов статусов и логики
          работы ERP-системы.
        </div>
      </div>

      <div style={styles.grid}>
        {modules.map((module) => (
          <button
            key={module.title}
            style={{
              ...styles.card,
              borderTop: `5px solid ${module.color}`,
            }}
            onClick={() => {
                      if (module.title === "Закупки") {
                        onOpenProcurement();
                        return;
                      }

                      if (module.title === "Склад") {
                        onOpenWarehouse();
                      }
                    }}
          >
            <div style={styles.cardHeader}>
              <div
                style={{
                  ...styles.iconWrap,
                  background: `${module.color}15`,
                }}
              >
                <span style={styles.icon}>{module.icon}</span>
              </div>

              <div>
                <div style={styles.cardTitle}>
                  {module.title}
                </div>

                <div style={styles.cardDescription}>
                  {module.description}
                </div>
              </div>
            </div>

            <div style={styles.statusesBlock}>
              {module.statuses.map((status) => (
                <div
                  key={status}
                  style={styles.statusTag}
                >
                  {status}
                </div>
              ))}
            </div>

            <div style={styles.footer}>
              <span style={styles.footerText}>
                Открыть настройки
              </span>

              <span style={styles.arrow}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },

  hero: {
    background: "#ffffff",
    borderRadius: 28,
    padding: 36,
    border: "1px solid #dbe4f0",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },

  heroTitle: {
    margin: 0,
    fontSize: 52,
    lineHeight: 1,
    fontWeight: 900,
    color: "#0f172a",
  },

  heroText: {
    marginTop: 18,
    maxWidth: 760,
    color: "#64748b",
    fontSize: 20,
    lineHeight: 1.7,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 22,
  },

  card: {
    border: "1px solid #dbe4f0",
    borderRadius: 24,
    background: "#ffffff",
    padding: 24,
    cursor: "pointer",
    textAlign: "left",
    transition: "0.2s",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  },

  cardHeader: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
  },

  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  icon: {
    fontSize: 30,
  },

  cardTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },

  cardDescription: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.7,
  },

  statusesBlock: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
  },

  statusTag: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#334155",
    fontSize: 14,
    fontWeight: 700,
  },

  footer: {
    marginTop: 28,
    paddingTop: 18,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerText: {
    fontWeight: 700,
    color: "#0f172a",
  },

  arrow: {
    fontSize: 22,
    color: "#64748b",
  },
};