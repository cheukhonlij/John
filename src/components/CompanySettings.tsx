import React, { useState } from 'react';
import { CompanyProfile } from '../types';
import { Building2, Save, Download, Upload, RotateCcw, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { exportAllDataBackup, importDataBackup } from '../utils/storage';

interface CompanySettingsProps {
  company: CompanyProfile;
  onSaveCompany: (company: CompanyProfile) => void;
  onResetAllData: () => void;
}

export const CompanySettings: React.FC<CompanySettingsProps> = ({
  company,
  onSaveCompany,
  onResetAllData,
}) => {
  const [form, setForm] = useState<CompanyProfile>({ ...company });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  const handleChange = (field: keyof CompanyProfile, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompany(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataBackup(content);
        if (success) {
          alert('備份還原成功！系統將重新載入最新資料。');
          window.location.reload();
        } else {
          setImportError('備份檔案格式不正確，請確認檔案內容。');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            CONFIGURATION & BRANDING
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase mt-1">
            COMPANY & INVOICE SETTINGS
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Configure invoice banner headers, registered address, banking settlement details, and terms
          </p>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-xs font-black uppercase tracking-wider px-4 py-2 border border-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>SAVED SUCCESSFULLY</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Header Branding */}
        <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3">
            INVOICE HEADER & BRANDING
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Primary Brand Title
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-black focus:border-slate-900 focus:bg-white focus:outline-hidden"
                placeholder="TODAY'S FOOD LAB"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Sub-Header Slogan
              </label>
              <input
                type="text"
                value={form.subTitle}
                onChange={(e) => handleChange('subTitle', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-black focus:border-slate-900 focus:bg-white focus:outline-hidden"
                placeholder="F O O D   L A B"
              />
            </div>
          </div>
        </div>

        {/* Contact & Address */}
        <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3">
            ADDRESS & CONTACT INFORMATION
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                English Address (Line 1)
              </label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                English Address (Line 2)
              </label>
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Chinese Registered Address
              </label>
              <input
                type="text"
                value={form.addressLine3}
                onChange={(e) => handleChange('addressLine3', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Telephone / WhatsApp
                </label>
                <input
                  type="text"
                  value={form.tel}
                  onChange={(e) => handleChange('tel', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Banking & Terms */}
        <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3">
            BANK SETTLEMENT & DEFAULT TERMS
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                placeholder="HSBC"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={form.accountName}
                onChange={(e) => handleChange('accountName', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                placeholder="Today's Limited"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => handleChange('accountNumber', e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                placeholder="023-621196-838"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Default Payment Terms & Notes Footer
            </label>
            <textarea
              rows={3}
              value={form.defaultPaymentTerms}
              onChange={(e) => handleChange('defaultPaymentTerms', e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="showStamp"
              checked={form.showStampBox}
              onChange={(e) => handleChange('showStampBox', e.target.checked)}
              className="w-4 h-4 text-slate-900 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="showStamp" className="text-xs font-black uppercase tracking-wider text-slate-800 cursor-pointer">
              Show "Authorized Signature" stamp box on invoice bottom-right
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>SAVE COMPANY SETTINGS</span>
          </button>
        </div>
      </form>

      {/* Data Backup & Restore Section */}
      <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>DATA BACKUP & RECOVERY</span>
        </h3>

        <p className="text-xs text-slate-500 font-medium">
          Export all products, customers, and invoice transaction histories as a JSON file, or restore from a previous backup.
        </p>

        {importError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Export JSON */}
          <button
            type="button"
            onClick={exportAllDataBackup}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-wider border border-slate-200 transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>EXPORT JSON BACKUP</span>
          </button>

          {/* Import JSON */}
          <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-black uppercase tracking-wider border border-slate-200 transition flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>IMPORT BACKUP FILE</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Reset All */}
          <button
            type="button"
            onClick={() => {
              if (confirm('確定要將系統重設為原廠範例資料嗎？現存所有自訂資料將會被取代。')) {
                onResetAllData();
              }
            }}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-black uppercase tracking-wider border border-rose-200 transition flex items-center gap-2 ml-auto cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESET TO FACTORY DEMO</span>
          </button>
        </div>
      </div>
    </div>
  );
};
