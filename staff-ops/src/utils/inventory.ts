import { StockItem, StockItemKind, StockMovement, StockMovementType } from '../types';

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: '入貨',
  out: '落貨',
  waste: '損耗',
  count: '盤點調整',
};

export const ITEM_KIND_LABELS: Record<StockItemKind, string> = {
  product: '成品',
  material: '原料／物料',
};

/** Current quantity per item id: every movement stores its signed change. */
export const computeStockLevels = (movements: StockMovement[]): Map<string, number> => {
  const levels = new Map<string, number>();
  movements.forEach((m) => {
    levels.set(m.itemId, Math.round(((levels.get(m.itemId) || 0) + m.qty) * 1000) / 1000);
  });
  return levels;
};

export type StockStatus = 'out' | 'low' | 'ok' | 'untracked';

export const STOCK_STATUS_STYLES: Record<StockStatus, { label: string; className: string }> = {
  out: { label: '冇貨', className: 'bg-rose-600 text-white border-rose-600' },
  low: { label: '低存量', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  ok: { label: '正常', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  untracked: { label: '未有紀錄', className: 'bg-slate-50 text-slate-400 border-slate-200' },
};

export const stockStatus = (
  qty: number,
  reorderLevel: number | undefined,
  hasRecords: boolean
): StockStatus => {
  if (reorderLevel === undefined || reorderLevel === null) {
    if (!hasRecords) return 'untracked';
    return qty <= 0 ? 'out' : 'ok';
  }
  if (qty <= 0) return 'out';
  return qty <= reorderLevel ? 'low' : 'ok';
};

export const lowStockItems = (items: StockItem[], levels: Map<string, number>) =>
  items.filter(
    (item) =>
      !item.isArchived &&
      item.reorderLevel !== undefined &&
      item.reorderLevel !== null &&
      (levels.get(item.id) || 0) <= item.reorderLevel
  );
