import type { ProductionOrderOperation } from "./productionTypes";
import { formatMoney } from "./productionUtils";
import {
  Field,
  closeButtonStyle,
  inputStyle,
  modalBoxStyle,
  modalHeaderStyle,
  modalTitleStyle,
  primaryGreenButtonStyle,
  secondaryBlueButtonStyle,
  stackedModalOverlayStyle,
} from "./ProductionUi";

type ProductionFinishOperationModalProps = {
  operation: ProductionOrderOperation;
  availableQuantity: number;
  quantity: string;
  comment: string;
  error: string;
  actionLoading: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onQuantityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onUseFullRemainder: () => void;
};

export default function ProductionFinishOperationModal({
  operation,
  availableQuantity,
  quantity,
  comment,
  error,
  actionLoading,
  onClose,
  onSubmit,
  onQuantityChange,
  onCommentChange,
  onUseFullRemainder,
}: ProductionFinishOperationModalProps) {
  const earned =
    Number(quantity || 0) * Number(operation.price_per_unit || 0);

  return (
    <div onClick={onClose} style={stackedModalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Закончить работу</div>
            <div style={{ marginTop: 4, color: "#64748b" }}>
              {operation.operation_name}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1e3a8a",
              fontWeight: 700,
            }}
          >
            Можно закрыть сейчас: {availableQuantity} шт
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <Field label="Сколько изделий выполнено?">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
                type="number"
                step="1"
                min="1"
                max={availableQuantity || undefined}
                placeholder="Например: 12"
                style={inputStyle}
              />

              <button
                type="button"
                onClick={onUseFullRemainder}
                disabled={availableQuantity <= 0 || actionLoading}
                style={{
                  ...fullRemainderButtonStyle,
                  opacity:
                    availableQuantity <= 0 || actionLoading ? 0.55 : 1,
                  cursor:
                    availableQuantity <= 0 || actionLoading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ✓ Весь остаток — {availableQuantity} шт
              </button>
            </div>
          </Field>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #dbeafe",
              background: "#f8fbff",
              color: "#0f172a",
              fontWeight: 700,
            }}
          >
            Ставка: {formatMoney(operation.price_per_unit || 0)} / шт
            <br />
            Заработано: {formatMoney(earned)}
          </div>

          <Field label="Комментарий">
            <input
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Необязательно"
              style={inputStyle}
            />
          </Field>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={secondaryBlueButtonStyle()}
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={actionLoading}
              style={{
                ...primaryGreenButtonStyle,
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              {actionLoading ? "Сохранение..." : "Завершить операцию"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fullRemainderButtonStyle: React.CSSProperties = {
  width: "fit-content",
  background: "#f0fdf4",
  color: "#15803d",
  border: "1px solid #86efac",
  borderRadius: 10,
  padding: "10px 13px",
  fontWeight: 800,
};
