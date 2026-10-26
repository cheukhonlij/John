import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Eraser, PenLine, Pencil, Plus, Printer, Search, Trash2, Truck } from 'lucide-react';
import { DeliveryCustomer, DeliveryLine, DeliveryNote, StockItem, StockMovement } from '../types';
import { formatDateZh, formatNumber, todayISO } from '../utils/dates';
import { ITEM_KIND_LABELS } from '../utils/inventory';
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
  printPage,
  secondaryButtonClass,
} from './ui';

type DeliveryTab = 'pending' | 'signed' | 'customers';

interface DeliveryNotesProps {
  notes: DeliveryNote[];
  customers: DeliveryCustomer[];
  items: StockItem[];
  movements: StockMovement[];
  companyName: string;
  isManager: boolean;
  currentUserName: string;
  /** Cloud mode copies customers over from 開單台. */
  customersFromInvoice: boolean;
  onSaveNotes: (notes: DeliveryNote[]) => void;
  onSaveCustomers: (customers: DeliveryCustomer[]) => void;
  onSaveMovements: (movements: StockMovement[]) => void;
}

/** DN + YYYYMMDD + "-" + the next two-digit number for that day. */
export const nextDeliveryNo = (notes: DeliveryNote[], date: string, excludeId?: string) => {
  const base = `DN${date.replace(/-/g, '')}-`;
  const used = notes
    .filter((n) => n.id !== excludeId && n.no.startsWith(base))
    .map((n) => parseInt(n.no.slice(base.length), 10) || 0);
  return base + String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0');
};

const receivedOf = (note: DeliveryNote, i: number) => note.receivedQty?.[i] ?? note.lines[i].qty;

const formatSignedAt = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const linesSummary = (note: DeliveryNote) =>
  note.lines.map((l) => `${l.itemName} × ${formatNumber(l.qty, 3)} ${l.unit}`).join('、');

