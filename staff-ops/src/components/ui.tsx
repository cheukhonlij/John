import React from 'react';
import { X } from 'lucide-react';
import { WEEKDAY_LABELS } from '../utils/dates';

// Shared building blocks for the operations modules, matching the invoice
// screens' square, high-contrast slate style.

export const inputClass =
  'w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden';

export const primaryButtonClass =
  'px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const secondaryButtonClass =
  'px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-widest border border-slate-200 transition flex items-center gap-2 cursor-pointer';

export const PageHeader: React.FC<{
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, actions }) => (
  <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{eyebrow}</p>
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mt-1">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 font-medium mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Panel: React.FC<{
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, actions, className = '', children }) => (
  <div className={`bg-white border border-slate-200 shadow-xs ${className}`}>
    {(title || actions) && (
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
        {title && (
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-900">{title}</h3>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

export const TabBar = <T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) => (
  <div className="flex gap-1 overflow-x-auto bg-white border border-slate-200 p-1.5 no-print">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-4 py-2 text-xs font-black tracking-wider whitespace-nowrap transition cursor-pointer ${
          active === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        {tab.label}
        {tab.count !== undefined && <span className="ml-1.5 font-mono opacity-70">{tab.count}</span>}
      </button>
    ))}
  </div>
);

export const Modal: React.FC<{
  eyebrow?: string;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ eyebrow, title, onClose, wide, children }) => (
  <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start sm:items-center justify-center p-4 backdrop-blur-xs overflow-y-auto no-print">
    <div
      className={`bg-white w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6 sm:p-8 space-y-5 border-2 border-slate-900 shadow-2xl my-8`}
    >
      <div className="flex justify-between items-start border-b border-slate-200 pb-4 gap-4">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{eyebrow}</p>
          )}
          <h3 className="font-black text-xl text-slate-900 mt-0.5">{title}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900 p-1 transition cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, className = '', children }) => (
  <div className={className}>
    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 font-medium mt-1">{hint}</p>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'warn' | 'good' | 'bad';
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'default', onClick }) => {
  const toneClass = {
    default: 'text-slate-900',
    warn: 'text-amber-600',
    good: 'text-emerald-600',
    bad: 'text-rose-600',
  }[tone];
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 shadow-xs p-5 ${onClick ? 'cursor-pointer hover:border-slate-900 transition' : ''}`}
    >
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className={`text-3xl font-black font-mono mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 font-medium mt-1">{hint}</div>}
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="py-14 text-center">
    <p className="text-sm font-black tracking-wider text-slate-600">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1 font-medium">{hint}</p>}
  </div>
);

export const WeekdayPicker: React.FC<{
  value: number[];
  onChange: (days: number[]) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1">
    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
      const on = value.includes(day);
      return (
        <button
          type="button"
          key={day}
          onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))}
          className={`w-9 h-9 text-xs font-black border transition cursor-pointer ${
            on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-900'
          }`}
        >
          {WEEKDAY_LABELS[day]}
        </button>
      );
    })}
  </div>
);

/** Prints the current `.print-area`, temporarily switching the page orientation. */
export const printPage = (orientation: 'portrait' | 'landscape' = 'portrait') => {
  const style = document.createElement('style');
  style.textContent = `@media print { @page { size: A4 ${orientation}; } }`;
  document.head.appendChild(style);
  window.print();
  // window.print() blocks until the dialog closes in most browsers.
  setTimeout(() => style.remove(), 500);
};

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
