import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../supabase";

type StatusCategory = {
  id: string;
  code: string;
  name: string;
};

type StatusKind = "initial" | "intermediate" | "final";

type StatusItem = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  is_initial: boolean | null;
  is_final: boolean | null;
  is_active?: boolean | null;
};

type WorkflowBlock = {
  categoryCode: string;
  icon: string;
  title: string;
  subtitle: string;
};

const workflowBlocks: WorkflowBlock[] = [
  {
    categoryCode: "supplier_orders",
    icon: "📦",
    title: "Заказы поставщикам",
    subtitle: "Workflow заказов поставщикам",
  },
  {
    categoryCode: "receipts",
    icon: "📥",
    title: "Поступления",
    subtitle: "Workflow складских приёмок",
  },
];

const descriptions: Record<string, string> = {
  draft: "Документ создан, но ещё не проведён и не влияет на склад.",
  ordered: "Заказ отправлен поставщику и ожидается поставка.",
  partially_received: "Поступила только часть материалов по заказу.",
  received: "Все материалы поступили на склад.",
  posted: "Материалы оприходованы на склад.",
  cancelled: "Документ отменён.",
};

function getStatusKind(status: StatusItem): StatusKind {
  if (status.is_initial) return "initial";
  if (status.is_final) return "final";
  return "intermediate";
}

function getStatusKindLabel(status: StatusItem) {
  const kind = getStatusKind(status);

  if (kind === "initial") return "Начальный";
  if (kind === "final") return "Конечный";

  return "Промежуточный";
}

function getDescription(status: StatusItem) {
  return descriptions[status.code] || "Пользовательский статус workflow.";
}

function getDisplayOrder(status: StatusItem, index?: number) {
  if (status.sort_order && status.sort_order > 0) return status.sort_order;
  if (typeof index === "number") return index + 1;
  return 0;
}

