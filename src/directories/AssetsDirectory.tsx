import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../supabase";

type AssetItem = {
  id: string;
  item_id: string;
  inventory_number: string;
  serial_number: string | null;
  asset_type: string;
  status: string;
  location: string | null;
  responsible_user_id: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string | null;
  items?: {
    id: string;
    name: string;
    article: string | null;
    item_type: string;
  } | null;
};

type EmployeeItem = {
  id: string;
  full_name: string | null;
};

const assetTypes = [
  { value: "equipment", label: "Оборудование" },
  { value: "tool", label: "Инструмент" },
  { value: "furniture", label: "Мебель" },
  { value: "device", label: "Устройство / техника" },
  { value: "vehicle", label: "Транспорт" },
  { value: "other", label: "Другое" },
];

const assetStatuses = [
  { value: "active", label: "Активен" },
  { value: "repair", label: "Ремонт" },
  { value: "maintenance", label: "Обслуживание" },
  { value: "lost", label: "Утерян" },
  { value: "written_off", label: "Списан" },
];

export default function AssetsDirectory() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [viewAssetId, setViewAssetId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [qrAsset, setQrAsset] = useState<AssetItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [inventoryNumber, setInventoryNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetType, setAssetType] = useState("equipment");
  const [status, setStatus] = useState("active");
  const [location, setLocation] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [comment, setComment] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editName, setEditName] = useState("");
  const [editArticle, setEditArticle] = useState("");
  const [editInventoryNumber, setEditInventoryNumber] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editAssetType, setEditAssetType] = useState("equipment");
  const [editStatus, setEditStatus] = useState("active");
  const [editLocation, setEditLocation] = useState("");
  const [editResponsibleUserId, setEditResponsibleUserId] = useState("");
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadAssets(), loadEmployees()]);
  }

  async function loadAssets() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("assets")
        .select("*, items (id, name, article, item_type)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const safeAssets = (data as AssetItem[]) || [];
      setAssets(safeAssets);

      if (safeAssets.length > 0 && !selectedAssetId) {
        setSelectedAssetId(safeAssets[0].id);
      }

      if (
        selectedAssetId &&
        !safeAssets.find((item) => item.id === selectedAssetId)
      ) {
        setSelectedAssetId(safeAssets[0]?.id || null);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки имущества"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки сотрудников", error);
      setEmployees([]);
      return;
    }

    setEmployees((data as EmployeeItem[]) || []);
  }

  function resetForm() {
    setName("");
    setArticle("");
    setInventoryNumber("");
    setSerialNumber("");
    setAssetType("equipment");
    setStatus("active");
    setLocation("");
    setResponsibleUserId("");
    setPurchasePrice("");
    setPurchaseDate("");
    setComment("");
    setIsActive(true);
  }

  function fillEditForm(asset: AssetItem) {
    setEditName(asset.items?.name || "");
    setEditArticle(asset.items?.article || "");
    setEditInventoryNumber(asset.inventory_number || "");
    setEditSerialNumber(asset.serial_number || "");
    setEditAssetType(asset.asset_type || "equipment");
    setEditStatus(asset.status || "active");
    setEditLocation(asset.location || "");
    setEditResponsibleUserId(asset.responsible_user_id || "");
    setEditPurchasePrice(
      asset.purchase_price !== null ? String(asset.purchase_price) : ""
    );
    setEditPurchaseDate(asset.purchase_date || "");
    setEditComment(asset.comment || "");
    setEditIsActive(asset.is_active);
  }

  function getAssetTypeLabel(value: string) {
    return assetTypes.find((item) => item.value === value)?.label || value;
  }

  function getStatusLabel(value: string) {
    return assetStatuses.find((item) => item.value === value)?.label || value;
  }

  function getEmployeeName(employeeId: string | null) {
    if (!employeeId) return "—";
    return employees.find((item) => item.id === employeeId)?.full_name || "—";
  }

  function openAssetCard(asset: AssetItem) {
    setSelectedAssetId(asset.id);
    setViewAssetId(asset.id);
    setIsEditMode(false);
    fillEditForm(asset);
    setError("");
    setMessage("");
  }

  function closeAssetCard() {
    setViewAssetId(null);
    setIsEditMode(false);
  }

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Заполни название имущества");
      return;
    }

    if (!inventoryNumber.trim()) {
      setError("Заполни инвентарный номер");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const itemType = assetType === "tool" ? "tool" : "equipment";

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .insert({
          item_type: itemType,
          name: name.trim(),
          article: article.trim() || null,
          is_active: isActive,
        })
        .select("id")
        .single();

      if (itemError) throw itemError;

      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .insert({
          item_id: itemData.id,
          inventory_number: inventoryNumber.trim(),
          serial_number: serialNumber.trim() || null,
          asset_type: assetType,
          status,
          location: location.trim() || null,
          responsible_user_id: responsibleUserId || null,
          purchase_price: purchasePrice ? Number(purchasePrice) : null,
          purchase_date: purchaseDate || null,
          comment: comment.trim() || null,
          is_active: isActive,
        })
        .select()
        .single();

      if (assetError) throw assetError;

      setMessage("Имущество добавлено.");
      resetForm();
      setIsCreateOpen(false);
      await loadAssets();

      if (assetData?.id) {
        setSelectedAssetId(assetData.id);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось добавить имущество"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateAsset(e: React.FormEvent) {
    e.preventDefault();

    const viewAsset = assets.find((item) => item.id === viewAssetId);
    if (!viewAsset) return;

    if (!editName.trim()) {
      setError("Заполни название имущества");
      return;
    }

    if (!editInventoryNumber.trim()) {
      setError("Заполни инвентарный номер");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const itemType = editAssetType === "tool" ? "tool" : "equipment";

      const { error: itemError } = await supabase
        .from("items")
        .update({
          item_type: itemType,
          name: editName.trim(),
          article: editArticle.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", viewAsset.item_id);

      if (itemError) throw itemError;

      const { error: assetError } = await supabase
        .from("assets")
        .update({
          inventory_number: editInventoryNumber.trim(),
          serial_number: editSerialNumber.trim() || null,
          asset_type: editAssetType,
          status: editStatus,
          location: editLocation.trim() || null,
          responsible_user_id: editResponsibleUserId || null,
          purchase_price: editPurchasePrice ? Number(editPurchasePrice) : null,
          purchase_date: editPurchaseDate || null,
          comment: editComment.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", viewAsset.id);

      if (assetError) throw assetError;

      setMessage("Карточка имущества обновлена.");
      setIsEditMode(false);
      await loadAssets();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось обновить карточку имущества"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteAsset(asset: AssetItem) {
    const confirmed = window.confirm(
      `Удалить имущество "${asset.items?.name || asset.inventory_number}"?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(asset.id);
      setError("");
      setMessage("");

      const { error: assetError } = await supabase
        .from("assets")
        .delete()
        .eq("id", asset.id);

      if (assetError) throw assetError;

      const { error: itemError } = await supabase
        .from("items")
        .delete()
        .eq("id", asset.item_id);

      if (itemError) {
        console.error("Имущество удалено, но item удалить не удалось", itemError);
      }

      const nextAssets = assets.filter((item) => item.id !== asset.id);
      setAssets(nextAssets);
      setMessage(`Имущество "${asset.items?.name || asset.inventory_number}" удалено.`);

      if (selectedAssetId === asset.id) {
        setSelectedAssetId(nextAssets[0]?.id || null);
      }

      if (viewAssetId === asset.id) {
        closeAssetCard();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось удалить имущество"
      );
    } finally {
      setDeletingId(null);
    }
  }

  function getAssetQrPayload(asset: AssetItem) {
    return JSON.stringify({
      type: "asset",
      asset_id: asset.id,
      item_id: asset.item_id,
      inventory_number: asset.inventory_number,
      name: asset.items?.name || "",
      article: asset.items?.article || "",
    });
  }

  async function openAssetQr(asset: AssetItem) {
    try {
      setQrLoading(true);
      setError("");
      setQrAsset(asset);
      setQrDataUrl("");

      const dataUrl = await QRCode.toDataURL(getAssetQrPayload(asset), {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      setQrDataUrl(dataUrl);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось создать QR-код",
      );
      setQrAsset(null);
      setQrDataUrl("");
    } finally {
      setQrLoading(false);
    }
  }

  function closeAssetQr() {
    setQrAsset(null);
    setQrDataUrl("");
    setQrLoading(false);
  }

  function printAssetQr() {
    if (!qrAsset || !qrDataUrl) return;

    const assetName = qrAsset.items?.name || "Имущество";
    const inventoryNumber = qrAsset.inventory_number || "Без номера";
    const article = qrAsset.items?.article || "";
    const serialNumber = qrAsset.serial_number || "";

    const printWindow = window.open("", "_blank", "width=420,height=620");

    if (!printWindow) {
      setError("Браузер заблокировал окно печати. Разреши всплывающие окна.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>QR имущества ${inventoryNumber}</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 16px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .label {
              width: 58mm;
              min-height: 40mm;
              border: 1px solid #111827;
              border-radius: 6px;
              padding: 8px;
              display: grid;
              grid-template-columns: 24mm 1fr;
              gap: 8px;
              align-items: center;
            }

            .qr {
              width: 24mm;
              height: 24mm;
            }

            .title {
              font-size: 11px;
              font-weight: 700;
              line-height: 1.2;
              margin-bottom: 4px;
              word-break: break-word;
            }

            .line {
              font-size: 9px;
              line-height: 1.25;
              margin-top: 2px;
              word-break: break-word;
            }

            .number {
              font-size: 10px;
              font-weight: 700;
            }

            @media print {
              body {
                padding: 0;
              }

              .label {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img class="qr" src="${qrDataUrl}" />
            <div>
              <div class="title">${escapeHtml(assetName)}</div>
              <div class="line number">${escapeHtml(inventoryNumber)}</div>
              ${article ? `<div class="line">Арт.: ${escapeHtml(article)}</div>` : ""}
              ${serialNumber ? `<div class="line">S/N: ${escapeHtml(serialNumber)}</div>` : ""}
            </div>
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;

    return assets.filter((asset) => {
      return (
        (asset.items?.name || "").toLowerCase().includes(query) ||
        (asset.items?.article || "").toLowerCase().includes(query) ||
        asset.inventory_number.toLowerCase().includes(query) ||
        (asset.serial_number || "").toLowerCase().includes(query) ||
        getAssetTypeLabel(asset.asset_type).toLowerCase().includes(query) ||
        getStatusLabel(asset.status).toLowerCase().includes(query) ||
        (asset.location || "").toLowerCase().includes(query) ||
        getEmployeeName(asset.responsible_user_id).toLowerCase().includes(query)
      );
    });
  }, [assets, search, employees]);

  const viewAsset = assets.find((item) => item.id === viewAssetId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={sectionStyle}>
        <div style={pageTitleStyle}>Имущество и оборудование</div>

        <div style={{ color: "#64748b", lineHeight: 1.6 }}>
          Здесь ведётся поэкземплярный учёт имущества: оборудование,
          инструменты, мебель, техника и другие объекты предприятия.
        </div>
      </div>

      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setError("");
                setMessage("");
                resetForm();
                setIsCreateOpen(true);
              }}
              style={primaryButtonStyle}
            >
              Добавить имущество
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имуществу"
              style={{
                ...inputStyle,
                width: 300,
                maxWidth: "100%",
              }}
            />
          </div>

          <button onClick={loadAll} style={secondaryButtonStyle}>
            Обновить
          </button>
        </div>
      </div>

      {(message || error) && (
        <div
          style={{
            background: message ? "#dcfce7" : "#fef2f2",
            border: message ? "1px solid #86efac" : "1px solid #fecaca",
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
          border: "1px solid #dbe4f0",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid #e5edf7",
            fontSize: 20,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Реестр имущества
        </div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка имущества...
          </div>
        )}

        {!loading && filteredAssets.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Имущество не найдено
          </div>
        )}

        {!loading && filteredAssets.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1080,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fbff" }}>
                  {[
                    "Инв. номер",
                    "Название",
                    "Артикул",
                    "Тип",
                    "Статус",
                    "Локация",
                    "Ответственный",
                    "Активность",
                    "Действия",
                  ].map((title) => (
                    <th key={title} style={headCellStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const isDeleting = deletingId === asset.id;

                  return (
                    <tr
                      key={asset.id}
                      style={{
                        background: isSelected ? "#eef4ff" : "#ffffff",
                      }}
                    >
                      <td style={cellStyle}>
                        <button
                          onClick={() => openAssetCard(asset)}
                          style={linkButtonStyle}
                        >
                          {asset.inventory_number}
                        </button>
                      </td>
                      <td style={cellStyle}>{asset.items?.name || "—"}</td>
                      <td style={cellStyle}>{asset.items?.article || "—"}</td>
                      <td style={cellStyle}>{getAssetTypeLabel(asset.asset_type)}</td>
                      <td style={cellStyle}>{getStatusLabel(asset.status)}</td>
                      <td style={cellStyle}>{asset.location || "—"}</td>
                      <td style={cellStyle}>{getEmployeeName(asset.responsible_user_id)}</td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            color: asset.is_active ? "#166534" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
                          {asset.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <button
                          onClick={() => handleDeleteAsset(asset)}
                          disabled={isDeleting}
                          style={dangerButtonStyle}
                        >
                          {isDeleting ? "Удаляю..." : "Удалить"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsCreateOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Новое имущество</div>
                <div style={modalSubtitleStyle}>
                  Конкретный объект с инвентарным номером и статусом
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddAsset}>
              <div style={formGridStyle}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название"
                  style={inputStyle}
                />

                <input
                  value={article}
                  onChange={(e) => setArticle(e.target.value)}
                  placeholder="Артикул / модель"
                  style={inputStyle}
                />

                <input
                  value={inventoryNumber}
                  onChange={(e) => setInventoryNumber(e.target.value)}
                  placeholder="Инвентарный номер"
                  style={inputStyle}
                />

                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Серийный номер"
                  style={inputStyle}
                />

                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  style={inputStyle}
                >
                  {assetTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={inputStyle}
                >
                  {assetStatuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Локация"
                  style={inputStyle}
                />

                <select
                  value={responsibleUserId}
                  onChange={(e) => setResponsibleUserId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Ответственный не выбран</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name || "Без имени"}
                    </option>
                  ))}
                </select>

                <input
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Цена покупки"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />

                <input
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  type="date"
                  style={inputStyle}
                />

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Комментарий"
                  style={{
                    ...inputStyle,
                    height: 88,
                    paddingTop: 12,
                    gridColumn: "1 / -1",
                    resize: "vertical",
                  }}
                />

                <label style={checkboxLabelStyle}>
                  <input
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    type="checkbox"
                  />
                  Активен
                </label>
              </div>

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={secondaryButtonStyle}
                >
                  Отмена
                </button>

                <button type="submit" disabled={saving} style={primaryButtonStyle}>
                  {saving ? "Сохраняю..." : "Добавить имущество"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewAsset && (
        <div style={modalOverlayStyle} onClick={closeAssetCard}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка имущества</div>
                <div style={modalSubtitleStyle}>
                  {viewAsset.items?.name || viewAsset.inventory_number}
                </div>
              </div>

              <button type="button" onClick={closeAssetCard} style={closeButtonStyle}>
                ×
              </button>
            </div>

            {!isEditMode && (
              <>
                <div style={cardGridStyle}>
                  <InfoCard label="Название" value={viewAsset.items?.name || "—"} />
                  <InfoCard label="Артикул / модель" value={viewAsset.items?.article || "—"} />
                  <InfoCard label="Инвентарный номер" value={viewAsset.inventory_number} />
                  <InfoCard label="Серийный номер" value={viewAsset.serial_number || "—"} />
                  <InfoCard label="Тип" value={getAssetTypeLabel(viewAsset.asset_type)} />
                  <InfoCard label="Статус" value={getStatusLabel(viewAsset.status)} />
                  <InfoCard label="Локация" value={viewAsset.location || "—"} />
                  <InfoCard
                    label="Ответственный"
                    value={getEmployeeName(viewAsset.responsible_user_id)}
                  />
                  <InfoCard
                    label="Цена покупки"
                    value={
                      viewAsset.purchase_price !== null
                        ? String(viewAsset.purchase_price)
                        : "—"
                    }
                  />
                  <InfoCard label="Дата покупки" value={viewAsset.purchase_date || "—"} />
                  <InfoCard
                    label="Активность"
                    value={viewAsset.is_active ? "Активен" : "Неактивен"}
                  />
                </div>

                {viewAsset.comment && (
                  <div style={infoBannerStyle}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Комментарий
                    </div>
                    <div>{viewAsset.comment}</div>
                  </div>
                )}

                <div style={infoBannerStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Поэкземплярный учёт
                  </div>
                  <div>
                    Этот объект учитывается отдельно: у него есть собственный
                    инвентарный номер, статус, локация и ответственный.
                  </div>
                </div>

                <div style={modalFooterStyle}>
                  <button
                    type="button"
                    onClick={() => openAssetQr(viewAsset)}
                    style={{
                      ...secondaryButtonStyle,
                      borderColor: "#06b6d4",
                      color: "#0369a1",
                    }}
                  >
                    Показать / печать QR
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    style={primaryButtonStyle}
                  >
                    Редактировать
                  </button>
                </div>
              </>
            )}

            {isEditMode && (
              <form onSubmit={handleUpdateAsset}>
                <div style={formGridStyle}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Название"
                    style={inputStyle}
                  />

                  <input
                    value={editArticle}
                    onChange={(e) => setEditArticle(e.target.value)}
                    placeholder="Артикул / модель"
                    style={inputStyle}
                  />

                  <input
                    value={editInventoryNumber}
                    onChange={(e) => setEditInventoryNumber(e.target.value)}
                    placeholder="Инвентарный номер"
                    style={inputStyle}
                  />

                  <input
                    value={editSerialNumber}
                    onChange={(e) => setEditSerialNumber(e.target.value)}
                    placeholder="Серийный номер"
                    style={inputStyle}
                  />

                  <select
                    value={editAssetType}
                    onChange={(e) => setEditAssetType(e.target.value)}
                    style={inputStyle}
                  >
                    {assetTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={inputStyle}
                  >
                    {assetStatuses.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Локация"
                    style={inputStyle}
                  />

                  <select
                    value={editResponsibleUserId}
                    onChange={(e) => setEditResponsibleUserId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Ответственный не выбран</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name || "Без имени"}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    placeholder="Цена покупки"
                    type="number"
                    step="0.01"
                    style={inputStyle}
                  />

                  <input
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                    type="date"
                    style={inputStyle}
                  />

                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="Комментарий"
                    style={{
                      ...inputStyle,
                      height: 88,
                      paddingTop: 12,
                      gridColumn: "1 / -1",
                      resize: "vertical",
                    }}
                  />

                  <label style={checkboxLabelStyle}>
                    <input
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      type="checkbox"
                    />
                    Активен
                  </label>
                </div>

                <div style={modalFooterStyle}>
                  <button
                    type="button"
                    onClick={() => {
                      fillEditForm(viewAsset);
                      setIsEditMode(false);
                    }}
                    style={secondaryButtonStyle}
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={updating}
                    style={primaryButtonStyle}
                  >
                    {updating ? "Сохраняю..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {qrAsset && (
        <div style={modalOverlayStyle} onClick={closeAssetQr}>
          <div
            style={{
              ...modalStyle,
              width: "min(520px, 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>QR-код имущества</div>
                <div style={modalSubtitleStyle}>
                  {qrAsset.items?.name || qrAsset.inventory_number}
                </div>
              </div>

              <button type="button" onClick={closeAssetQr} style={closeButtonStyle}>
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                justifyItems: "center",
                textAlign: "center",
              }}
            >
              {qrLoading && (
                <div style={{ color: "#64748b", padding: 20 }}>
                  Создаю QR-код...
                </div>
              )}

              {!qrLoading && qrDataUrl && (
                <>
                  <div
                    style={{
                      border: "1px solid #dbe4f0",
                      borderRadius: 18,
                      padding: 18,
                      background: "#ffffff",
                    }}
                  >
                    <img
                      src={qrDataUrl}
                      alt={`QR ${qrAsset.inventory_number}`}
                      style={{ width: 280, height: 280 }}
                    />
                  </div>

                  <div>
                    <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 18 }}>
                      {qrAsset.inventory_number}
                    </div>
                    <div style={{ color: "#64748b", marginTop: 4 }}>
                      {qrAsset.items?.name || "—"}
                    </div>
                    {qrAsset.items?.article && (
                      <div style={{ color: "#64748b", marginTop: 4 }}>
                        Артикул: {qrAsset.items.article}
                      </div>
                    )}
                  </div>

                  <div style={modalFooterStyle}>
                    <button
                      type="button"
                      onClick={closeAssetQr}
                      style={secondaryButtonStyle}
                    >
                      Закрыть
                    </button>

                    <button
                      type="button"
                      onClick={printAssetQr}
                      style={primaryButtonStyle}
                    >
                      Печать QR
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  padding: 18,
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  color: "#0f172a",
  background: "#ffffff",
  fontWeight: 600,
  boxSizing: "border-box",
  minWidth: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  background: "#4f46e5",
  color: "#ffffff",
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 10px 20px rgba(79, 70, 229, 0.2)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  background: "#dc2626",
  color: "#ffffff",
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 800,
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 800,
  padding: 0,
  textAlign: "left",
};

const headCellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5edf7",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  fontSize: 14,
  verticalAlign: "middle",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.42)",
  backdropFilter: "blur(4px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: "min(1080px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
  padding: 22,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 6,
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 22,
  fontWeight: 800,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  minHeight: 64,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginBottom: 8,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
};

const infoBannerStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #c4b5fd",
  background: "#f5f3ff",
  color: "#4c1d95",
  borderRadius: 14,
  padding: 14,
  lineHeight: 1.5,
};

const modalFooterStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
  fontWeight: 800,
  minHeight: 44,
};
