import React, { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, Check, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { SOP, SOPStep } from '../types';
import { SOP_CATEGORIES } from '../data/defaults';
import { todayISO } from '../utils/dates';
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  inputClass,
  newId,
  primaryButtonClass,
  printPage,
  secondaryButtonClass,
} from './ui';

interface SOPLibraryProps {
  sops: SOP[];
  isManager: boolean;
  onSaveSops: (sops: SOP[]) => void;
}

export const SOPContent: React.FC<{ sop: SOP }> = ({ sop }) => (
  <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono font-black bg-slate-900 text-white px-2 py-0.5">{sop.code}</span>
      <span className="font-black border border-slate-300 px-2 py-0.5">{sop.category}</span>
      <span className="text-slate-500 font-bold">
        版本 {sop.version} · 更新 {sop.updatedAt}
        {sop.owner && ` · 負責：${sop.owner}`}
      </span>
    </div>
    {sop.purpose && (
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">目的</p>
        <p className="text-sm font-medium text-slate-800 mt-1">{sop.purpose}</p>
      </div>
    )}
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">步驟</p>
      <ol className="space-y-2.5">
        {sop.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3">
            <span className="w-7 h-7 shrink-0 bg-slate-900 text-white font-black text-sm flex items-center justify-center">{i + 1}</span>
            <div className="pt-0.5">
              <p className="text-sm font-bold text-slate-900">{step.text}</p>
              {step.caution && (
                <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 mt-1 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {step.caution}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

export const SOPViewer: React.FC<{ sop: SOP; onClose: () => void }> = ({ sop, onClose }) => (
  <Modal eyebrow="STANDARD OPERATING PROCEDURE" title={sop.title} onClose={onClose} wide>
    <SOPContent sop={sop} />
  </Modal>
);

export const SOPLibrary: React.FC<SOPLibraryProps> = ({ sops, isManager, onSaveSops }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(sops[0]?.id || '');
  const [editing, setEditing] = useState<SOP | null>(null);

  const categories = Array.from(new Set([...SOP_CATEGORIES, ...sops.map((s) => s.category)]));
  const q = search.trim().toLowerCase();
  const visible = sops
    .filter((s) => category === 'all' || s.category === category)
    .filter(
      (s) =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.steps.some((st) => st.text.toLowerCase().includes(q))
    )
    .sort((a, b) => a.code.localeCompare(b.code));
  const selected = sops.find((s) => s.id === selectedId) || visible[0];

  const nextCode = () => {
    const max = sops.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0);
    return `SOP-${String(max + 1).padStart(3, '0')}`;
  };

  const handleSave = (sop: SOP) => {
    const saved = { ...sop, updatedAt: todayISO() };
    if (sops.some((s) => s.id === sop.id)) {
      onSaveSops(sops.map((s) => (s.id === sop.id ? saved : s)));
    } else {
      onSaveSops([...sops, saved]);
    }
    setSelectedId(sop.id);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="STANDARD OPERATING PROCEDURES"
        title="SOP 標準作業程序"
        subtitle="每個崗位嘅標準做法。新同事入職時可以逐份睇，亦可以列印貼喺工作位置。"
        actions={
          isManager && (
            <button
              onClick={() =>
                setEditing({
                  id: newId('sop'),
                  code: nextCode(),
                  title: '',
                  category: SOP_CATEGORIES[0],
                  version: '1.0',
                  purpose: '',
                  owner: '',
                  steps: [{ id: newId('step'), text: '' }],
                  updatedAt: todayISO(),
                })
              }
              className={primaryButtonClass}
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              新增 SOP
            </button>
          )
        }
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="bg-white border border-slate-200 shadow-xs no-print">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input className={`${inputClass} pl-9`} placeholder="搜尋 SOP…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {['all', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[11px] px-2 py-1 font-black cursor-pointer ${category === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {c === 'all' ? '全部' : c}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState title="搵唔到 SOP" />
          ) : (
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {visible.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left px-4 py-3 transition cursor-pointer ${selected?.id === s.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
                >
                  <div className={`text-[10px] font-mono font-black ${selected?.id === s.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {s.code} · {s.category}
                  </div>
                  <div className="font-black text-sm">{s.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <div className="print-area bg-white border border-slate-200 shadow-xs p-6 sm:p-8 space-y-5">
            <div className="flex justify-between items-start gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-slate-400 no-print" />
                <h3 className="text-2xl font-black">{selected.title}</h3>
              </div>
              <div className="flex gap-2 shrink-0">
                {isManager && (
                  <>
                    <button onClick={() => setEditing(JSON.parse(JSON.stringify(selected)))} className={secondaryButtonClass}>
                      <Pencil className="w-4 h-4" />
                      編輯
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`刪除「${selected.code} ${selected.title}」？`)) {
                          onSaveSops(sops.filter((s) => s.id !== selected.id));
                          setSelectedId('');
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => printPage('portrait')} className={primaryButtonClass}>
                  <Printer className="w-4 h-4" />
                  列印
                </button>
              </div>
            </div>
            <SOPContent sop={selected} />
          </div>
        ) : (
          <div className="bg-white border border-slate-200">
            <EmptyState title="揀一份 SOP 睇內容" />
          </div>
        )}
      </div>

      {editing && <SOPEditor sop={editing} categories={categories} onClose={() => setEditing(null)} onSave={handleSave} />}
    </div>
  );
};

const SOPEditor: React.FC<{
  sop: SOP;
  categories: string[];
  onClose: () => void;
  onSave: (sop: SOP) => void;
}> = ({ sop, categories, onClose, onSave }) => {
  const [form, setForm] = useState<SOP>(sop);
  const set = (patch: Partial<SOP>) => setForm({ ...form, ...patch });
  const setStep = (id: string, patch: Partial<SOPStep>) =>
    set({ steps: form.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const moveStep = (index: number, delta: number) => {
    const steps = [...form.steps];
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    set({ steps });
  };

  return (
    <Modal eyebrow="EDIT SOP" title={sop.title ? `編輯：${sop.title}` : '新增 SOP'} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const steps = form.steps
            .map((s) => ({ ...s, text: s.text.trim(), caution: s.caution?.trim() || undefined }))
            .filter((s) => s.text);
          if (!form.title.trim() || steps.length === 0) return alert('請輸入標題同最少一個步驟。');
          onSave({ ...form, title: form.title.trim(), steps });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="編號">
            <input className={`${inputClass} font-mono`} value={form.code} onChange={(e) => set({ code: e.target.value })} />
          </Field>
          <Field label="標題" required className="col-span-2 sm:col-span-3">
            <input className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} required />
          </Field>
          <Field label="類別">
            <input className={inputClass} list="sop-categories" value={form.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="sop-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="版本">
            <input className={`${inputClass} font-mono`} value={form.version} onChange={(e) => set({ version: e.target.value })} />
          </Field>
          <Field label="負責人／崗位" className="col-span-2">
            <input className={inputClass} value={form.owner || ''} onChange={(e) => set({ owner: e.target.value })} />
          </Field>
        </div>
        <Field label="目的">
          <textarea className={inputClass} rows={2} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />
        </Field>
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">步驟</p>
          {form.steps.map((step, i) => (
            <div key={step.id} className="border border-slate-200 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 bg-slate-900 text-white font-black text-xs flex items-center justify-center">{i + 1}</span>
                <input className={inputClass} placeholder="步驟內容" value={step.text} onChange={(e) => setStep(step.id, { text: e.target.value })} />
                <button type="button" onClick={() => moveStep(i, -1)} className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer" title="上移">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => moveStep(i, 1)} className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer" title="下移">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => set({ steps: form.steps.filter((s) => s.id !== step.id) })}
                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                className={`${inputClass} text-xs`}
                placeholder="注意事項（可選，會用紅色顯示）"
                value={step.caution || ''}
                onChange={(e) => setStep(step.id, { caution: e.target.value })}
              />
            </div>
          ))}
          <button type="button" onClick={() => set({ steps: [...form.steps, { id: newId('step'), text: '' }] })} className={secondaryButtonClass}>
            <Plus className="w-4 h-4" />
            加步驟
          </button>
        </div>
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
