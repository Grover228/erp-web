import { useState } from "react";
import type {
  Job,
  ProductionBatch,
  ProductionOperationLog,
  ProductionOrder,
  ProductionOrderOperation,
} from "../../Production";

type ProductionOrderModalProps = {
  job: Job;
  variant: "active" | "history";
  sourceOrder: ProductionOrder | null;
  jobBatches: ProductionBatch[];
  operationLogs: ProductionOperationLog[];
  qrPrintLogs: Array<{
    id: string;
    batch_id: string;
    production_order_id: string;
    printed_at: string;
    printed_by: string | null;
    printer_name: string;
    batch_number: string | null;
    quantity: number | null;
  }>;
  nowTick: number;
  actionLoading: boolean;
  deletingOrderId: string;
  onClose: () => void;
  onOpenQrHistory: (order: ProductionOrder) => void;
  onPrintBatchQr: (batch: ProductionBatch) => void;
  onDeleteOrder: (order: ProductionOrder) => void;
  onStartOperation: (
    order: ProductionOrder,
    operation: ProductionOrderOperation,
  ) => void;
  onOpenFinishOperation: (operation: ProductionOrderOperation) => void;
  onWriteOffDefect: (batch: ProductionBatch) => void;
  getOperationLimit: (
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation,
  ) => number;
  canStartOperation: (
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation,
  ) => boolean;
};

type OperationFact = {
  logs: ProductionOperationLog[];
  totalQuantity: number;
  totalEarned: number;
  totalDurationSeconds: number;
  firstLog: ProductionOperationLog | null;
  lastLog: ProductionOperationLog | null;
};

type OrderModalTab = "overview" | "operations" | "batches" | "qr";

