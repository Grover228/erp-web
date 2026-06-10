import { CSSProperties, useState } from "react";

type DirectoriesPageProps = {
  onOpenDirectory: (directoryKey: string) => void;
};

type MainDirectoryGroup = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  softBg: string;
  items: {
    key: string;
    title: string;
    subtitle: string;
  }[];
};

export default function DirectoriesPage({
  onOpenDirectory,
}: DirectoriesPageProps) {
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  const groups: MainDirectoryGroup[] = [
    {
      key: "counterparties",
      title: "Контрагенты",
      subtitle: "Покупатели, поставщики, аренда",
      description:
        "Все люди и компании, с которыми работает производство: клиенты, поставщики, арендодатели, партнёры.",
      accent: "#2563eb",
      softBg: "#eff6ff",
      items: [
        {
          key: "counterparties",
          title: "Контрагенты",
          subtitle: "Покупатели, поставщики, арендодатели и партнёры",
        },
        {
          key: "employees",
          title: "Сотрудники",
          subtitle: "Персонал, роли, доступ и исполнители операций",
        },
      ],
    },
    {
      key: "nomenclature",
      title: "Номенклатура",
      subtitle: "Изделия, материалы, расходники",
      description:
        "Всё, что производится, закупается, хранится на складе и используется в техкартах.",
      accent: "#4f46e5",
      softBg: "#eef2ff",
      items: [
        {
          key: "products",
          title: "Изделия",
          subtitle: "Готовая продукция, которую производим и продаём",
        },
        {
          key: "resale-products",
          title: "Товары на перепродажу",
          subtitle: "Покупные товары, которые продаются без производства",
        },
        {
          key: "materials",
          title: "Материалы",
          subtitle: "Ткани, полотна, сырьё и основные материалы",
        },
        {
          key: "consumables",
          title: "Расходники",
          subtitle: "Нитки, бирки, упаковка, скотч и прочие расходники",
        },
        {
          key: "units",
          title: "Единицы измерения",
          subtitle: "Шт, м, кг, рулон и другие единицы учёта",
        },
        {
          key: "variants",
          title: "Цвета и размеры",
          subtitle: "Цветовые варианты, размеры и размерные сетки",
        },
        {
          key: "assets",
          title: "Имущество и оборудование",
          subtitle: "Станки, принтеры, инструменты, мебель и прочее имущество",
        },
      ],
    },
    {
      key: "production",
      title: "Производство",
      subtitle: "Операции и техкарты",
      description:
        "Базовые справочники, которые описывают процесс производства и используются в техкартах.",
      accent: "#d97706",
      softBg: "#fffbeb",
      items: [
        {
          key: "operations",
          title: "Операции",
          subtitle: "Крой, пошив, ВТО, контроль, упаковка и другие этапы",
        },
        {
          key: "products",
          title: "Изделия с техкартами",
          subtitle: "Временный вход к техкартам, пока они находятся в изделиях",
        },
      ],
    },
    {
      key: "statuses",
      title: "Статусы",
      subtitle: "Статусы заказов и процессов",
      description:
        "Сквозные статусы для заказов, производства, склада, документов и внутренних процессов.",
      accent: "#16a34a",
      softBg: "#f0fdf4",
      items: [
        {
          key: "statuses",
          title: "Статусы",
          subtitle: "Статусы заявок, заказов, производства и этапов",
        },
      ],
    },
  ];

  const activeGroup = groups.find((group) => group.key === activeGroupKey);

  const openDirectory = (directoryKey: string) => {
    setActiveGroupKey(null);
    onOpenDirectory(directoryKey);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>ERP справочники</div>
          <div style={styles.heroTitle}>Центр настройки системы</div>
          <div style={styles.heroText}>
            Все основные сущности собраны в 4 раздела. Внутри каждого раздела —
            нужные справочники без лишней простыни на экране.
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setActiveGroupKey(group.key)}
            style={{
              ...styles.mainCard,
              borderTop: `5px solid ${group.accent}`,
              background: `linear-gradient(180deg, #ffffff 0%, ${group.softBg} 100%)`,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "translateY(-4px)";
              event.currentTarget.style.boxShadow =
                "0 18px 36px rgba(15, 23, 42, 0.12)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow =
                "0 10px 24px rgba(15, 23, 42, 0.07)";
            }}
          >
            <div
              style={{
                ...styles.iconCircle,
                background: group.accent,
              }}
            >
              {group.title.slice(0, 1)}
            </div>

            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{group.title}</div>
              <div style={styles.cardSubtitle}>{group.subtitle}</div>
              <div style={styles.cardDescription}>{group.description}</div>
            </div>

            <div style={styles.cardFooter}>
              <span>Открыть раздел</span>
              <span style={styles.arrow}>→</span>
            </div>
          </button>
        ))}
      </div>

      {activeGroup && (
        <div style={styles.modalOverlay} onClick={() => setActiveGroupKey(null)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>{activeGroup.title}</div>
                <div style={styles.modalSubtitle}>{activeGroup.description}</div>
              </div>

              <button
                type="button"
                onClick={() => setActiveGroupKey(null)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.modalList}>
              {activeGroup.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openDirectory(item.key)}
                  style={styles.modalItem}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.transform = "translateX(3px)";
                    event.currentTarget.style.borderColor = activeGroup.accent;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "translateX(0)";
                    event.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                >
                  <div>
                    <div style={styles.modalItemTitle}>{item.title}</div>
                    <div style={styles.modalItemSubtitle}>{item.subtitle}</div>
                  </div>
                  <div
                    style={{
                      ...styles.modalItemArrow,
                      color: activeGroup.accent,
                    }}
                  >
                    →
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },

  hero: {
    background:
      "radial-gradient(circle at top left, #dbeafe 0%, transparent 32%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    borderRadius: 24,
    padding: "28px 30px",
    border: "1px solid #dbe4f0",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: 800,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 10,
  },

  heroText: {
    maxWidth: 760,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.65,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 18,
  },

  mainCard: {
    minHeight: 250,
    border: "1px solid #dbe4f0",
    borderRadius: 24,
    padding: 22,
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.07)",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    fontWeight: 800,
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.16)",
    marginBottom: 18,
  },

  cardContent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  cardTitle: {
    color: "#0f172a",
    fontSize: 23,
    fontWeight: 800,
  },

  cardSubtitle: {
    color: "#334155",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.45,
  },

  cardDescription: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
  },

  cardFooter: {
    marginTop: 22,
    paddingTop: 16,
    borderTop: "1px solid rgba(148, 163, 184, 0.35)",
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  arrow: {
    fontSize: 20,
    lineHeight: 1,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.42)",
    backdropFilter: "blur(5px)",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "min(620px, 100%)",
    background: "#ffffff",
    borderRadius: 26,
    padding: 22,
    border: "1px solid #e2e8f0",
    boxShadow: "0 28px 70px rgba(15, 23, 42, 0.25)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 18,
    paddingBottom: 18,
    borderBottom: "1px solid #e2e8f0",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  modalSubtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid #dbe4f0",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 26,
    lineHeight: "38px",
    cursor: "pointer",
  },

  modalList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  modalItem: {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    padding: "16px 18px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.18s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  modalItemTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 5,
  },

  modalItemSubtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.45,
  },

  modalItemArrow: {
    fontSize: 22,
    fontWeight: 800,
  },
};
