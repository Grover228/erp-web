import { useMemo, useState } from "react";

type ProductionTab = "jobs" | "active" | "techcards";

type Job = {
  id: string;
  product: string;
  issuedAt: string;
  elapsed: string;
  qty: number;
  completed: number;
  status: string;
  operations: {
    name: string;
    done: number;
    total: number;
  }[];
};

function getProgress(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#dcfce7",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: "#16a34a",
          borderRadius: 999,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

export default function Production() {
  const [tab, setTab] = useState<ProductionTab>("jobs");

  const jobs: Job[] = useMemo(
    () => [
      {
        id: "PR-001",
        product: "Шапка бини",
        issuedAt: "08.04.2026 09:20",
        elapsed: "12 ч 10 мин",
        qty: 100,
        completed: 45,
        status: "В работе",
        operations: [
          { name: "Раскрой", done: 100, total: 100 },
          { name: "Пошив", done: 60, total: 100 },
          { name: "Упаковка", done: 45, total: 100 },
        ],
      },
      {
        id: "PR-002",
        product: "Худи базовое",
        issuedAt: "08.04.2026 11:40",
        elapsed: "9 ч 50 мин",
        qty: 50,
        completed: 10,
        status: "В работе",
        operations: [
          { name: "Раскрой", done: 20, total: 50 },
          { name: "Пошив", done: 10, total: 50 },
          { name: "Упаковка", done: 0, total: 50 },
        ],
      },
      {
        id: "PR-003",
        product: "Шапка флисовая",
        issuedAt: "07.04.2026 16:00",
        elapsed: "1 д 5 ч",
        qty: 70,
        completed: 70,
        status: "Готово",
        operations: [
          { name: "Раскрой", done: 70, total: 70 },
          { name: "Пошив", done: 70, total: 70 },
          { name: "Упаковка", done: 70, total: 70 },
        ],
      },
    ],
    []
  );

  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({
    "PR-001": true,
    "PR-002": false,
    "PR-003": false,
  });

  const active = [
    {
      id: "ST-101",
      name: "Стопка №101",
      product: "Шапка бини",
      worker: "Айгуль",
      operation: "Пошив",
    },
    {
      id: "ST-102",
      name: "Стопка №102",
      product: "Худи базовое",
      worker: "Марина",
      operation: "Раскрой",
    },
  ];

  const techcards = [
    { id: "TC-001", name: "Шапка бини", operations: 4, materials: 2 },
    { id: "TC-002", name: "Худи базовое", operations: 7, materials: 5 },
    { id: "TC-003", name: "Шапка флисовая", operations: 5, materials: 3 },
  ];

  function toggleJob(jobId: string) {
    setOpenJobs((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  }

  function collapseAllJobs() {
    const next: Record<string, boolean> = {};
    jobs.forEach((job) => {
      next[job.id] = false;
    });
    setOpenJobs(next);
  }

  function expandAllJobs() {
    const next: Record<string, boolean> = {};
    jobs.forEach((job) => {
      next[job.id] = true;
    });
    setOpenJobs(next);
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setTab("jobs")} style={tabButtonStyle(tab === "jobs")}>
          Задания
        </button>

        <button onClick={() => setTab("active")} style={tabButtonStyle(tab === "active")}>
          В работе
        </button>

        <button
          onClick={() => setTab("techcards")}
          style={tabButtonStyle(tab === "techcards")}
        >
          Техкарты
        </button>
      </div>

      {tab === "jobs" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
                Задания в производство
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                Список заданий с прогрессом и деталями выполнения
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={expandAllJobs}
                style={secondaryBlueButtonStyle()}
              >
                Развернуть все
              </button>

              <button
                onClick={collapseAllJobs}
                style={secondaryBlueButtonStyle()}
              >
                Свернуть все
              </button>

              <button
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                + Создать задание
              </button>
            </div>
          </div>

          {jobs.map((job) => {
            const progress = getProgress(job.completed, job.qty);
            const isOpen = !!openJobs[job.id];

            return (
              <div
                key={job.id}
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 16,
                  background: "#ffffff",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => toggleJob(job.id)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {job.product}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      {job.id} · {job.status} · {progress}%
                    </div>
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 18,
                      color: "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    {isOpen ? "▲" : "▼"}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px 16px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          background: "#eff6ff",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Выдано</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
                          {job.issuedAt}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#eff6ff",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#6b7280" }}>В работе</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
                          {job.elapsed}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#eff6ff",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Сделано</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
                          {job.completed} / {job.qty} шт
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#eff6ff",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Прогресс</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
                          {progress}%
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          fontSize: 14,
                          color: "#374151",
                        }}
                      >
                        <span>Общий прогресс задания</span>
                        <span>{progress}%</span>
                      </div>

                      <ProgressBar value={progress} />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: 10,
                        }}
                      >
                        Операции
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {job.operations.map((operation) => {
                          const operationProgress = getProgress(
                            operation.done,
                            operation.total
                          );

                          return (
                            <div
                              key={operation.name}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  marginBottom: 8,
                                  fontSize: 14,
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "#111827" }}>
                                  {operation.name}
                                </span>
                                <span style={{ color: "#4b5563" }}>
                                  {operation.done} / {operation.total}
                                </span>
                              </div>

                              <ProgressBar value={operationProgress} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Открыть задание
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "active" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              В работе
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              Здесь видно, что сейчас находится в производственном процессе
            </div>
          </div>

          {active.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                {item.name}
              </div>
              <div style={{ fontSize: 14, color: "#4b5563", marginTop: 8 }}>
                Изделие: {item.product}
              </div>
              <div style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
                Операция: {item.operation}
              </div>
              <div style={{ fontSize: 14, color: "#4b5563", marginTop: 4 }}>
                Сотрудник: {item.worker}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "techcards" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
                Технологические карты
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                Правила производства для изделий
              </div>
            </div>

            <button
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              + Создать техкарту
            </button>
          </div>

          {techcards.map((card) => (
            <div
              key={card.id}
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    {card.id}
                  </div>
                </div>

                <button
                  style={{
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Открыть
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 14, color: "#4b5563" }}>
                Операций: {card.operations}
              </div>
              <div style={{ marginTop: 4, fontSize: 14, color: "#4b5563" }}>
                Материалов: {card.materials}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#2563eb" : "#eff6ff",
    color: active ? "#fff" : "#1d4ed8",
    border: active ? "1px solid #2563eb" : "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

function secondaryBlueButtonStyle(): React.CSSProperties {
  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}