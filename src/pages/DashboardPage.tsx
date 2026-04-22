type DirectoriesPageProps = {
  onOpenDirectory: (directoryKey: string) => void;
};

type DirectoryCard = {
  key: string;
  title: string;
  subtitle: string;
  accent: string;
  bg: string;
};

type DirectoryGroup = {
  title: string;
  subtitle: string;
  borderColor: string;
  headerColor: string;
  softBg: string;
  items: DirectoryCard[];
};

export default function DirectoriesPage({
  onOpenDirectory,
}: DirectoriesPageProps) {
  const groups: DirectoryGroup[] = [
    {
      title: "Люди и компании",
      subtitle: "Все, кто работает с производством, закупками и заказами",
      borderColor: "#bfdbfe",
      headerColor: "#1d4ed8",
      softBg: "#eff6ff",
      items: [
        {
          key: "employees",
          title: "Сотрудники",
          subtitle: "Персонал, роли, доступ, входящие заявки",
          accent: "#2563eb",
          bg: "#f8fbff",
        },
        {
          key: "suppliers",
          title: "Поставщики",
          subtitle: "Поставщики тканей, фурнитуры и услуг",
          accent: "#2563eb",
          bg: "#f8fbff",
        },
        {
          key: "counterparties",
          title: "Контрагенты",
          subtitle: "Клиенты, заказчики и партнёры",
          accent: "#2563eb",
          bg: "#f8fbff",
        },
      ],
    },
    {
      title: "Номенклатура",
      subtitle: "Что мы производим, закупаем и используем в работе",
      borderColor: "#c7d2fe",
      headerColor: "#4338ca",
      softBg: "#eef2ff",
      items: [
        {
          key: "products",
          title: "Изделия",
          subtitle: "То, что производим и продаём",
          accent: "#4f46e5",
          bg: "#fafaff",
        },
        {
          key: "materials",
          title: "Материалы",
          subtitle: "Ткани, полотна, сырьё",
          accent: "#4f46e5",
          bg: "#fafaff",
        },
        {
          key: "consumables",
          title: "Расходники",
          subtitle: "Упаковка, бирки, нитки, скотч",
          accent: "#4f46e5",
          bg: "#fafaff",
        },
      ],
    },
    {
      title: "Производство",
      subtitle: "Справочники, которые описывают сам процесс работы",
      borderColor: "#fde68a",
      headerColor: "#b45309",
      softBg: "#fffbeb",
      items: [
        {
          key: "operations",
          title: "Операции",
          subtitle: "Крой, пошив, ВТО, упаковка",
          accent: "#d97706",
          bg: "#fffdf7",
        },
        {
          key: "variants",
          title: "Цвета и размеры",
          subtitle: "Размерные ряды и цветовые варианты",
          accent: "#d97706",
          bg: "#fffdf7",
        },
      ],
    },
    {
      title: "Общие справочники",
      subtitle: "Сквозные справочники, которые используются во всей ERP",
      borderColor: "#bbf7d0",
      headerColor: "#15803d",
      softBg: "#f0fdf4",
      items: [
        {
          key: "units",
          title: "Единицы измерения",
          subtitle: "Шт, м, кг, рулон и другие",
          accent: "#16a34a",
          bg: "#f8fff9",
        },
        {
          key: "statuses",
          title: "Статусы",
          subtitle: "Статусы заявок, заказов и этапов",
          accent: "#16a34a",
          bg: "#f8fff9",
        },
      ],
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          borderRadius: 20,
          padding: 22,
          border: "1px solid #dbe4f0",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Справочники
        </div>

        <div
          style={{
            color: "#64748b",
            lineHeight: 1.6,
            fontSize: 15,
            textAlign: "center",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          Выбери нужный справочник. Все основные сущности ERP будут
          настраиваться отсюда. Позже здесь можно будет добавить новые
          справочники по мере развития системы.
        </div>
      </div>

      {groups.map((group) => (
        <div
          key={group.title}
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 18,
            border: `1px solid ${group.borderColor}`,
            boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div
            style={{
              background: group.softBg,
              border: `1px solid ${group.borderColor}`,
              borderRadius: 16,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: group.headerColor,
                marginBottom: 6,
              }}
            >
              {group.title}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {group.subtitle}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {group.items.map((item) => (
              <button
                key={item.key}
                onClick={() => onOpenDirectory(item.key)}
                style={{
                  border: "1px solid #dbe4f0",
                  borderLeft: `5px solid ${item.accent}`,
                  borderRadius: 16,
                  background: item.bg,
                  padding: 16,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 6px 16px rgba(15, 23, 42, 0.04)",
                  transition: "transform 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 8,
                  }}
                >
                  {item.title}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#64748b",
                    lineHeight: 1.55,
                  }}
                >
                  {item.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}