export default function ProcurementStatusesPage() {
  const [categories, setCategories] = useState<StatusCategory[]>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [activeTab, setActiveTab] = useState("supplier_orders");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedStatus, setSelectedStatus] = useState<StatusItem | null>(null);
  const [selectedStatusIndex, setSelectedStatusIndex] = useState<number>(0);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createCategoryCode, setCreateCategoryCode] = useState("");

  const [editingStatus, setEditingStatus] = useState<StatusItem | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [statusColor, setStatusColor] = useState("#2563eb");
  const [statusKind, setStatusKind] = useState<StatusKind>("intermediate");
  const [statusSortOrder, setStatusSortOrder] = useState(1);

  async function loadStatuses() {
    setLoading(true);
    setError("");

    const { data: categoryData, error: categoryError } = await supabase
      .from("status_categories")
      .select("id, code, name");

    if (categoryError) {
      setError(categoryError.message);
      setLoading(false);
      return;
    }

    const { data: statusData, error: statusError } = await supabase
      .from("statuses")
      .select("*")
      .order("sort_order", { ascending: true });

    if (statusError) {
      setError(statusError.message);
      setLoading(false);
      return;
    }

    setCategories(categoryData || []);
    setStatuses((statusData as StatusItem[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadStatuses();
  }, []);

  const statusesByCategory = useMemo(() => {
    const result: Record<string, StatusItem[]> = {};

    workflowBlocks.forEach((block) => {
      const category = categories.find((item) => item.code === block.categoryCode);

      const dbStatuses = statuses
        .filter(
          (item) =>
            item.category_id === category?.id && item.is_active !== false
        )
        .sort((a, b) => {
          const orderA = a.sort_order && a.sort_order > 0 ? a.sort_order : 999;
          const orderB = b.sort_order && b.sort_order > 0 ? b.sort_order : 999;
          return orderA - orderB || a.name.localeCompare(b.name);
        });

      result[block.categoryCode] = dbStatuses;
    });

    return result;
  }, [categories, statuses]);

  function getCategoryId(categoryCode: string) {
    return categories.find((item) => item.code === categoryCode)?.id || "";
  }

  function openStatus(status: StatusItem, index: number, categoryCode: string) {
    setSelectedStatus(status);
    setSelectedStatusIndex(index);
    setSelectedCategoryCode(categoryCode);
    setEditingStatus(null);
    setMessage("");
    setError("");
  }

  function startEdit(status: StatusItem) {
    setEditingStatus(status);
    setStatusName(status.name || "");
    setStatusCode(status.code || "");
    setStatusColor(status.color || "#2563eb");
    setStatusKind(getStatusKind(status));
    setStatusSortOrder(getDisplayOrder(status, selectedStatusIndex));
  }

  function openCreate(categoryCode: string) {
    const currentStatuses = statusesByCategory[categoryCode] || [];

    setCreateCategoryCode(categoryCode);
    setStatusName("");
    setStatusCode("");
    setStatusColor("#2563eb");
    setStatusKind("intermediate");
    setStatusSortOrder(currentStatuses.length + 1);
    setEditingStatus(null);
    setIsCreateOpen(true);
    setMessage("");
    setError("");
  }

  async function createStatus() {
    const categoryId = getCategoryId(createCategoryCode);

    if (!categoryId) {
      setError("Категория статусов не найдена");
      return;
    }

    if (!statusName.trim() || !statusCode.trim()) {
      setError("Заполни название и код статуса");
      return;
    }

    const payload = {
      category_id: categoryId,
      name: statusName.trim(),
      code: statusCode.trim(),
      color: statusColor,
      sort_order: statusSortOrder,
      is_initial: statusKind === "initial",
      is_final: statusKind === "final",
      is_active: true,
    };

    const { error: insertError } = await supabase.from("statuses").insert(payload);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setIsCreateOpen(false);
    setMessage("Статус создан.");
    await loadStatuses();
  }

  async function saveStatus() {
    if (!editingStatus || !selectedStatus) return;

    setError("");
    setMessage("");

    const payload = {
      name: statusName.trim(),
      code: statusCode.trim(),
      color: statusColor,
      sort_order: statusSortOrder,
      is_initial: statusKind === "initial",
      is_final: statusKind === "final",
    };

    const { error: updateError } = await supabase
      .from("statuses")
      .update(payload)
      .eq("id", editingStatus.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedStatus = {
      ...editingStatus,
      ...payload,
    };

    setStatuses((prev) =>
      prev.map((item) => (item.id === editingStatus.id ? updatedStatus : item))
    );

    setSelectedStatus(updatedStatus);
    setEditingStatus(null);
    setMessage("Статус обновлён.");
  }


  async function moveStatus(
    categoryCode: string,
    currentIndex: number,
    direction: "up" | "down"
  ) {
    const currentStatuses = statusesByCategory[categoryCode] || [];
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= currentStatuses.length) return;

    const currentStatus = currentStatuses[currentIndex];
    const targetStatus = currentStatuses[targetIndex];

    const currentOrder = getDisplayOrder(currentStatus, currentIndex);
    const targetOrder = getDisplayOrder(targetStatus, targetIndex);

    setError("");
    setMessage("");

    const { error: firstError } = await supabase
      .from("statuses")
      .update({ sort_order: targetOrder })
      .eq("id", currentStatus.id);

    if (firstError) {
      setError(firstError.message);
      return;
    }

    const { error: secondError } = await supabase
      .from("statuses")
      .update({ sort_order: currentOrder })
      .eq("id", targetStatus.id);

    if (secondError) {
      setError(secondError.message);
      return;
    }

    setStatuses((prev) =>
      prev.map((item) => {
        if (item.id === currentStatus.id) {
          return { ...item, sort_order: targetOrder };
        }

        if (item.id === targetStatus.id) {
          return { ...item, sort_order: currentOrder };
        }

        return item;
      })
    );
  }

  async function deleteStatus() {
    if (!selectedStatus) return;

    const confirmed = window.confirm(`Удалить статус "${selectedStatus.name}"?`);

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("statuses")
      .delete()
      .eq("id", selectedStatus.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setStatuses((prev) => prev.filter((item) => item.id !== selectedStatus.id));
    setSelectedStatus(null);
    setEditingStatus(null);
    setMessage("Статус удалён.");
  }

  function closeModal() {
    setSelectedStatus(null);
    setEditingStatus(null);
    setMessage("");
    setError("");
  }

  return (
    <div style={styles.page}>
      {(message || error) && (
        <div
          style={{
            ...styles.notice,
            background: error ? "#fef2f2" : "#dcfce7",
            borderColor: error ? "#fecaca" : "#86efac",
            color: error ? "#991b1b" : "#166534",
          }}
        >
          {error || message}
        </div>
      )}

      {loading && <div style={styles.notice}>Загрузка статусов...</div>}

      <div style={styles.tabsCard}>
        {workflowBlocks.map((block) => (
          <button
            key={block.categoryCode}
            style={{
              ...styles.tabButton,
              ...(activeTab === block.categoryCode ? styles.activeTabButton : {}),
            }}
            onClick={() => setActiveTab(block.categoryCode)}
          >
            <span style={styles.tabIcon}>{block.icon}</span>
            {block.title}
          </button>
        ))}
      </div>

      {workflowBlocks
        .filter((block) => block.categoryCode === activeTab)
        .map((block) => (
          <WorkflowColumn
            key={block.categoryCode}
            icon={block.icon}
            title={block.title}
            subtitle={block.subtitle}
            statuses={statusesByCategory[block.categoryCode] || []}
            categoryCode={block.categoryCode}
            onOpenStatus={openStatus}
            onCreateStatus={openCreate}
            onMoveStatus={moveStatus}
          />
        ))}

      {selectedStatus && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Карточка статуса</div>
                <div style={styles.modalSubtitle}>{selectedStatus.name}</div>
              </div>

              <button style={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>

            {!editingStatus && (
              <>
                <div style={styles.infoGrid}>
                  <Info label="Название" value={selectedStatus.name} />
                  <Info label="Код" value={selectedStatus.code} />
                  <Info label="Тип статуса" value={getStatusKindLabel(selectedStatus)} />
                  <Info
                    label="Порядок"
                    value={String(getDisplayOrder(selectedStatus, selectedStatusIndex))}
                  />
                  <Info
                    label="Активность"
                    value={selectedStatus.is_active === false ? "Выключен" : "Активен"}
                  />
                </div>

                <div style={styles.colorPreviewRow}>
                  <span style={styles.colorPreviewLabel}>Цвет статуса:</span>
                  <span
                    style={{
                      ...styles.colorPreview,
                      background: selectedStatus.color || "#94a3b8",
                    }}
                  />
                  <span>{selectedStatus.color || "#94a3b8"}</span>
                </div>

                <div style={styles.descriptionBox}>
                  <b>Описание:</b> {getDescription(selectedStatus)}
                </div>

                <div style={styles.modalActions}>
                  <button
                    style={styles.primaryButton}
                    onClick={() => startEdit(selectedStatus)}
                  >
                    Редактировать
                  </button>

                  <button style={styles.dangerButton} onClick={deleteStatus}>
                    Удалить статус
                  </button>

                  <button style={styles.secondaryButton} onClick={closeModal}>
                    Закрыть
                  </button>
                </div>
              </>
            )}

            {editingStatus && (
              <>
                <div style={styles.formGrid}>
                  <Field label="Название">
                    <input
                      style={styles.input}
                      value={statusName}
                      onChange={(event) => setStatusName(event.target.value)}
                    />
                  </Field>

                  <Field label="Код">
                    <input
                      style={styles.input}
                      value={statusCode}
                      onChange={(event) => setStatusCode(event.target.value)}
                    />
                  </Field>

                  <Field label="Цвет">
                    <input
                      type="color"
                      style={styles.input}
                      value={statusColor}
                      onChange={(event) => setStatusColor(event.target.value)}
                    />
                  </Field>

                  <Field label="Порядок">
                    <input
                      type="number"
                      min={1}
                      style={styles.input}
                      value={statusSortOrder}
                      onChange={(event) =>
                        setStatusSortOrder(Number(event.target.value))
                      }
                    />
                  </Field>

                  <Field label="Тип статуса">
                    <select
                      style={styles.input}
                      value={statusKind}
                      onChange={(event) =>
                        setStatusKind(event.target.value as StatusKind)
                      }
                    >
                      <option value="initial">Начальный</option>
                      <option value="intermediate">Промежуточный</option>
                      <option value="final">Конечный</option>
                    </select>
                  </Field>
                </div>

                <div style={styles.modalActions}>
                  <button
                    style={styles.secondaryButton}
                    onClick={() => setEditingStatus(null)}
                  >
                    Отмена
                  </button>

                  <button style={styles.primaryButton} onClick={saveStatus}>
                    Сохранить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Новый статус</div>
                <div style={styles.modalSubtitle}>Добавление статуса в workflow</div>
              </div>

              <button style={styles.closeButton} onClick={() => setIsCreateOpen(false)}>
                ×
              </button>
            </div>

            <div style={styles.formGrid}>
              <Field label="Название">
                <input
                  style={styles.input}
                  value={statusName}
                  onChange={(event) => setStatusName(event.target.value)}
                />
              </Field>

              <Field label="Код">
                <input
                  style={styles.input}
                  value={statusCode}
                  onChange={(event) => setStatusCode(event.target.value)}
                  placeholder="not_paid"
                />
              </Field>

              <Field label="Цвет">
                <input
                  type="color"
                  style={styles.input}
                  value={statusColor}
                  onChange={(event) => setStatusColor(event.target.value)}
                />
              </Field>

              <Field label="Порядок">
                <input
                  type="number"
                  min={1}
                  style={styles.input}
                  value={statusSortOrder}
                  onChange={(event) =>
                    setStatusSortOrder(Number(event.target.value))
                  }
                />
              </Field>

              <Field label="Тип статуса">
                <select
                  style={styles.input}
                  value={statusKind}
                  onChange={(event) =>
                    setStatusKind(event.target.value as StatusKind)
                  }
                >
                  <option value="initial">Начальный</option>
                  <option value="intermediate">Промежуточный</option>
                  <option value="final">Конечный</option>
                </select>
              </Field>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.secondaryButton}
                onClick={() => setIsCreateOpen(false)}
              >
                Отмена
              </button>

              <button style={styles.primaryButton} onClick={createStatus}>
                Добавить статус
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowColumn({
  icon,
  title,
  subtitle,
  statuses,
  categoryCode,
  onOpenStatus,
  onCreateStatus,
  onMoveStatus,
}: {
  icon: string;
  title: string;
  subtitle: string;
  statuses: StatusItem[];
  categoryCode: string;
  onOpenStatus: (status: StatusItem, index: number, categoryCode: string) => void;
  onCreateStatus: (categoryCode: string) => void;
  onMoveStatus: (
    categoryCode: string,
    currentIndex: number,
    direction: "up" | "down"
  ) => void;
}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleRow}>
          <div style={styles.sectionIcon}>{icon}</div>

          <div>
            <div style={styles.sectionTitle}>{title}</div>
            <div style={styles.sectionText}>{subtitle}</div>
          </div>
        </div>

        <button style={styles.button} onClick={() => onCreateStatus(categoryCode)}>
          + Новый статус
        </button>
      </div>

      <div style={styles.statusList}>
        {statuses.map((status, index) => (
          <div key={status.id} style={styles.statusWrap}>
            <div
              style={{
                ...styles.statusCard,
                borderLeft: `6px solid ${status.color || "#94a3b8"}`,
              }}
              onClick={() => onOpenStatus(status, index, categoryCode)}
            >
              <div style={styles.statusHeader}>
                <div
                  style={{
                    ...styles.colorDot,
                    background: status.color || "#94a3b8",
                  }}
                />

                <div>
                  <div style={styles.statusName}>{status.name}</div>
                  <div style={styles.statusCode}>{status.code}</div>
                </div>
              </div>

              <div style={styles.statusMetaRow}>
                <span style={styles.orderBadge}>
                  № {getDisplayOrder(status, index)}
                </span>

                <span
                  style={{
                    ...styles.typeBadge,
                    background: status.is_initial
                      ? "#eff6ff"
                      : status.is_final
                      ? "#dcfce7"
                      : "#f1f5f9",
                    color: status.is_initial
                      ? "#1d4ed8"
                      : status.is_final
                      ? "#166534"
                      : "#334155",
                  }}
                >
                  {getStatusKindLabel(status)}
                </span>
              </div>

              <div style={styles.statusBottomRow}>
                <div style={styles.statusDescription}>{getDescription(status)}</div>

                <div style={styles.orderActions} onClick={(event) => event.stopPropagation()}>
                  <button
                    style={{
                      ...styles.orderButton,
                      opacity: index === 0 ? 0.35 : 1,
                      cursor: index === 0 ? "default" : "pointer",
                    }}
                    disabled={index === 0}
                    onClick={() => onMoveStatus(categoryCode, index, "up")}
                    title="Поднять выше"
                  >
                    ↑
                  </button>

                  <button
                    style={{
                      ...styles.orderButton,
                      opacity: index === statuses.length - 1 ? 0.35 : 1,
                      cursor: index === statuses.length - 1 ? "default" : "pointer",
                    }}
                    disabled={index === statuses.length - 1}
                    onClick={() => onMoveStatus(categoryCode, index, "down")}
                    title="Опустить ниже"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>

            {index !== statuses.length - 1 && (
              <div style={styles.connector}>
                <div style={styles.connectorLine} />
                <div style={styles.connectorArrow}>↓</div>
              </div>
            )}
          </div>
        ))}

        {statuses.length === 0 && (
          <div style={styles.emptyBox}>Статусы пока не добавлены</div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <div style={styles.label}>{label}</div>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  notice: {
    border: "1px solid #dbe4f0",
    borderRadius: 18,
    padding: 16,
    background: "#ffffff",
    color: "#475569",
    fontWeight: 700,
  },

  tabsCard: {
    display: "flex",
    gap: 12,
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 22,
    padding: 14,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  tabButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    background: "#ffffff",
    color: "#0f172a",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  },

  activeTabButton: {
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#4f46e5)",
    color: "#ffffff",
    boxShadow: "0 10px 22px rgba(37,99,235,0.22)",
  },

  tabIcon: {
    fontSize: 22,
  },

  section: {
    background: "#ffffff",
    borderRadius: 24,
    border: "1px solid #dbe4f0",
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
    minHeight: 520,
    width: "100%",
    boxSizing: "border-box",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 22,
  },

  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  sectionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
  },

  sectionTitle: {
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
  },

  sectionText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 15,
  },

  button: {
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    background: "linear-gradient(135deg,#2563eb,#4f46e5)",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  statusList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  statusWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  statusCard: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid #dbe4f0",
    padding: 18,
    background: "#ffffff",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
  },

  statusHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  colorDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
    flexShrink: 0,
  },

  statusName: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },

  statusCode: {
    marginTop: 4,
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 13,
  },

  statusMetaRow: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },

  orderBadge: {
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 800,
    fontSize: 13,
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
  },

  typeBadge: {
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 800,
    fontSize: 13,
  },

  statusBottomRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },

  statusDescription: {
    color: "#64748b",
    lineHeight: 1.55,
    fontSize: 15,
    flex: 1,
  },

  orderActions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },

  orderButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "none",
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
    lineHeight: 1,
  },

  connector: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: 42,
    marginTop: 6,
    marginBottom: 2,
  },

  connectorLine: {
    width: 2,
    flex: 1,
    background: "#cbd5e1",
    borderRadius: 999,
  },

  connectorArrow: {
    fontSize: 18,
    color: "#94a3b8",
    lineHeight: 1,
    marginTop: -2,
  },

  emptyBox: {
    padding: 20,
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    color: "#64748b",
    textAlign: "center",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "min(900px, 96vw)",
    background: "#ffffff",
    borderRadius: 26,
    padding: 24,
    boxShadow: "0 26px 70px rgba(15,23,42,0.28)",
    border: "1px solid #dbe4f0",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },

  modalSubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 16,
  },

  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 24,
    fontWeight: 800,
    cursor: "pointer",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
  },

  infoBox: {
    background: "#f8fbff",
    border: "1px solid #dbe4f0",
    borderRadius: 16,
    padding: 14,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 8,
  },

  infoValue: {
    color: "#0f172a",
    fontWeight: 900,
  },

  colorPreviewRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#475569",
  },

  colorPreviewLabel: {
    fontWeight: 800,
    color: "#0f172a",
  },

  colorPreview: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-block",
  },

  descriptionBox: {
    marginTop: 14,
    border: "1px solid #dbe4f0",
    borderRadius: 16,
    padding: 14,
    background: "#f8fbff",
    color: "#475569",
    lineHeight: 1.6,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },

  label: {
    color: "#475569",
    fontWeight: 800,
    marginBottom: 7,
  },

  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 15,
    boxSizing: "border-box",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },

  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    background: "linear-gradient(135deg,#2563eb,#4f46e5)",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  dangerButton: {
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 16px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
  },
};