export const DeliveryNotes: React.FC<DeliveryNotesProps> = ({
  notes,
  customers,
  items,
  movements,
  companyName,
  isManager,
  currentUserName,
  customersFromInvoice,
  onSaveNotes,
  onSaveCustomers,
  onSaveMovements,
}) => {
  const [tab, setTab] = useState<DeliveryTab>('pending');
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeliveryNote | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<DeliveryCustomer | null>(null);

  const pending = notes.filter((n) => n.status === 'pending').sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
  const signed = notes.filter((n) => n.status === 'signed').sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  const q = search.trim().toLowerCase();
  const matches = (n: DeliveryNote) => !q || n.customerName.toLowerCase().includes(q) || n.no.toLowerCase().includes(q);

  const viewing = notes.find((n) => n.id === viewingId);
  const signing = notes.find((n) => n.id === signingId);

  const blankNote = (): DeliveryNote => ({
    id: '',
    no: '',
    date: todayISO(),
    customerId: '',
    customerName: '',
    contact: '',
    phone: '',
    address: '',
    lines: [],
    notes: '',
    createdAt: '',
    status: 'pending',
  });

  const saveNote = (note: DeliveryNote) => {
    const existing = notes.find((n) => n.id === note.id);
    if (existing) {
      // The number carries the date, so a moved delivery gets a new one.
      const no = existing.date === note.date ? existing.no : nextDeliveryNo(notes, note.date, note.id);
      onSaveNotes(notes.map((n) => (n.id === note.id ? { ...note, no } : n)));
    } else {
      const created: DeliveryNote = {
        ...note,
        id: newId('dn'),
        no: nextDeliveryNo(notes, note.date),
        createdBy: currentUserName || undefined,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      onSaveNotes([...notes, created]);
      setViewingId(created.id);
    }
    setEditing(null);
  };

  const deleteNote = (note: DeliveryNote) => {
    if (!confirm(`刪除送貨單 ${note.no}（${note.customerName}）？`)) return;
    onSaveNotes(notes.filter((n) => n.id !== note.id));
    setViewingId(null);
  };

  const signNote = (note: DeliveryNote, sign: Pick<DeliveryNote, 'receiverName' | 'signature' | 'signedBy' | 'receivedQty' | 'receivedNotes'>) => {
    const signedAt = new Date().toISOString();
    onSaveNotes(notes.map((n) => (n.id === note.id ? { ...n, ...sign, status: 'signed', signedAt } : n)));
    // What the customer took leaves the stock, recorded against the note's number.
    const date = todayISO();
    const out = note.lines
      .map<StockMovement>((line, i) => ({
        id: `mv_${note.id}_${i}`,
        date,
        type: 'out',
        itemId: line.itemId,
        itemName: line.itemName,
        unit: line.unit,
        qty: -(sign.receivedQty?.[i] ?? line.qty),
        partner: note.customerName,
        refNo: note.no,
        operator: sign.signedBy || undefined,
        note: '送貨單簽收',
        createdAt: signedAt,
      }))
      .filter((m) => m.qty !== 0);
    if (out.length) onSaveMovements([...movements, ...out]);
    setSigningId(null);
  };

  const noteActions = (note: DeliveryNote, compact: boolean) => (
    <>
      {note.status === 'pending' && (
        <button onClick={() => setSigningId(note.id)} className={primaryButtonClass}>
          <PenLine className="w-4 h-4" />
          簽收
        </button>
      )}
      {isManager && note.status === 'pending' && (
        <>
          <button onClick={() => setEditing(note)} className={secondaryButtonClass}>
            <Pencil className="w-4 h-4" />
            {!compact && '編輯'}
          </button>
          <button onClick={() => deleteNote(note)} className={secondaryButtonClass} title="刪除">
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </>
      )}
    </>
  );

  const modals = (
    <>
      {editing && (
        <NoteForm
          note={editing}
          customers={customers}
          items={items}
          onClose={() => setEditing(null)}
          onSave={saveNote}
        />
      )}
      {signing && (
        <SignForm note={signing} defaultSigner={currentUserName} onClose={() => setSigningId(null)} onSign={(s) => signNote(signing, s)} />
      )}
      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSave={(c) => {
            onSaveCustomers(
              customers.some((x) => x.id === c.id) ? customers.map((x) => (x.id === c.id ? c : x)) : [...customers, { ...c, id: newId('dc') }]
            );
            setEditingCustomer(null);
          }}
        />
      )}
    </>
  );

  if (viewing) {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button onClick={() => setViewingId(null)} className={secondaryButtonClass}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <div className="flex-1" />
          {noteActions(viewing, false)}
          <button onClick={() => printPage('portrait')} className={secondaryButtonClass}>
            <Printer className="w-4 h-4" />
            列印
          </button>
        </div>
        <NoteDocument note={viewing} companyName={companyName} />
        {modals}
      </div>
    );
  }

  const list = (rows: DeliveryNote[], emptyTitle: string) => (
    <Panel>
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} hint={isManager && tab === 'pending' ? '撳「開送貨單」新增' : undefined} />
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((n) => (
            <div key={n.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={() => setViewingId(n.id)} className="flex-1 min-w-0 text-left cursor-pointer group">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{n.no}</span>
                  <span className="text-xs font-black text-slate-900">{formatDateZh(n.date)}</span>
                  {n.status === 'signed' ? (
                    <span className="text-[11px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200">已簽收</span>
                  ) : (
                    <span className="text-[11px] font-black px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200">待送</span>
                  )}
                  {n.invoiceNo && <span className="text-[11px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-600">已開單</span>}
                </div>
                <p className="font-black text-base text-slate-900 mt-1 group-hover:underline">{n.customerName}</p>
                {n.address && <p className="text-xs text-slate-500 font-medium">{n.address}</p>}
                <p className="text-xs text-slate-600 font-bold mt-1 truncate">{linesSummary(n)}</p>
                {n.status === 'signed' && (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    收貨人：{n.receiverName} · {formatSignedAt(n.signedAt)}
                  </p>
                )}
              </button>
              <div className="flex flex-wrap gap-2 shrink-0">{noteActions(n, true)}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DELIVERY NOTES"
        title="送貨單"
        subtitle="主管開送貨單；送到時客人收貨人喺手機簽名，簽收後倉存自動扣數。送貨單冇價錢。"
        actions={
          isManager && (
            <button onClick={() => setEditing(blankNote())} className={primaryButtonClass}>
              <Plus className="w-4 h-4 text-emerald-400" />
              開送貨單
            </button>
          )
        }
      />

      <TabBar
        tabs={[
          { id: 'pending' as const, label: '待送', count: pending.length },
          { id: 'signed' as const, label: '已簽收', count: signed.length },
          { id: 'customers' as const, label: '客戶', count: customers.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab !== 'customers' && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${inputClass} pl-9`} placeholder="搜尋客戶或者送貨單號…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {tab === 'pending' && list(pending.filter(matches), '冇待送嘅送貨單')}
      {tab === 'signed' && (
        <>
          {list(signed.filter(matches), '最近兩個月冇已簽收嘅送貨單')}
          <p className="text-xs text-slate-500 font-medium">顯示最近兩個月。</p>
        </>
      )}
      {tab === 'customers' && (
        <CustomerList
          customers={customers}
          isManager={isManager}
          fromInvoice={customersFromInvoice}
          onAdd={() => setEditingCustomer({ id: '', name: '' })}
          onEdit={setEditingCustomer}
          onDelete={(c) => confirm(`刪除客戶「${c.name}」？之前嘅送貨單唔受影響。`) && onSaveCustomers(customers.filter((x) => x.id !== c.id))}
        />
      )}
      {modals}
    </div>
  );
};

// ---------- The printable note ----------

const NoteDocument: React.FC<{ note: DeliveryNote; companyName: string }> = ({ note, companyName }) => {
  const signed = note.status === 'signed';
  return (
    <div className="print-area bg-white border border-slate-200 shadow-xs p-5 sm:p-10 max-w-3xl mx-auto space-y-6 text-slate-900">
      <div className="flex flex-wrap justify-between items-start gap-4 border-b-2 border-slate-900 pb-4">
        <div>
          <p className="text-xl sm:text-2xl font-black tracking-tight uppercase">{companyName}</p>
          <p className="text-2xl sm:text-3xl font-black mt-1">
            送貨單 <span className="text-sm font-black tracking-widest text-slate-500">DELIVERY NOTE</span>
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="font-mono text-sm font-bold">{note.no}</p>
          <p className="text-sm font-bold">日期：{note.date}</p>
          {signed ? (
            <p className="text-xs font-black text-emerald-700">已簽收</p>
          ) : (
            <p className="text-xs font-black text-amber-700 no-print">待送</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <p>
          <span className="text-xs font-black text-slate-500 mr-2">客戶</span>
          <span className="font-black">{note.customerName}</span>
        </p>
        {note.contact && (
          <p>
            <span className="text-xs font-black text-slate-500 mr-2">聯絡人</span>
            <span className="font-bold">{note.contact}</span>
          </p>
        )}
        {note.phone && (
          <p>
            <span className="text-xs font-black text-slate-500 mr-2">電話</span>
            <span className="font-bold font-mono">{note.phone}</span>
          </p>
        )}
        {note.address && (
          <p className="sm:col-span-2">
            <span className="text-xs font-black text-slate-500 mr-2">地址</span>
            <span className="font-bold">{note.address}</span>
          </p>
        )}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-y border-slate-900 text-left text-xs font-black">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2 pr-2">貨品</th>
            <th className="py-2 pr-2 text-right">數量</th>
            <th className="py-2 pr-2 w-12">單位</th>
            {signed && <th className="py-2 text-right">實收</th>}
          </tr>
        </thead>
        <tbody>
          {note.lines.map((line, i) => {
            const got = receivedOf(note, i);
            return (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-2 pr-2 font-mono text-slate-500">{i + 1}</td>
                <td className="py-2 pr-2 font-bold">{line.itemName}</td>
                <td className="py-2 pr-2 text-right font-mono font-bold">{formatNumber(line.qty, 3)}</td>
                <td className="py-2 pr-2">{line.unit}</td>
                {signed && (
                  <td className={`py-2 text-right font-mono font-bold ${got !== line.qty ? 'text-rose-700' : ''}`}>{formatNumber(got, 3)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {note.notes && (
        <p className="text-sm">
          <span className="text-xs font-black text-slate-500 mr-2">備註</span>
          {note.notes}
        </p>
      )}
      {note.receivedNotes && (
        <p className="text-sm">
          <span className="text-xs font-black text-slate-500 mr-2">收貨備註</span>
          {note.receivedNotes}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-6 pt-2">
        <div>
          <p className="text-xs font-black text-slate-500 mb-1">收貨人簽名</p>
          <div className="h-28 border-b-2 border-slate-900 flex items-end">
            {note.signature && <img src={note.signature} alt="收貨人簽名" className="max-h-28 max-w-full" />}
          </div>
          <p className="text-sm mt-2">
            <span className="text-xs font-black text-slate-500 mr-2">收貨人姓名</span>
            <span className="font-bold">{note.receiverName}</span>
          </p>
          <p className="text-sm mt-1">
            <span className="text-xs font-black text-slate-500 mr-2">簽收時間</span>
            <span className="font-mono font-bold">{formatSignedAt(note.signedAt)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500 mb-1">送貨人</p>
          <div className="h-28 border-b-2 border-slate-900 flex items-end">
            <span className="font-bold pb-1">{note.signedBy}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">收貨時請核對貨品同數量。如有短缺或者損壞，請喺簽收前通知送貨人。</p>
    </div>
  );
};

// ---------- Manager: new or edited note ----------

interface FormLine {
  key: string;
  itemId: string;
  qty: string;
}

const NoteForm: React.FC<{
  note: DeliveryNote;
  customers: DeliveryCustomer[];
  items: StockItem[];
  onClose: () => void;
  onSave: (note: DeliveryNote) => void;
}> = ({ note, customers, items, onClose, onSave }) => {
  const [form, setForm] = useState<DeliveryNote>(note);
  const [lines, setLines] = useState<FormLine[]>(
    note.lines.length
      ? note.lines.map((l) => ({ key: newId('line'), itemId: l.itemId, qty: String(l.qty) }))
      : [{ key: newId('line'), itemId: '', qty: '' }]
  );
  const [error, setError] = useState('');
  const set = (patch: Partial<DeliveryNote>) => setForm({ ...form, ...patch });
  const setLine = (key: string, patch: Partial<FormLine>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const active = items.filter((i) => !i.isArchived || lines.some((l) => l.itemId === i.id));
  const groups = (['product', 'material'] as const).map((kind) => ({ kind, items: active.filter((i) => i.kind === kind) }));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    set(
      c
        ? { customerId: c.id, customerName: c.company ? `${c.name}（${c.company}）` : c.name, contact: c.contact || '', phone: c.phone || '', address: c.address || '' }
        : { customerId: '' }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) return setError('請揀客戶或者輸入客戶名稱');
    const filled = lines.filter((l) => l.itemId || l.qty);
    if (filled.length === 0) return setError('請最少輸入一項貨品');
    if (filled.some((l) => !l.itemId || !(Number(l.qty) > 0))) return setError('每行都要揀貨品，同埋輸入大過 0 嘅數量');
    const out: DeliveryLine[] = filled.map((l) => {
      const item = itemById.get(l.itemId)!;
      return { itemId: item.id, itemName: item.name, unit: item.unit, qty: Number(l.qty) };
    });
    onSave({
      ...form,
      customerName: form.customerName.trim(),
      contact: form.contact?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      lines: out,
    });
  };

  return (
    <Modal eyebrow="DELIVERY NOTE" title={note.id ? `編輯送貨單 ${note.no}` : '開送貨單'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="送貨日期" required>
            <input type="date" className={`${inputClass} font-mono`} value={form.date} onChange={(e) => set({ date: e.target.value })} required />
          </Field>
          <Field label="客戶" hint={customers.length ? undefined : '未有客戶：先喺「客戶」分頁加，或者直接喺下面輸入'}>
            <select className={inputClass} value={form.customerId} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">揀客戶…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? `（${c.company}）` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="客戶名稱（印喺送貨單）" required>
            <input className={inputClass} value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} />
          </Field>
          <Field label="聯絡人">
            <input className={inputClass} value={form.contact || ''} onChange={(e) => set({ contact: e.target.value })} />
          </Field>
          <Field label="電話">
            <input className={`${inputClass} font-mono`} value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="送貨地址">
            <input className={inputClass} value={form.address || ''} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">貨品</p>
          {lines.map((line) => (
            <div key={line.key} className="flex flex-col sm:flex-row gap-2 border border-slate-200 p-2.5">
              <select className={`${inputClass} flex-1`} value={line.itemId} onChange={(e) => setLine(line.key, { itemId: e.target.value })}>
                <option value="">揀貨品…</option>
                {groups.map((g) => (
                  <optgroup key={g.kind} label={ITEM_KIND_LABELS[g.kind]}>
                    {g.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex gap-2 items-center">
                <div className="w-32 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="數量"
                    className={`${inputClass} font-mono`}
                    value={line.qty}
                    onChange={(e) => setLine(line.key, { qty: e.target.value })}
                  />
                </div>
                <span className="text-sm font-bold text-slate-500 w-8">{itemById.get(line.itemId)?.unit}</span>
                <button
                  type="button"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [{ key: newId('line'), itemId: '', qty: '' }])}
                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="刪除呢一行"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { key: newId('line'), itemId: '', qty: '' }])} className={secondaryButtonClass}>
            <Plus className="w-4 h-4" />
            加一行
          </button>
        </div>

        <Field label="備註">
          <input className={inputClass} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="例如：朝早 10 點前送到" />
        </Field>

        {error && (
          <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
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

// ---------- Delivery: the customer signs ----------

const SIG_WIDTH = 600;
const SIG_HEIGHT = 220;

/** Finger or mouse signature, kept as a small PNG. */
const SignaturePad: React.FC<{ onChange: (dataUrl: string) => void }> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) * SIG_WIDTH) / rect.width, ((e.clientY - rect.top) * SIG_HEIGHT) / rect.height] as const;
  };
  const context = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    }
    return ctx;
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = pointOf(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    const [x, y] = pointOf(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(canvasRef.current?.toDataURL('image/png') || '');
  };
  const clear = () => {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, SIG_WIDTH, SIG_HEIGHT);
    setEmpty(true);
    onChange('');
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={SIG_WIDTH}
          height={SIG_HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="w-full bg-slate-50 border-2 border-dashed border-slate-300 cursor-crosshair"
          style={{ touchAction: 'none', aspectRatio: `${SIG_WIDTH} / ${SIG_HEIGHT}` }}
        />
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-400 pointer-events-none">
            請收貨人喺呢度用手指簽名
          </p>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs font-black text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
        <Eraser className="w-3.5 h-3.5" />
        清除重簽
      </button>
    </div>
  );
};

const SignForm: React.FC<{
  note: DeliveryNote;
  defaultSigner: string;
  onClose: () => void;
  onSign: (sign: Pick<DeliveryNote, 'receiverName' | 'signature' | 'signedBy' | 'receivedQty' | 'receivedNotes'>) => void;
}> = ({ note, defaultSigner, onClose, onSign }) => {
  const [received, setReceived] = useState(note.lines.map((l) => String(l.qty)));
  const [receiverName, setReceiverName] = useState('');
  const [signature, setSignature] = useState('');
  const [signedBy, setSignedBy] = useState(defaultSigner);
  const [receivedNotes, setReceivedNotes] = useState('');
  const [error, setError] = useState('');

  const changed = note.lines.some((l, i) => Number(received[i]) !== l.qty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (received.some((r) => r === '' || !(Number(r) >= 0))) return setError('實收數量要係 0 或者以上');
    if (!receiverName.trim()) return setError('請輸入收貨人姓名');
    if (!signature) return setError('請收貨人簽名');
    if (!signedBy.trim()) return setError('請輸入送貨同事嘅名');
    onSign({
      receiverName: receiverName.trim(),
      signature,
      signedBy: signedBy.trim(),
      receivedQty: received.map(Number),
      receivedNotes: receivedNotes.trim() || undefined,
    });
  };

  return (
    <Modal eyebrow="SIGN FOR DELIVERY" title={`簽收 ${note.no}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 p-3 text-sm space-y-0.5">
          <p className="font-black">{note.customerName}</p>
          {note.address && <p className="text-xs text-slate-600 font-medium">{note.address}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">實收數量（同送貨數量唔同先改）</p>
          {note.lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_2.5rem] items-center gap-2">
              <span className="text-sm font-bold">{line.itemName}</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                className={`${inputClass} font-mono ${Number(received[i]) !== line.qty ? 'border-rose-400' : ''}`}
                value={received[i]}
                onChange={(e) => setReceived(received.map((r, j) => (j === i ? e.target.value : r)))}
              />
              <span className="text-sm font-bold text-slate-500">{line.unit}</span>
            </div>
          ))}
        </div>

        {changed && (
          <Field label="收貨備註" hint="例如：短咗 2 包、退回 1 包包裝破損">
            <input className={inputClass} value={receivedNotes} onChange={(e) => setReceivedNotes(e.target.value)} />
          </Field>
        )}

        <Field label="收貨人姓名" required>
          <input className={inputClass} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
        </Field>
        <Field label="收貨人簽名" required>
          <SignaturePad onChange={setSignature} />
        </Field>
        <Field label="送貨同事" required>
          <input className={inputClass} value={signedBy} onChange={(e) => setSignedBy(e.target.value)} />
        </Field>

        {error && (
          <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            取消
          </button>
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            確認簽收
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ---------- Customers ----------

const CustomerList: React.FC<{
  customers: DeliveryCustomer[];
  isManager: boolean;
  fromInvoice: boolean;
  onAdd: () => void;
  onEdit: (c: DeliveryCustomer) => void;
  onDelete: (c: DeliveryCustomer) => void;
}> = ({ customers, isManager, fromInvoice, onAdd, onEdit, onDelete }) => (
  <Panel
    title={`客戶 (${customers.length})`}
    actions={
      isManager && (
        <button onClick={onAdd} className={primaryButtonClass}>
          <Plus className="w-4 h-4 text-emerald-400" />
          新增客戶
        </button>
      )
    }
  >
    {fromInvoice && (
      <p className="px-5 pt-4 text-xs text-slate-600 font-medium">
        老闆喺開單台儲存客戶時，名稱、聯絡人、電話同地址會自動抄過嚟；價錢唔會。
      </p>
    )}
    {customers.length === 0 ? (
      <EmptyState title="未有客戶" />
    ) : (
      <div className="divide-y divide-slate-100">
        {customers.map((c) => (
          <div key={c.id} className="px-5 py-3.5 flex items-start gap-3">
            <Truck className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-900">
                {c.name}
                {c.company && <span className="text-slate-500 font-bold">（{c.company}）</span>}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {[c.contact, c.phone].filter(Boolean).join(' · ')}
              </p>
              {c.address && <p className="text-xs text-slate-500 font-medium">{c.address}</p>}
            </div>
            {isManager && (
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onEdit(c)} className="px-2 py-1 text-xs font-black border border-slate-200 hover:border-slate-900 cursor-pointer">
                  編輯
                </button>
                <button onClick={() => onDelete(c)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="刪除">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </Panel>
);

const CustomerForm: React.FC<{
  customer: DeliveryCustomer;
  onClose: () => void;
  onSave: (customer: DeliveryCustomer) => void;
}> = ({ customer, onClose, onSave }) => {
  const [form, setForm] = useState<DeliveryCustomer>(customer);
  const [error, setError] = useState('');
  const set = (patch: Partial<DeliveryCustomer>) => setForm({ ...form, ...patch });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('請輸入客戶名稱');
    onSave({
      id: form.id,
      name: form.name.trim(),
      company: form.company?.trim() || undefined,
      contact: form.contact?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
    });
  };

  return (
    <Modal eyebrow="CUSTOMER" title={customer.id ? `編輯客戶：${customer.name}` : '新增客戶'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="客戶名稱" required>
            <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label="公司（選填）">
            <input className={inputClass} value={form.company || ''} onChange={(e) => set({ company: e.target.value })} />
          </Field>
          <Field label="聯絡人">
            <input className={inputClass} value={form.contact || ''} onChange={(e) => set({ contact: e.target.value })} />
          </Field>
          <Field label="電話">
            <input className={`${inputClass} font-mono`} value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </div>
        <Field label="送貨地址">
          <input className={inputClass} value={form.address || ''} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
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
