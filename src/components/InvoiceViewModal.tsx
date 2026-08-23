import React, { useState } from 'react';
import { Invoice, CompanyProfile } from '../types';
import { 
  X, Printer, Download, MessageCircle, Mail, 
  Edit3, Copy, Check, FileText, Truck, ShieldCheck
} from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { 
  printInvoiceStandalone, 
  downloadInvoiceStandaloneFile, 
  generateWhatsAppShareUrl, 
  generateEmailShareUrl, 
  formatCurrency 
} from '../utils/pdfExport';

interface InvoiceViewModalProps {
  invoice: Invoice;
  company: CompanyProfile;
  onClose: () => void;
  onEdit: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({
  invoice,
  company,
  onClose,
  onEdit,
  onDuplicate,
}) => {
  const [docMode, setDocMode] = useState<'invoice' | 'delivery_note'>('invoice');
  const [isCopied, setIsCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const isDO = docMode === 'delivery_note';

  const handlePrint = () => {
    printInvoiceStandalone(invoice, company, isDO);
  };

  const handleDownload = () => {
    downloadInvoiceStandaloneFile(invoice, company, isDO);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const whatsAppUrl = generateWhatsAppShareUrl(invoice, company, isDO);
  const emailUrl = generateEmailShareUrl(invoice, company, isDO);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-sm border-2 border-slate-900 max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Control Bar */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-2 border border-slate-700 text-blue-400">
              {isDO ? <Truck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base uppercase tracking-wider font-mono">
                  #{invoice.invoiceNumber}
                </h3>
                <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-wider ${
                  isDO ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {isDO ? '出貨單 (DO)' : '正式發票 (INV)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {invoice.customerName} {invoice.customerCode ? `[${invoice.customerCode}]` : ''} • {invoice.date}
              </p>
            </div>
          </div>

          {/* Mode Switcher Segmented Control */}
          <div className="flex items-center bg-slate-800 p-1 rounded-sm border border-slate-700">
            <button
              onClick={() => setDocMode('invoice')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                !isDO ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>發票 INVOICE</span>
            </button>

            <button
              onClick={() => setDocMode('delivery_note')}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                isDO ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>送貨單 DELIVERY NOTE</span>
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-sm transition cursor-pointer"
            title="關閉 Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>列印 / 另存 PDF ({isDO ? '送貨單' : '發票'})</span>
            </button>

            {/* Direct Download Button */}
            <button
              onClick={handleDownload}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-2 border-slate-900 transition cursor-pointer ${
                downloadSuccess 
                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                  : 'bg-white text-slate-900 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {downloadSuccess ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{downloadSuccess ? '已下載檔案！' : `下載 ${isDO ? '送貨單' : '發票'} 檔案`}</span>
            </button>

            {/* WhatsApp Share */}
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp 發送 ({isDO ? '送貨明細' : '發票'})</span>
            </a>

            {/* Email Share */}
            <a
              href={emailUrl}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>電郵</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(invoice);
              }}
              className="px-3 py-1.5 text-xs font-bold uppercase text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>編輯修改</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onDuplicate(invoice);
              }}
              className="px-3 py-1.5 text-xs font-bold uppercase text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>複製建立新單</span>
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/70">
          <div className="w-full max-w-[210mm] transition-all">
            <InvoicePreview
              invoice={invoice}
              company={company}
              hideZeroItems={true}
              containerId="modalInvoiceContainer"
              isDeliveryNote={isDO}
            />
          </div>
        </div>

        {/* Modal Footer Banner */}
        <div className="bg-slate-900 text-slate-400 px-6 py-2.5 text-[11px] font-medium flex items-center justify-between border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>原生高解像度輸出引擎 • 支援直接另存 A4 PDF 及列印</span>
          </div>
          <div className="font-mono text-white">
            {isDO ? `總件數: ${invoice.totalUnits} 件` : `總額: ${formatCurrency(invoice.total, invoice.currency)}`}
          </div>
        </div>
      </div>
    </div>
  );
};