export default function ProductionOrderModal({
  job,
  variant,
  sourceOrder,
  jobBatches,
  operationLogs,
  qrPrintLogs,
  nowTick,
  actionLoading,
  deletingOrderId,
  onClose,
  onOpenQrHistory,
  onPrintBatchQr,
  onDeleteOrder,
  onStartOperation,
  onOpenFinishOperation,
  onWriteOffDefect,
  getOperationLimit,
  canStartOperation,
}: ProductionOrderModalProps) {
  const progress = getOrderOperationProgress(job);
  const totalFactDurationSeconds = operationLogs.reduce(
    (sum, log) => sum + Number(log.duration_seconds || 0),
    0,
  );
  const totalFactQuantity = operationLogs.reduce(
    (sum, log) => sum + Number(log.quantity || 0),
    0,
  );
  const averageSecondsPerItem =
    totalFactQuantity > 0 ? totalFactDurationSeconds / totalFactQuantity : 0;

  const [activeTab, setActiveTab] = useState<OrderModalTab>("overview");

  const completedQuantity = Math.max(
    0,
    Math.min(Number(job.completed || 0), Number(job.qty || 0)),
  );
  const totalEarned = job.operations.reduce((sum, operation) => {
    const fact = getOperationFact(operation, operationLogs);
    return (
      sum +
      (fact.totalEarned ||
        Number(operation.completed_quantity || 0) *
          Number(operation.price_per_unit || 0))
    );
  }, 0);

  const lastOperation =
    [...job.operations]
      .sort((a, b) => a.sort_order - b.sort_order)
      .findLast((operation) => Number(operation.completed_quantity || 0) > 0) ||
    null;

  const inProgressOperations = [...job.operations]
    .filter((operation) => operation.status === "in_progress")
    .sort((a, b) => a.sort_order - b.sort_order);

  const nextWaitingOperation =
    [...job.operations]
      .sort((a, b) => a.sort_order - b.sort_order)
      .find(
        (operation) =>
          !["done", "cancelled", "archived", "in_progress"].includes(
            operation.status,
          ),
      ) || null;

  const totalPrints = qrPrintLogs.length;
  const printedBatchIds = new Set(qrPrintLogs.map((log) => log.batch_id));
  const printedBatchesCount = printedBatchIds.size;
  const lastPrintAt = qrPrintLogs[0]?.printed_at || null;

  function getBatchPrintInfo(batchId: string) {
    const logs = qrPrintLogs.filter((log) => log.batch_id === batchId);
    return {
      count: logs.length,
      lastPrintedAt: logs[0]?.printed_at || null,
    };
  }

  if (!sourceOrder) {
    return (
      <ModalShell job={job} progress={progress} onClose={onClose}>
        <div style={emptyStyle}>Производственный заказ не найден.</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell job={job} progress={progress} onClose={onClose}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={summaryGridStyle}>
          <SummaryMetric icon="▣" label="Заказано" value={`${job.qty} шт`} />
          <SummaryMetric
            icon="✓"
            label="Годно"
            value={`${completedQuantity} шт`}
            tone="success"
          />
          <SummaryMetric
            icon="◇"
            label="Пачки"
            value={`${jobBatches.length} шт`}
            tone="violet"
          />
          <SummaryMetric
            icon="⌗"
            label="QR создано"
            value={`${jobBatches.length} шт`}
            tone="orange"
          />
        </div>

        <div>
          <div style={progressHeaderStyle}>
            <span>Общий прогресс задания</span>
            <strong>{progress}%</strong>
          </div>
          <ProgressBar value={progress} />
        </div>

        <div style={tabsStyle}>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            style={orderTabStyle(activeTab === "overview")}
          >
            Обзор
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            style={orderTabStyle(activeTab === "operations")}
          >
            Операции
            <span style={tabCounterStyle}>{job.operations.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            style={orderTabStyle(activeTab === "batches")}
          >
            Пачки
            <span style={tabCounterStyle}>{jobBatches.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            style={orderTabStyle(activeTab === "qr")}
          >
            QR и печать
          </button>
        </div>

        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={compactFactsStripStyle}>
              <CompactFact icon="□" label="Создано" value={job.issuedAt} />
              <CompactFact
                icon="◷"
                label="Плановое время"
                value={formatTime(job.timeMin)}
              />
              <CompactFact
                icon="◴"
                label="Факт времени"
                value={formatTimer(totalFactDurationSeconds)}
              />
              <CompactFact
                icon="◌"
                label="Среднее на изделие"
                value={
                  averageSecondsPerItem > 0
                    ? `${averageSecondsPerItem.toFixed(1)} сек`
                    : "—"
                }
              />
              <CompactFact
                icon="▱"
                label="Себестоимость"
                value={formatMoney(job.cost)}
              />
              <CompactFact
                icon="₽"
                label="Заработано"
                value={formatMoney(totalEarned)}
                tone="success"
              />
            </div>

            <div style={overviewColumnsStyle}>
              <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>Состояние производства</div>
                  <div style={sectionHintStyle}>
                    Основная информация без перехода по длинному списку.
                  </div>
                </div>
                <span style={statusBadgeStyle(job.rawStatus)}>
                  {job.status}
                </span>
              </div>

              <div style={overviewRowsStyle}>
                <OverviewRow
                  label="Операции"
                  value={
                    job.operations.length === 0
                      ? "Не добавлены"
                      : `${job.operations.filter((operation) => operation.status === "done").length} из ${job.operations.length} завершено`
                  }
                />
                <OverviewRow
                  label="Пачки"
                  value={
                    jobBatches.length === 0
                      ? "Пока не созданы"
                      : `${jobBatches.filter((batch) => batch.status === "done").length} из ${jobBatches.length} завершено`
                  }
                />
                <OverviewRow
                  label="QR"
                  value={
                    jobBatches.length > 0
                      ? `Создано ${jobBatches.length} QR-кодов`
                      : "QR появятся после раскроя"
                  }
                />
              </div>
              </div>

              <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>Текущая работа</div>
                  <div style={sectionHintStyle}>
                    Что происходит с заказом прямо сейчас.
                  </div>
                </div>
              </div>

              {inProgressOperations.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {inProgressOperations.map((operation) => {
                    const fact = getOperationFact(operation, operationLogs);
                    const assignedBy =
                      fact.logs.length > 0
                        ? getUserLabel(fact.lastLog)
                        : operation.assigned_user_id
                          ? `ID ${operation.assigned_user_id.slice(0, 8)}`
                          : "Не указан";

                    const availableQuantity = getOperationLimit(
                      sourceOrder,
                      job.operations,
                      operation,
                    );

                    return (
                      <div key={operation.id} style={currentWorkCardStyle}>
                        <div style={currentWorkTopStyle}>
                          <div>
                            <div style={currentWorkTitleStyle}>
                              {operation.sort_order}. {operation.operation_name}
                            </div>
                            <div style={currentWorkStatusStyle}>В работе</div>
                          </div>

                          <div style={currentWorkTimerStyle}>
                            {formatTimer(
                              getElapsedSeconds(operation.started_at, nowTick),
                            )}
                          </div>
                        </div>

                        <div style={currentWorkGridStyle}>
                          <CurrentWorkItem
                            label="Исполнитель"
                            value={assignedBy}
                          />
                          <CurrentWorkItem
                            label="Начато"
                            value={formatDateTime(operation.started_at)}
                          />
                          <CurrentWorkItem
                            label="Доступно сейчас"
                            value={`${availableQuantity} шт`}
                          />
                          <CurrentWorkItem
                            label="Выполнено"
                            value={`${Number(operation.completed_quantity || 0)} / ${job.qty} шт`}
                          />
                        </div>

                        {variant === "active" && (
                          <div style={currentWorkActionsStyle}>
                            <button
                              type="button"
                              onClick={() => setActiveTab("operations")}
                              style={currentWorkDetailsButtonStyle}
                            >
                              Подробнее →
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenFinishOperation(operation)}
                              disabled={actionLoading}
                              style={{
                                ...currentWorkFinishButtonStyle,
                                opacity: actionLoading ? 0.65 : 1,
                              }}
                            >
                              ✓ Завершить операцию
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : job.rawStatus === "done" ? (
                <div style={currentWorkEmptyStyle}>
                  Заказ завершён
                  {lastOperation
                    ? ` · последняя операция: ${lastOperation.sort_order}. ${lastOperation.operation_name}`
                    : ""}
                </div>
              ) : nextWaitingOperation ? (
                <div style={currentWorkEmptyStyle}>
                  Следующая операция:{" "}
                  <strong>
                    {nextWaitingOperation.sort_order}.{" "}
                    {nextWaitingOperation.operation_name}
                  </strong>
                  {" · "}
                  ожидает начала
                </div>
              ) : (
                <div style={currentWorkEmptyStyle}>
                  Активной операции сейчас нет.
                </div>
              )}
              </div>
            </div>

            <div style={quickActionsStyle}>
              <button
                type="button"
                onClick={() => setActiveTab("batches")}
                style={secondaryBlueButtonStyle()}
              >
                Пачки →
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("operations")}
                style={secondaryBlueButtonStyle()}
              >
                Операции →
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                style={secondaryBlueButtonStyle()}
              >
                QR и печать →
              </button>

              {variant === "active" && (
                <button
                  onClick={() => onDeleteOrder(sourceOrder)}
                  disabled={deletingOrderId === sourceOrder.id}
                  style={{
                    ...dangerButtonStyle,
                    marginLeft: "auto",
                    opacity: deletingOrderId === sourceOrder.id ? 0.7 : 1,
                  }}
                >
                  {deletingOrderId === sourceOrder.id ? "Удаление..." : "Удалить"}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "operations" && (
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={sectionTitleStyle}>Операции</div>
                <div style={sectionHintStyle}>
                  Все этапы заказа. Подробности остаются прямо в строке операции.
                </div>
              </div>
            </div>

            {job.operations.length === 0 ? (
              <div style={emptySmallStyle}>Операции пока не добавлены</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {job.operations.map((operation) => {
                  const operationProgress = getProgress(
                    Number(operation.completed_quantity || 0),
                    job.qty,
                  );

                  const availableQuantity = getOperationLimit(
                    sourceOrder,
                    job.operations,
                    operation,
                  );

                  const canStart = canStartOperation(
                    sourceOrder,
                    job.operations,
                    operation,
                  );

                  const isInProgress = operation.status === "in_progress";
                  const isDone = operation.status === "done";
                  const fact = getOperationFact(operation, operationLogs);
                  const earned =
                    fact.totalEarned ||
                    Number(operation.completed_quantity || 0) *
                      Number(operation.price_per_unit || 0);

                  return (
                    <div key={operation.id} style={operationRowStyle}>
                      <div style={operationTopRowStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={operationNameStyle}>
                            <span style={operationNumberStyle}>
                              {operation.sort_order}
                            </span>
                            {operation.operation_name}
                          </div>
                          <div style={operationMetaStyle}>
                            {getStatusLabel(operation.status)}
                            {!isDone &&
                              ` · доступно ${availableQuantity} шт`}
                            {isInProgress &&
                              ` · в работе ${formatTimer(
                                getElapsedSeconds(operation.started_at, nowTick),
                              )}`}
                            {isDone &&
                              ` · заработано ${formatMoney(earned)}`}
                          </div>
                        </div>

                        <div style={operationQuantityStyle}>
                          {operation.completed_quantity || 0} / {job.qty}
                        </div>
                      </div>

                      <ProgressBar value={operationProgress} />
                      <OperationFactBlock fact={fact} />

                      {variant === "active" && (
                        <div style={operationActionsStyle}>
                          {canStart && (
                            <button
                              onClick={() =>
                                onStartOperation(sourceOrder, operation)
                              }
                              disabled={actionLoading}
                              style={primaryBlueButtonStyle}
                            >
                              Взять в работу
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              onClick={() => onOpenFinishOperation(operation)}
                              disabled={actionLoading}
                              style={primaryGreenButtonStyle}
                            >
                              Закончить работу
                            </button>
                          )}

                          {!canStart && !isInProgress && !isDone && (
                            <div style={waitingMessageStyle}>
                              Ждёт доступное количество с предыдущей операции
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "batches" && (
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={sectionTitleStyle}>Пачки</div>
                <div style={sectionHintStyle}>
                  Физические пачки заказа и их текущее состояние.
                </div>
              </div>
            </div>

            {jobBatches.length === 0 ? (
              <div style={emptySmallStyle}>
                Пачек пока нет. Они появятся после закрытия раскроя.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {jobBatches.map((batch) => {
                  const batchTotal = Number(batch.quantity || 0);
                  const batchCompleted = Number(batch.completed_quantity || 0);
                  const batchLeft = Math.max(0, batchTotal - batchCompleted);
                  const canWriteOff =
                    variant === "active" &&
                    !["done", "cancelled", "archived"].includes(batch.status) &&
                    batchLeft > 0;

                  return (
                    <div key={batch.id} style={batchRowStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={batchTitleStyle}>{batch.batch_number}</div>
                        <div style={batchMetaStyle}>
                          {getStatusLabel(batch.status)} · {batchTotal} шт ·
                          годно на текущей операции {batchCompleted} · остаток{" "}
                          {batchLeft}
                        </div>
                      </div>

                      <div style={batchActionsStyle}>
                        <span style={qrCreatedBadgeStyle}>QR создан</span>
                        {(() => {
                          const printInfo = getBatchPrintInfo(batch.id);
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => onPrintBatchQr(batch)}
                                disabled={actionLoading}
                                style={printBatchButtonStyle}
                              >
                                🖨 Печать
                              </button>
                              <span style={printCountBadgeStyle}>
                                {printInfo.count > 0
                                  ? `Печатался ${printInfo.count} ${getPrintTimesWord(printInfo.count)}`
                                  : "Не печатался"}
                              </span>
                            </>
                          );
                        })()}
                        {canWriteOff && (
                          <button
                            type="button"
                            onClick={() => onWriteOffDefect(batch)}
                            disabled={actionLoading}
                            style={defectButtonStyle}
                          >
                            Списать брак
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "qr" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={qrStatsGridStyle}>
              <InfoBox label="QR создано" value={`${jobBatches.length} шт`} />
              <InfoBox
                label="Печатались"
                value={`${printedBatchesCount} из ${jobBatches.length}`}
              />
              <InfoBox
                label="Всего отправок на печать"
                value={`${totalPrints}${lastPrintAt ? ` · последняя ${formatDateTime(lastPrintAt)}` : ""}`}
              />
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <div style={sectionTitleStyle}>QR и печать</div>
                  <div style={sectionHintStyle}>
                    Печатай QR прямо у нужной пачки. Повторные отправки считаются отдельно.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenQrHistory(sourceOrder)}
                  style={secondaryBlueButtonStyle()}
                >
                  Просмотреть QR
                </button>
              </div>

              {jobBatches.length === 0 ? (
                <div style={emptySmallStyle}>
                  QR-кодов пока нет. Первый появится после завершения раскроя.
                </div>
              ) : (
                <div style={qrTableStyle}>
                  <div style={qrTableHeaderStyle}>
                    <span>Пачка</span>
                    <span>Количество</span>
                    <span>QR</span>
                    <span>Печать</span>
                    <span>Действие</span>
                  </div>

                  {jobBatches.map((batch) => {
                    const printInfo = getBatchPrintInfo(batch.id);

                    return (
                      <div key={batch.id} style={qrTableRowStyle}>
                        <strong>{batch.batch_number}</strong>
                        <span>{Number(batch.quantity || 0)} шт</span>
                        <span style={qrCreatedTextStyle}>Создан</span>
                        <span>
                          <strong>
                            {printInfo.count > 0
                              ? `${printInfo.count} ${getPrintTimesWord(printInfo.count)}`
                              : "Не печатался"}
                          </strong>
                          {printInfo.lastPrintedAt && (
                            <div style={lastPrintStyle}>
                              Последняя: {formatDateTime(printInfo.lastPrintedAt)}
                            </div>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPrintBatchQr(batch)}
                          disabled={actionLoading}
                          style={printBatchButtonStyle}
                        >
                          🖨 Печать
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={qrNoticeStyle}>
                Создание QR и печать учитываются отдельно. Счётчик увеличивается
                только после успешной отправки конкретной пачки на принтер.
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function OperationFactBlock({ fact }: { fact: OperationFact }) {
  if (fact.logs.length === 0) {
    return (
      <div style={operationFactEmptyStyle}>
        Фактическое выполнение пока не зафиксировано.
      </div>
    );
  }

  const startedBy = getUserLabel(fact.firstLog);
  const finishedBy = getUserLabel(fact.lastLog);
  const startedAt = formatDateTime(fact.firstLog?.started_at || null);
  const finishedAt = formatDateTime(fact.lastLog?.finished_at || null);
  const avgSeconds =
    fact.totalQuantity > 0 ? fact.totalDurationSeconds / fact.totalQuantity : 0;

  return (
    <div style={operationFactStyle}>
      <div>
        <span style={factLabelStyle}>Начал:</span> {startedBy} · {startedAt}
      </div>
      <div>
        <span style={factLabelStyle}>Завершил:</span> {finishedBy} · {finishedAt}
      </div>
      <div>
        <span style={factLabelStyle}>Факт времени:</span>{" "}
        {formatTimer(fact.totalDurationSeconds)}
      </div>
      <div>
        <span style={factLabelStyle}>Среднее:</span>{" "}
        {avgSeconds > 0 ? `${avgSeconds.toFixed(1)} сек / изделие` : "—"}
      </div>
    </div>
  );
}

function getOperationFact(
  operation: ProductionOrderOperation,
  operationLogs: ProductionOperationLog[],
): OperationFact {
  const logs = operationLogs
    .filter((log) => {
      if (log.production_order_operation_id) {
        return log.production_order_operation_id === operation.id;
      }

      return log.operation_name === operation.operation_name;
    })
    .sort(
      (a, b) =>
        new Date(a.finished_at || a.started_at || 0).getTime() -
        new Date(b.finished_at || b.started_at || 0).getTime(),
    );

  return {
    logs,
    totalQuantity: logs.reduce((sum, log) => sum + Number(log.quantity || 0), 0),
    totalEarned: logs.reduce(
      (sum, log) => sum + Number(log.earned_amount || 0),
      0,
    ),
    totalDurationSeconds: logs.reduce(
      (sum, log) => sum + Number(log.duration_seconds || 0),
      0,
    ),
    firstLog: logs[0] || null,
    lastLog: logs[logs.length - 1] || null,
  };
}

function getOrderOperationProgress(job: Job) {
  if (job.operations.length === 0 || job.qty <= 0) {
    return getProgress(job.completed, job.qty);
  }

  const totalProgress = job.operations.reduce((sum, operation) => {
    const completed = Math.min(
      Number(operation.completed_quantity || 0),
      Number(job.qty || 0),
    );

    return sum + completed / Number(job.qty || 1);
  }, 0);

  return Math.round((totalProgress / job.operations.length) * 100);
}

function getUserLabel(log: ProductionOperationLog | null) {
  if (!log) return "—";

  if (log.user_name) return log.user_name;
  if (log.user_id) return `ID ${log.user_id.slice(0, 8)}`;

  return "—";
}

function ModalShell({
  job,
  progress,
  onClose,
  children,
}: {
  job: Job;
  progress: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
              {job.product}
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              {job.id} · {job.status} · {progress}%
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function getProgress(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

function formatTime(minutes: number | null | undefined) {
  const totalMinutes = Math.round(Number(minutes || 0));

  if (totalMinutes <= 0) return "0 мин";

  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  if (hours === 0) return `${restMinutes} мин`;
  if (restMinutes === 0) return `${hours} ч`;

  return `${hours} ч ${restMinutes} мин`;
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
}

function getElapsedSeconds(startedAt: string | null, nowTick: number) {
  if (!startedAt) return 0;
  return Math.floor((nowTick - new Date(startedAt).getTime()) / 1000);
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "pending":
      return "Ожидает";
    case "waiting":
      return "Ожидает";
    case "partial":
      return "Частично выполнено";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    case "cancelled":
      return "Отменён";
    case "archived":
      return "Архив";
    default:
      return status || "Черновик";
  }
}

function getPrintTimesWord(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "раз";
  if (last === 1) return "раз";
  if (last >= 2 && last <= 4) return "раза";

  return "раз";
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#dbeafe",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: "100%",
          background: "#2563eb",
        }}
      />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 14,
        padding: 12,
        background: "#f8fbff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
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

const primaryBlueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryGreenButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 16,
  color: "#64748b",
  background: "#f8fbff",
  fontWeight: 600,
};

const emptySmallStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 600,
};

const operationFactStyle: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 4,
  padding: 10,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#475569",
  fontSize: 13,
};

const operationFactEmptyStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 600,
};

const factLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};


const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
  gap: 8,
};

function SummaryMetric({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "default" | "success" | "violet" | "orange";
}) {
  const toneColor =
    tone === "success"
      ? "#15803d"
      : tone === "violet"
        ? "#7c3aed"
        : tone === "orange"
          ? "#ea580c"
          : "#2563eb";

  return (
    <div style={summaryMetricStyle}>
      <div style={{ ...summaryMetricIconStyle, color: toneColor }}>{icon}</div>
      <div>
        <div style={summaryMetricLabelStyle}>{label}</div>
        <div
          style={{
            ...summaryMetricValueStyle,
            color: tone === "success" ? "#15803d" : "#0f172a",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function CompactFact({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div style={compactFactStyle}>
      <div
        style={{
          ...compactFactIconStyle,
          color: tone === "success" ? "#15803d" : "#2563eb",
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={compactFactLabelStyle}>{label}</div>
        <div style={compactFactValueStyle}>{value}</div>
      </div>
    </div>
  );
}

const compactFactsStripStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(130px, 1fr))",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  background: "#ffffff",
  overflow: "hidden",
};

const compactFactStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "10px 12px",
  borderRight: "1px solid #e2e8f0",
};

const compactFactIconStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
};

const compactFactLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const compactFactValueStyle: React.CSSProperties = {
  marginTop: 2,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const overviewColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.9fr 1.1fr",
  gap: 12,
  alignItems: "stretch",
};

const summaryMetricStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const summaryMetricIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  background: "#f8fafc",
  fontSize: 18,
  fontWeight: 900,
  flexShrink: 0,
};

const summaryMetricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 700,
};

const summaryMetricValueStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 18,
  fontWeight: 900,
};

const progressHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 7,
  fontSize: 13,
  color: "#475569",
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  borderBottom: "1px solid #dbe4f0",
  overflowX: "auto",
};

function orderTabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
    background: "transparent",
    color: active ? "#1d4ed8" : "#475569",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: active ? 800 : 650,
    whiteSpace: "nowrap",
  };
}

const tabCounterStyle: React.CSSProperties = {
  minWidth: 19,
  height: 19,
  padding: "0 5px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#475569",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 800,
};

const sectionCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 10,
  background: "#ffffff",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 850,
  color: "#0f172a",
};

const sectionHintStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: "#64748b",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
  gap: 8,
  marginTop: 10,
};

const overviewRowsStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  marginTop: 8,
};

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={overviewRowStyle}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong style={{ color: "#0f172a", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

const overviewRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  padding: "8px 0",
  borderBottom: "1px solid #eef2f7",
  fontSize: 13,
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const done = status === "done";
  const progress = status === "in_progress";

  return {
    borderRadius: 999,
    padding: "6px 9px",
    background: done ? "#ecfdf5" : progress ? "#eff6ff" : "#fff7ed",
    color: done ? "#15803d" : progress ? "#1d4ed8" : "#c2410c",
    border: `1px solid ${
      done ? "#bbf7d0" : progress ? "#bfdbfe" : "#fed7aa"
    }`,
    fontSize: 12,
    fontWeight: 800,
  };
}

function CurrentWorkItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div style={currentWorkItemLabelStyle}>{label}</div>
      <div style={currentWorkItemValueStyle}>{value}</div>
    </div>
  );
}

const currentWorkCardStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: 10,
  background: "#f8fbff",
};

const currentWorkTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 8,
};

const currentWorkTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 850,
  color: "#0f172a",
};

const currentWorkStatusStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 800,
};

const currentWorkTimerStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "6px 9px",
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const currentWorkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
  gap: 10,
};

const currentWorkItemLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
};

const currentWorkItemValueStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 800,
};

const currentWorkActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 7,
  marginTop: 9,
  paddingTop: 9,
  borderTop: "1px solid #dbeafe",
  flexWrap: "wrap",
};

const currentWorkDetailsButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#2563eb",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: 750,
  fontSize: 11,
  lineHeight: 1.2,
};

const currentWorkFinishButtonStyle: React.CSSProperties = {
  background: "#f0fdf4",
  color: "#15803d",
  border: "1px solid #bbf7d0",
  borderRadius: 8,
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 11,
  lineHeight: 1.2,
};

const currentWorkEmptyStyle: React.CSSProperties = {
  padding: 11,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
};

const quickActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const operationRowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 11,
  background: "#ffffff",
};

const operationTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 8,
};

const operationNameStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 850,
  color: "#0f172a",
};

const operationNumberStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "1px solid #86efac",
  color: "#15803d",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  flexShrink: 0,
};

const operationMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
};

const operationQuantityStyle: React.CSSProperties = {
  color: "#334155",
  fontWeight: 800,
  whiteSpace: "nowrap",
  fontSize: 13,
};

const operationActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 10,
  flexWrap: "wrap",
};

const waitingMessageStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 9,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontWeight: 650,
  fontSize: 12,
};

const batchRowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 11,
  padding: "10px 11px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const batchTitleStyle: React.CSSProperties = {
  fontWeight: 850,
  color: "#0f172a",
};

const batchMetaStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
};

const batchActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  alignItems: "center",
  flexWrap: "wrap",
};

const qrCreatedBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  background: "#ecfdf5",
  color: "#15803d",
  border: "1px solid #bbf7d0",
  fontSize: 11,
  fontWeight: 800,
};

const printBatchButtonStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: "7px 10px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 11,
  whiteSpace: "nowrap",
};

const printCountBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 8px",
  background: "#f8fafc",
  color: "#475569",
  border: "1px solid #e2e8f0",
  fontSize: 11,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const lastPrintStyle: React.CSSProperties = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 650,
};

const defectButtonStyle: React.CSSProperties = {
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fdba74",
  borderRadius: 9,
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const qrStatsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(170px, 1fr))",
  gap: 8,
};

const qrTableStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 11,
  overflow: "hidden",
  marginTop: 8,
};

const qrTableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1.25fr 0.8fr",
  gap: 10,
  padding: "9px 11px",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const qrTableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.7fr 0.7fr 1.25fr 0.8fr",
  gap: 10,
  padding: "10px 11px",
  borderTop: "1px solid #eef2f7",
  alignItems: "center",
  fontSize: 12,
  color: "#334155",
};

const qrCreatedTextStyle: React.CSSProperties = {
  color: "#15803d",
  fontWeight: 800,
};

const notTrackedTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontWeight: 650,
};

const qrNoticeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "9px 11px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10040,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1380px, 97vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.34)",
  padding: 16,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const closeButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};
