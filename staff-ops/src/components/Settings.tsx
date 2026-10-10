import React, { useState } from 'react';
import { Check, Download, Eraser, RotateCcw, Upload } from 'lucide-react';
import { AppSettings } from '../types';
import { exportBackup, importBackup } from '../utils/storage';
import { Field, PageHeader, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from './ui';

interface SettingsProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearRecords: () => void;
  onResetDemo: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSaveSettings, onClearRecords, onResetDemo }) => {
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
    onSaveSettings({ companyName: companyName.trim() || settings.companyName, managerPin: newPin || settings.managerPin });
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
