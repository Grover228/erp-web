import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type UnitItem = {
  id: string;
  name: string;
  short_name: string;
  description: string | null;
  created_at: string | null;
};

export default function UnitsDirectory() {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadUnits();
  }, []);

  async function loadUnits() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      setUnits((data as UnitItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки единиц измерения"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !shortName.trim()) {
      setError("Заполни название и сокращение");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase.from("units").insert({
        name: name.trim(),
        short_name: shortName.trim(),
        description: description.trim() || null,
      });

      if (error) throw error;

      setName("");
      setShortName("");
      setDescription("");
      setMessage("Единица измерения добавлена.");

      await loadUnits();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось добавить единицу измерения"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUnit(unit: UnitItem) {
    const confirmed = window.confirm(
      `Удалить единицу измерения "${unit.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(unit.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("units")
        .delete()
        .eq("id", unit.id);

      if (error) throw error;

      setUnits((prev) => prev.filter((item) => item.id !== unit.id));
      setMessage(`Единица "${unit.name}" удалена.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить единицу измерения"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 18,
          padding: 18,
          border: "1px solid #dbe4f0",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 8,
          }}
        >
          Единицы измерения
        </div>

        <div
          style={{
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Здесь хранятся все единицы измерения, которые потом будут
          использоваться в материалах, изделиях, расходниках и других
          справочниках.
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: 18,
          padding: 18,
          border: "1px solid #bbf7d0",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#15803d",
            marginBottom: 14,
          }}
        >
          Добавить единицу измерения
        </div>

        <form
          onSubmit={handleAddUnit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Название
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Штука"
              style={{
                height: 42,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontSize: 14,
                background: "#fff",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Сокращение
            </label>

            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Например: шт"
              style={{
                height: 42,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontSize: 14,
                background: "#fff",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Описание
            </label>

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Необязательно"
              style={{
                height: 42,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: "0 12px",
                fontSize: 14,
                background: "#fff",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <button
              type="submit"
              disabled={saving}
              style={{
                height: 42,
                minWidth: 190,
                border: "none",
                borderRadius: 10,
                background: saving ? "#86efac" : "#16a34a",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
                padding: "0 16px",
              }}
            >
              {saving ? "Сохранение..." : "Добавить единицу"}
            </button>
          </div>
        </form>
      </div>

      {(message || error) && (
        <div
          style={{
            background: message ? "#dcfce7" : "#fef2f2",
            border: message
              ? "1px solid #86efac"
              : "1px solid #fecaca",
            color: message ? "#166534" : "#991b1b",
            borderRadius: 14,
            padding: 14,
            fontWeight: 600,
          }}
        >
          {message || error}
        </div>
      )}

      <div
        style={{
          background: "#ffffff",
          borderRadius: 18,
          padding: 18,
          border: "1px solid #dbe4f0",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Список единиц измерения
          </div>

          <button
            onClick={loadUnits}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Обновить
          </button>
        </div>

        {loading && (
          <div style={{ color: "#64748b" }}>
            Загрузка единиц измерения...
          </div>
        )}

        {!loading && units.length === 0 && (
          <div style={{ color: "#64748b" }}>
            Единиц измерения пока нет
          </div>
        )}

        {!loading && units.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {units.map((unit) => {
              const isDeleting = deletingId === unit.id;

              return (
                <div
                  key={unit.id}
                  style={{
                    border: "1px solid #dbe4f0",
                    borderRadius: 14,
                    padding: 14,
                    background: "#f8fbff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {unit.name}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: "#475569",
                      }}
                    >
                      Сокращение:{" "}
                      <span style={{ fontWeight: 700 }}>{unit.short_name}</span>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: "#64748b",
                      }}
                    >
                      Описание: {unit.description || "—"}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteUnit(unit)}
                    disabled={isDeleting}
                    style={{
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 14px",
                      background: isDeleting ? "#fecaca" : "#dc2626",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: isDeleting ? "default" : "pointer",
                    }}
                  >
                    {isDeleting ? "Удаление..." : "Удалить"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}