import React, { useState } from 'react';
import { Calculator, Check, Download, Eraser, Plus, RotateCcw, Upload, X } from 'lucide-react';
import { AppSettings, Employee } from '../types';
import { positionsOf } from '../data/defaults';
import { downloadBackupFile, exportBackup, importBackup } from '../utils/storage';
import { exportCloudBackup, importBackupToCloud, recomputeStockLevels } from '../lib/cloud';
import { AccountsPanel } from './AccountsPanel';
import { Field, PageHeader, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

interface SettingsProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearRecords: () => void;
  onResetDemo: () => void;
}

/** Settings for browser-only mode: PIN, local backup and demo data. */
export const LocalSettings: React.FC<SettingsProps> = ({ settings, onSaveSettings, onClearRecords, onResetDemo }) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPin || confirmPin) {
      if (!/^\d{4,8}$/.test(newPin)) return setError('密碼要係 4 至 8 位數字');
      if (newPin !== confirmPin) return setError('兩次輸入嘅密碼唔一樣');
    }
    onSaveSettings({ ...settings, companyName: companyName.trim() || settings.companyName, managerPin: newPin || settings.managerPin });
    setNewPin('');
    setConfirmPin('');
    setMessage(newPin ? '已儲存，主管密碼已更新。' : '已儲存。');
    setTimeout(() => setMessage(''), 2500);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (importBackup(String(reader.result || ''))) {
        alert('還原成功，系統會重新載入。');
        window.location.reload();
      } else {
        setError('備份檔案格式唔啱（要係呢個員工系統匯出嘅檔案）。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader eyebrow="SETTINGS" title="系統設定" subtitle="只有主管模式先睇到呢頁。" />

      <form onSubmit={handleSave}>
        <Panel title="基本設定">
          <div className="p-5 space-y-4">
            <Field label="公司名稱（顯示喺頁頂）">
              <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="新主管密碼" hint="4–8 位數字；留空＝唔改">
                <input type="password" inputMode="numeric" className={`${inputClass} font-mono`} value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              </Field>
              <Field label="再輸入一次">
                <input type="password" inputMode="numeric" className={`${inputClass} font-mono`} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
              </Field>
            </div>
            {settings.managerPin === '1234' && (
              <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 p-2.5">
                主管密碼仲係預設嘅 1234，請盡快改。
              </p>
            )}
            {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
            {message && <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5">✓ {message}</p>}
            <div className="flex justify-end">
              <button type="submit" className={primaryButtonClass}>
                <Check className="w-4 h-4" />
                儲存
              </button>
            </div>
          </div>
        </Panel>
      </form>

      <PositionsPanel settings={settings} onSaveSettings={onSaveSettings} />

      <Panel title="備份及還原">
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            資料只係儲存喺呢部機嘅瀏覽器入面。建議每星期匯出一次備份；換機或者清除瀏覽器資料之前一定要先備份。
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportBackup} className={primaryButtonClass}>
              <Download className="w-4 h-4" />
              匯出備份
            </button>
            <label className={secondaryButtonClass}>
              <Upload className="w-4 h-4" />
              由備份還原
              <input type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>
      </Panel>

      <Panel title="開始正式使用">
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            系統預載咗示範資料。正式使用前可以清除示範員工、更表、假期、流程打剔同倉存紀錄；SOP、每日流程、貨品清單、更份同法定假日會保留，方便你直接修改。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => confirm('清除所有員工、更表、假期、流程打剔同倉存紀錄？呢個動作唔可以復原（建議先匯出備份）。') && onClearRecords()}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-black border border-rose-200 flex items-center gap-2 cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              清除示範紀錄
            </button>
            <button
              onClick={() => confirm('將所有資料重設為示範資料？現有資料會被取代。') && onResetDemo()}
              className={secondaryButtonClass}
            >
              <RotateCcw className="w-4 h-4" />
              重設為示範資料
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
};

/** The position list offered when adding staff and workflow items. */
const PositionsPanel: React.FC<{
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}> = ({ settings, onSaveSettings }) => {
  const positions = positionsOf(settings);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const save = (next: string[]) => onSaveSettings({ ...settings, positions: next });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const position = name.trim();
    if (!position) return;
    if (positions.includes(position)) return setError(`「${position}」已經喺清單入面。`);
    save([...positions, position]);
    setName('');
  };

  return (
    <Panel title="職位">
      <div className="p-5 space-y-3">
        <p className="text-xs text-slate-600 font-medium">
          新增員工同每日流程揀「職位」時，會見到呢個清單。刪除只會喺清單度移走，已經用緊嗰個職位嘅員工同流程唔受影響。
        </p>
        <div className="flex flex-wrap gap-2">
          {positions.map((position) => (
            <span key={position} className="flex items-center gap-1 pl-3 pr-1 py-1 bg-slate-50 border border-slate-200 text-sm font-bold">
              {position}
              <button
                type="button"
                onClick={() => save(positions.filter((p) => p !== position))}
                title={`刪除「${position}」`}
                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {positions.length === 0 && <p className="text-xs text-slate-400 font-medium">未有職位，喺下面加。</p>}
        </div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="新職位，例如：司機"
          />
          <button type="submit" className={`${primaryButtonClass} shrink-0`}>
            <Plus className="w-4 h-4" />
            加入
          </button>
        </form>
        {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}
      </div>
    </Panel>
  );
};

interface CloudSettingsProps {
  settings: AppSettings;
  employees: Employee[];
  currentUid: string;
  onSaveSettings: (settings: AppSettings) => void;
}

/** Settings for Firebase mode: accounts replace the PIN; backups read the cloud. */
export const CloudSettings: React.FC<CloudSettingsProps> = ({ settings, employees, currentUid, onSaveSettings }) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const flash = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  };

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(label);
    setError('');
    try {
      flash(await task());
    } catch (err) {
      console.error(err);
      setError(`${label}失敗，請檢查網絡或備份檔案。`);
    } finally {
      setBusy('');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('將備份入面嘅紀錄寫入雲端？相同編號嘅紀錄會被覆蓋，其他紀錄唔會刪除。')) return;
    const reader = new FileReader();
    reader.onload = () =>
      run('還原', async () => `已還原 ${await importBackupToCloud(String(reader.result || ''))} 條紀錄。`);
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader eyebrow="SETTINGS" title="系統設定" subtitle="只有主管睇到呢頁。資料儲存喺 Firebase 雲端，所有裝置即時同步。" />

      {message && <p className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5">✓ {message}</p>}
      {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5">{error}</p>}

      <Panel title="基本設定">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveSettings({ ...settings, companyName: companyName.trim() || settings.companyName });
            flash('已儲存。');
          }}
          className="p-5 flex flex-col sm:flex-row gap-3 sm:items-end"
        >
          <Field label="公司名稱（顯示喺頁頂）" className="flex-1">
            <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <button type="submit" className={primaryButtonClass}>
            <Check className="w-4 h-4" />
            儲存
          </button>
        </form>
      </Panel>

      <PositionsPanel settings={settings} onSaveSettings={onSaveSettings} />

      <AccountsPanel employees={employees} currentUid={currentUid} />

      <Panel title="備份及還原">
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            雲端資料由 Google 保存。如需要一份自己嘅副本，可以匯出備份；之前喺單機版匯出嘅備份亦可以喺度還原上雲端。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!!busy}
              onClick={() =>
                run('匯出', async () => {
                  downloadBackupFile(await exportCloudBackup());
                  return '已下載備份檔案。';
                })
              }
              className={primaryButtonClass}
            >
              <Download className="w-4 h-4" />
              {busy === '匯出' ? '匯出中…' : '匯出備份'}
            </button>
            <label className={secondaryButtonClass}>
              <Upload className="w-4 h-4" />
              {busy === '還原' ? '還原中…' : '由備份還原'}
              <input type="file" accept="application/json,.json" className="hidden" onChange={handleImport} disabled={!!busy} />
            </label>
          </div>
        </div>
      </Panel>

      <Panel title="存貨">
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 font-medium">
            現有存貨會隨每次入貨、落貨即時更新。如果懷疑數字唔啱（例如網絡中斷期間有改動），可以由全部紀錄重新計一次。
          </p>
          <button
            disabled={!!busy}
            onClick={() => run('重新計算', async () => `已重新計算 ${await recomputeStockLevels()} 項貨品嘅存貨。`)}
            className={secondaryButtonClass}
          >
            <Calculator className="w-4 h-4" />
            {busy === '重新計算' ? '計算中…' : '重新計算存貨'}
          </button>
        </div>
      </Panel>
    </div>
  );
};
