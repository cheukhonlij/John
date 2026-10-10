import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, PackageMinus, PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { StockItem, StockItemKind, StockMovement, StockMovementType } from '../types';
import { STOCK_CATEGORIES } from '../data/defaults';
import { addDays, formatDateZh, formatNumber, todayISO } from '../utils/dates';
import {
  ITEM_KIND_LABELS,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATUS_STYLES,
  computeStockLevels,
  stockStatus,
} from '../utils/inventory';
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  TabBar,
  inputClass,
  newId,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui';

interface InventoryProps {
  items: StockItem[];
  movements: StockMovement[];
  isManager: boolean;
  currentUserName: string;
  initialTab?: InventoryTab;
  onSaveItems: (items: StockItem[]) => void;
  onSaveMovements: (movements: StockMovement[]) => void;
}

export type InventoryTab = 'stock' | 'in' | 'out' | 'waste' | 'count' | 'log';

const MOVEMENT_BADGE: Record<StockMovementType, string> = {
  in: 'bg-emerald-600 text-white',
  out: 'bg-blue-600 text-white',
  waste: 'bg-rose-600 text-white',
  count: 'bg-slate-700 text-white',
};

const EXPIRY_WARNING_DAYS = 14;

export const Inventory: React.FC<InventoryProps> = ({
  items,
  movements,
  isManager,
  currentUserName,
  initialTab = 'stock',
  onSaveItems,
  onSaveMovements,
}) => {
  const [tab, setTab] = useState<InventoryTab>(initialTab);
  const levels = useMemo(() => computeStockLevels(movements), [movements]);
  const activeItems = items.filter((i) => !i.isArchived);

  const addMovements = (newMovements: StockMovement[]) => onSaveMovements([...movements, ...newMovements]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INVENTORY"
        title="倉存・入貨・落貨"
        subtitle="每次入貨、落貨、損耗同盤點都要喺度記錄，系統會自動計返現有存貨。"
      />

      <TabBar
        tabs={[
          { id: 'stock' as const, label: '倉存' },
          { id: 'in' as const, label: '入貨' },
          { id: 'out' as const, label: '落貨' },
          { id: 'waste' as const, label: '損耗' },
          { id: 'count' as const, label: '盤點' },
          { id: 'log' as const, label: '紀錄', count: movements.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'stock' && (
        <StockTab items={items} movements={movements} levels={levels} isManager={isManager} onSaveItems={onSaveItems} />
      )}
      {(tab === 'in' || tab === 'out' || tab === 'waste') && (
        <MovementForm
          key={tab}
          type={tab}
          items={activeItems}
          levels={levels}
          movements={movements}
          operator={currentUserName}
          onSubmit={addMovements}
        />
      )}
      {tab === 'count' && <CountSheet items={activeItems} levels={levels} operator={currentUserName} onSubmit={addMovements} />}
      {tab === 'log' && (
        <MovementLog
          movements={movements}
          isManager={isManager}
          onDelete={(id) => onSaveMovements(movements.filter((m) => m.id !== id))}
        />
      )}
    </div>
  );
};

// ---------- Stock overview ----------

const StockTab: React.FC<{
  items: StockItem[];
  movements: StockMovement[];
  levels: Map<string, number>;
  isManager: boolean;
  onSaveItems: (items: StockItem[]) => void;
}> = ({ items, movements, levels, isManager, onSaveItems }) => {
  const today = todayISO();
  const [kind, setKind] = useState<'all' | StockItemKind>('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);

  const itemsWithRecords = new Set(movements.map((m) => m.itemId));
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const q = search.trim().toLowerCase();

  const rows = items
    .filter((i) => showArchived || !i.isArchived)
    .filter((i) => kind === 'all' || i.kind === kind)
    .filter((i) => category === 'all' || i.category === category)
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    .map((i) => {
      const qty = levels.get(i.id) || 0;
      return { item: i, qty, status: stockStatus(qty, i.reorderLevel, itemsWithRecords.has(i.id)) };
    })
    .filter((r) => !lowOnly || r.status === 'low' || r.status === 'out');

  const alertCount = items.filter((i) => {
    if (i.isArchived) return false;
    const s = stockStatus(levels.get(i.id) || 0, i.reorderLevel, itemsWithRecords.has(i.id));
    return s === 'low' || s === 'out';
  }).length;

  // Received batches that expire soon while the item still has stock.
  const expiring = movements
    .filter(
      (m) =>
        m.type === 'in' &&
        m.expiryDate &&
        m.expiryDate <= addDays(today, EXPIRY_WARNING_DAYS) &&
        (levels.get(m.itemId) || 0) > 0
    )
    .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

  return (
    <div className="space-y-4">
      {expiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4">
          <p className="text-xs font-black text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {EXPIRY_WARNING_DAYS} 日內到期嘅入貨批次（請核對實物，已用完可以忽略）
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {expiring.map((m) => (
              <span
                key={m.id}
                className={`text-xs font-bold px-2 py-1 border ${m.expiryDate! < today ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-amber-300 text-amber-900'}`}
              >
                {m.itemName} {m.batchNo && `#${m.batchNo}`} · {m.expiryDate! < today ? '已過期' : '到期'} {m.expiryDate}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 p-3 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input className={`${inputClass} pl-9`} placeholder="搜尋貨品…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} lg:w-40`} value={kind} onChange={(e) => setKind(e.target.value as 'all' | StockItemKind)}>
          <option value="all">成品＋原料</option>
          <option value="product">只睇成品</option>
          <option value="material">只睇原料／物料</option>
        </select>
        <select className={`${inputClass} lg:w-44`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">全部類別</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setLowOnly(!lowOnly)}
          className={`px-3 py-2 text-xs font-black border whitespace-nowrap cursor-pointer ${lowOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-slate-200 hover:border-slate-900'}`}
        >
          要補貨 ({alertCount})
        </button>
      </div>

      <Panel
        title={`貨品 (${rows.length})`}
        actions={
          isManager && (
            <>
              <label className="text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                顯示已停用
              </label>
              <button
                onClick={() => setEditing({ id: '', kind: 'product', name: '', category: STOCK_CATEGORIES[0], unit: '包' })}
                className={primaryButtonClass}
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                新增貨品
              </button>
            </>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">貨品</th>
                <th className="py-3 px-3">類別</th>
                <th className="py-3 px-3 text-right">現有存貨</th>
                <th className="py-3 px-3 text-right">安全存量</th>
                <th className="py-3 px-3">狀態</th>
                {isManager && <th className="py-3 px-5 text-right">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="冇符合嘅貨品" />
                  </td>
                </tr>
              ) : (
                rows.map(({ item, qty, status }) => (
                  <tr key={item.id} className={`hover:bg-slate-50 ${item.isArchived ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-5">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {ITEM_KIND_LABELS[item.kind]}
                        {item.supplier && ` · ${item.supplier}`}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs font-bold text-slate-600">{item.category}</td>
                    <td className={`py-3 px-3 text-right font-mono font-black text-base ${qty < 0 ? 'text-rose-600' : ''}`}>
                      {formatNumber(qty, 3)} <span className="text-xs font-sans text-slate-500">{item.unit}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {item.reorderLevel !== undefined && item.reorderLevel !== null ? item.reorderLevel : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-black px-2 py-1 border ${STOCK_STATUS_STYLES[status].className}`}>
                        {STOCK_STATUS_STYLES[status].label}
                      </span>
                    </td>
                    {isManager && (
                      <td className="py-3 px-5 text-right">
                        <button onClick={() => setEditing({ ...item })} className="px-2.5 py-1 text-xs font-black border border-slate-200 hover:bg-slate-900 hover:text-white cursor-pointer">
                          編輯
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {editing && (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            onSaveItems(item.id ? items.map((i) => (i.id === item.id ? item : i)) : [...items, { ...item, id: newId('item') }]);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const ItemEditor: React.FC<{ item: StockItem; onClose: () => void; onSave: (item: StockItem) => void }> = ({
  item,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<StockItem>(item);
  const set = (patch: Partial<StockItem>) => setForm({ ...form, ...patch });

  return (
    <Modal eyebrow="STOCK ITEM" title={item.id ? `編輯：${item.name}` : '新增貨品'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.unit.trim()) return;
          onSave({ ...form, name: form.name.trim(), unit: form.unit.trim(), supplier: form.supplier?.trim() || undefined });
        }}
        className="space-y-4"
      >
        <Field label="種類">
          <div className="grid grid-cols-2 gap-2">
            {(['product', 'material'] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => set({ kind: k })}
                className={`py-2.5 text-xs font-black border cursor-pointer ${form.kind === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:border-slate-900'}`}
              >
                {ITEM_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="名稱" required>
          <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="類別">
            <input className={inputClass} list="stock-categories" value={form.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="stock-categories">
              {STOCK_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="單位" required>
            <input className={inputClass} value={form.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="包 / kg / 個" required />
          </Field>
          <Field label="安全存量" hint="存貨跌到呢個數或以下會提示補貨">
            <input
              type="number"
              min="0"
              step="any"
              className={`${inputClass} font-mono`}
              value={form.reorderLevel ?? ''}
              onChange={(e) => set({ reorderLevel: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
          <Field label="供應商（可選）">
            <input className={inputClass} value={form.supplier || ''} onChange={(e) => set({ supplier: e.target.value })} />
          </Field>
        </div>
        {item.id && (
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={!!form.isArchived} onChange={(e) => set({ isArchived: e.target.checked })} />
            停用（唔再喺入貨／落貨清單顯示，紀錄會保留）
          </label>
        )}
        <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            取消
          </button>
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            儲存
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ---------- In / out / waste form ----------

interface Line {
  key: string;
  itemId: string;
  qty: string;
  batchNo: string;
  expiryDate: string;
}

const blankLine = (): Line => ({ key: newId('line'), itemId: '', qty: '', batchNo: '', expiryDate: '' });

const FORM_TEXT: Record<'in' | 'out' | 'waste', { title: string; partner: string; partnerHints: string[]; button: string; icon: React.ReactNode }> = {
  in: {
    title: '入貨／生產入倉',
    partner: '供應商／來源',
    partnerHints: ['自家生產'],
    button: '確認入貨',
    icon: <PackagePlus className="w-4 h-4" />,
  },
  out: {
    title: '落貨／出貨／領料',
    partner: '客戶／用途',
    partnerHints: ['生產領用'],
    button: '確認落貨',
    icon: <PackageMinus className="w-4 h-4" />,
  },
  waste: {
    title: '損耗／報廢',
    partner: '原因',
    partnerHints: ['過期', '包裝破損', '品質問題', '試食'],
    button: '確認損耗',
    icon: <Trash2 className="w-4 h-4" />,
  },
};

const MovementForm: React.FC<{
  type: 'in' | 'out' | 'waste';
  items: StockItem[];
  levels: Map<string, number>;
  movements: StockMovement[];
  operator: string;
  onSubmit: (movements: StockMovement[]) => void;
}> = ({ type, items, levels, movements, operator: defaultOperator, onSubmit }) => {
  const text = FORM_TEXT[type];
  const [date, setDate] = useState(todayISO());
  const [partner, setPartner] = useState('');
  const [refNo, setRefNo] = useState('');
  const [operator, setOperator] = useState(defaultOperator);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Suggest partners already used for this movement type.
  const partnerOptions = Array.from(
    new Set([...text.partnerHints, ...movements.filter((m) => m.type === type && m.partner).map((m) => m.partner!)])
  );
  const itemById = new Map(items.map((i) => [i.id, i]));
  const setLine = (key: string, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const filled = lines.filter((l) => l.itemId || l.qty);
    if (filled.length === 0) return setError('請最少輸入一項貨品');
    if (filled.some((l) => !l.itemId || !(Number(l.qty) > 0))) return setError('每行都要揀貨品，同埋輸入大過 0 嘅數量');
    setError('');

    const now = new Date().toISOString();
    const created = filled.map<StockMovement>((l) => {
      const item = itemById.get(l.itemId)!;
      const qty = Number(l.qty);
      return {
        id: newId('mv'),
        date,
        type,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        qty: type === 'in' ? qty : -qty,
        partner: partner.trim() || undefined,
        refNo: refNo.trim() || undefined,
        batchNo: type === 'in' ? l.batchNo.trim() || undefined : undefined,
        expiryDate: type === 'in' ? l.expiryDate || undefined : undefined,
        operator: operator.trim() || undefined,
        note: note.trim() || undefined,
        createdAt: now,
      };
    });
    onSubmit(created);
    setMessage(`已記錄 ${created.length} 項${MOVEMENT_TYPE_LABELS[type]}。`);
    setLines([blankLine()]);
    setRefNo('');
    setNote('');
  };

  const groupedItems = (['product', 'material'] as const).map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) }));

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 shadow-xs">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
        {text.icon}
        <h3 className="font-black text-sm">{text.title}</h3>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="日期" required>
            <input type="date" className={`${inputClass} font-mono`} value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={text.partner}>
            <input className={inputClass} list={`partners-${type}`} value={partner} onChange={(e) => setPartner(e.target.value)} />
            <datalist id={`partners-${type}`}>
              {partnerOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          {type !== 'waste' && (
            <Field label="單號（送貨單／訂單）">
              <input className={`${inputClass} font-mono`} value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            </Field>
          )}
          <Field label="經手人">
            <input className={inputClass} value={operator} onChange={(e) => setOperator(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">貨品</p>
          {lines.map((line) => {
            const item = itemById.get(line.itemId);
            const stock = item ? levels.get(item.id) || 0 : 0;
            const short = type !== 'in' && item && Number(line.qty) > stock;
            return (
              <div key={line.key} className="border border-slate-200 p-2.5 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className={`${inputClass} flex-1`} value={line.itemId} onChange={(e) => setLine(line.key, { itemId: e.target.value })}>
                    <option value="">揀貨品…</option>
                    {groupedItems.map((g) => (
                      <optgroup key={g.kind} label={ITEM_KIND_LABELS[g.kind]}>
                        {g.items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}（存 {formatNumber(levels.get(i.id) || 0, 3)} {i.unit}）
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="數量"
                      className={`${inputClass} font-mono w-32`}
                      value={line.qty}
                      onChange={(e) => setLine(line.key, { qty: e.target.value })}
                    />
                    <span className="text-sm font-bold text-slate-500 w-8">{item?.unit}</span>
                    <button
                      type="button"
                      onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [blankLine()])}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {type === 'in' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={`${inputClass} text-xs`} placeholder="批次（可選）" value={line.batchNo} onChange={(e) => setLine(line.key, { batchNo: e.target.value })} />
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      到期日
                      <input type="date" className={`${inputClass} text-xs font-mono`} value={line.expiryDate} onChange={(e) => setLine(line.key, { expiryDate: e.target.value })} />
                    </label>
                  </div>
                )}
                {short && (
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    系統存貨得 {formatNumber(stock, 3)} {item?.unit}，記錄後會變負數，請檢查或者先盤點。
                  </p>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => setLines([...lines, blankLine()])} className={secondaryButtonClass}>
            <Plus className="w-4 h-4" />
            加一行
          </button>
        </div>

        <Field label="備註">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
        {message && <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5">✓ {message}</p>}

        <div className="flex justify-end">
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            {text.button}
          </button>
        </div>
      </div>
    </form>
  );
};

// ---------- Stock count ----------

const CountSheet: React.FC<{
  items: StockItem[];
  levels: Map<string, number>;
  operator: string;
  onSubmit: (movements: StockMovement[]) => void;
}> = ({ items, levels, operator: defaultOperator, onSubmit }) => {
  const [date, setDate] = useState(todayISO());
  const [operator, setOperator] = useState(defaultOperator);
  const [category, setCategory] = useState('all');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const rows = items.filter((i) => category === 'all' || i.category === category);
  const entered = Object.entries(counts).filter(([, v]) => v.trim() !== '' && !isNaN(Number(v)));

  const handleSubmit = () => {
    if (entered.length === 0) return;
    if (!confirm(`提交 ${entered.length} 項盤點結果？系統存貨會調整到實際數量。`)) return;
    const now = new Date().toISOString();
    const created = entered.map<StockMovement>(([itemId, value]) => {
      const item = items.find((i) => i.id === itemId)!;
      const counted = Number(value);
      const system = levels.get(itemId) || 0;
      return {
        id: newId('mv'),
        date,
        type: 'count',
        itemId,
        itemName: item.name,
        unit: item.unit,
        qty: Math.round((counted - system) * 1000) / 1000,
        countedQty: counted,
        operator: operator.trim() || undefined,
        note: '盤點',
        createdAt: now,
      };
    });
    onSubmit(created);
    setCounts({});
    setMessage(`已提交 ${created.length} 項盤點。`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <Field label="盤點日期">
          <input type="date" className={`${inputClass} font-mono`} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="盤點人">
          <input className={inputClass} value={operator} onChange={(e) => setOperator(e.target.value)} />
        </Field>
        <Field label="類別">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">全部</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={handleSubmit} disabled={entered.length === 0} className={`${primaryButtonClass} justify-center`}>
          <ClipboardCheck className="w-4 h-4" />
          提交盤點 ({entered.length})
        </button>
      </div>
      {message && <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5">✓ {message}</p>}
      <Panel title="逐項輸入實際數量（留空＝唔盤點呢項）">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">貨品</th>
                <th className="py-3 px-3 text-right">系統數量</th>
                <th className="py-3 px-3 w-40">實際數量</th>
                <th className="py-3 px-5 text-right">差異</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item) => {
                const system = levels.get(item.id) || 0;
                const value = counts[item.id] ?? '';
                const diff = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) - system : null;
                const bigDiff = diff !== null && system !== 0 && Math.abs(diff / system) > 0.05;
                return (
                  <tr key={item.id} className={value ? 'bg-blue-50/40' : ''}>
                    <td className="py-2.5 px-5">
                      <div className="font-bold">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.category}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatNumber(system, 3)} {item.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={`${inputClass} font-mono`}
                        value={value}
                        onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                      />
                    </td>
                    <td className={`py-2.5 px-5 text-right font-mono font-black ${diff === null ? 'text-slate-300' : diff === 0 ? 'text-emerald-600' : bigDiff ? 'text-rose-600' : 'text-amber-600'}`}>
                      {diff === null ? '—' : `${diff > 0 ? '+' : ''}${formatNumber(diff, 3)}`}
                      {bigDiff && <div className="text-[10px] font-sans">差異 &gt;5%，請再點一次</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

// ---------- Movement log ----------

const PAGE_SIZE = 100;

const MovementLog: React.FC<{
  movements: StockMovement[];
  isManager: boolean;
  onDelete: (id: string) => void;
}> = ({ movements, isManager, onDelete }) => {
  const [type, setType] = useState<'all' | StockMovementType>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const q = search.trim().toLowerCase();
  const rows = movements
    .filter((m) => type === 'all' || m.type === type)
    .filter((m) => !from || m.date >= from)
    .filter((m) => !to || m.date <= to)
    .filter(
      (m) =>
        !q ||
        [m.itemName, m.partner, m.refNo, m.batchNo, m.operator, m.note].some((v) => v?.toLowerCase().includes(q))
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 p-3 grid grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px] gap-2">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input className={`${inputClass} pl-9`} placeholder="搜尋貨品、客戶、供應商、單號…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as 'all' | StockMovementType)}>
          <option value="all">全部類型</option>
          {(Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input type="date" className={`${inputClass} font-mono`} value={from} onChange={(e) => setFrom(e.target.value)} title="由" />
        <input type="date" className={`${inputClass} font-mono`} value={to} onChange={(e) => setTo(e.target.value)} title="至" />
      </div>
      <Panel title={`紀錄 (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="冇紀錄" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">日期</th>
                  <th className="py-3 px-3">類型</th>
                  <th className="py-3 px-3">貨品</th>
                  <th className="py-3 px-3 text-right">數量</th>
                  <th className="py-3 px-3">對象／單號</th>
                  <th className="py-3 px-3">批次／到期</th>
                  <th className="py-3 px-3">經手人／備註</th>
                  {isManager && <th className="py-3 px-5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, limit).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-5 font-mono text-xs whitespace-nowrap">{formatDateZh(m.date)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 whitespace-nowrap ${MOVEMENT_BADGE[m.type]}`}>{MOVEMENT_TYPE_LABELS[m.type]}</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold">{m.itemName}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-black whitespace-nowrap ${m.qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {m.qty > 0 ? '+' : ''}
                      {formatNumber(m.qty, 3)} {m.unit}
                      {m.type === 'count' && m.countedQty !== undefined && (
                        <div className="text-[10px] font-sans font-bold text-slate-500">實點 {formatNumber(m.countedQty, 3)}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {m.partner}
                      {m.refNo && <div className="font-mono text-slate-500">{m.refNo}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono">
                      {m.batchNo}
                      {m.expiryDate && <div className="text-slate-500">到期 {m.expiryDate}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {m.operator}
                      {m.note && <div className="text-slate-500">{m.note}</div>}
                    </td>
                    {isManager && (
                      <td className="py-2.5 px-5 text-right">
                        <button
                          onClick={() => confirm(`刪除呢條${MOVEMENT_TYPE_LABELS[m.type]}紀錄？存貨數會跟住改。`) && onDelete(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > limit && (
              <div className="p-3 text-center border-t border-slate-100">
                <button onClick={() => setLimit(limit + PAGE_SIZE)} className={`${secondaryButtonClass} mx-auto`}>
                  顯示更多（尚有 {rows.length - limit} 條）
                </button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};
