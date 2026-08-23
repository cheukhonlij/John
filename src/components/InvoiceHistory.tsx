import React, { useState } from 'react';
import { Invoice, CompanyProfile, InvoiceStatus } from '../types';
import { 
  History, Search, Filter, Download, Printer, Share2, 
  Edit3, Copy, Trash2, Eye, CheckCircle2, Clock, 
  AlertTriangle, DollarSign, FileSpreadsheet, Plus, MessageCircle, ArrowUpDown,
  Calendar, Check, X, Truck, FileText
} from 'lucide-react';
import { formatCurrency, generateWhatsAppShareUrl, printInvoiceStandalone } from '../utils/pdfExport';

interface InvoiceHistoryProps {
  invoices: Invoice[];
  company: CompanyProfile;
  onSaveInvoices: (invoices: Invoice[]) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDuplicateInvoice: (invoice: Invoice) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({
  invoices,
  company,
  onSaveInvoices,
  onEditInvoice,
  onDuplicateInvoice,
  onViewInvoice,
  onNewInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'total' | 'number'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Accounting Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<'summary' | 'detailed'>('summary');
  const [exportDateRange, setExportDateRange] = useState<'all' | 'current_month' | 'last_month' | 'current_filter'>('all');
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Stats calculation
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const unpaidInvoices = invoices.filter((inv) => inv.status === 'issued' || inv.status === 'overdue');
  const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  const handleStatusChange = (id: string, newStatus: InvoiceStatus) => {
    const updated = invoices.map((inv) =>
      inv.id === id
        ? { ...inv, status: newStatus, updatedAt: new Date().toISOString() }
        : inv
    );
    onSaveInvoices(updated);
  };

  const handleDelete = (id: string, num: string) => {
    if (confirm(`確定要刪除發票 #${num} 嗎？此操作不可復原。`)) {
      onSaveInvoices(invoices.filter((inv) => inv.id !== id));
    }
  };

  const handleQuickPrintDO = (inv: Invoice) => {
    printInvoiceStandalone(inv, company, true);
  };

  const toggleSort = (field: 'date' | 'total' | 'number') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerCode && inv.customerCode.toLowerCase().includes(q)) ||
      (inv.date && inv.date.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (sortField === 'total') {
      return sortDirection === 'asc' ? a.total - b.total : b.total - a.total;
    }
    if (sortField === 'number') {
      return sortDirection === 'asc'
        ? a.invoiceNumber.localeCompare(b.invoiceNumber)
        : b.invoiceNumber.localeCompare(a.invoiceNumber);
    }
    return sortDirection === 'asc'
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt);
  });

  // Comprehensive Excel/CSV Accounting Export Handler
  const executeAccountingExport = () => {
    if (invoices.length === 0) {
      alert('目前沒有任何發票紀錄可匯出！');
      return;
    }

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const lastMonthYear = curMonth === 1 ? curYear - 1 : curYear;
    const lastMonth = curMonth === 1 ? 12 : curMonth - 1;

    let targetInvoices: Invoice[] = [];

    if (exportDateRange === 'current_filter') {
      targetInvoices = sortedInvoices;
    } else if (exportDateRange === 'all') {
      targetInvoices = invoices;
    } else if (exportDateRange === 'current_month') {
      targetInvoices = invoices.filter((inv) => {
        // Date format: DD/MM/YYYY or YYYY-MM-DD
        const parts = inv.date.split(/[\/\-]/);
        if (parts.length >= 3) {
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          return m === curMonth && y === curYear;
        }
        return true;
      });
    } else if (exportDateRange === 'last_month') {
      targetInvoices = invoices.filter((inv) => {
        const parts = inv.date.split(/[\/\-]/);
        if (parts.length >= 3) {
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          return m === lastMonth && y === lastMonthYear;
        }
        return true;
      });
    }

    if (targetInvoices.length === 0) {
      alert('所選的時間區間內沒有發票資料！');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Chinese support

    if (exportReportType === 'summary') {
      // 1. 發票總覽匯總報表
      const headers = [
        '發票編號 (Invoice No)',
        '發票日期 (Date)',
        '客戶名稱 (Client Name)',
        '客戶代號 (Client Code)',
        '電話 (Phone)',
        '送貨地址 (Delivery Address)',
        '出貨總件數 (Total Units)',
        '小計金額 (Subtotal HK$)',
        '折扣扣減 (Discount HK$)',
        '折扣標籤 (Discount Label)',
        '已付/未收訂金 (Outstanding HK$)',
        '應收總額 (Grand Total HK$)',
        '收款狀態 (Status)',
        '建立時間 (Created At)'
      ];

      const rows = targetInvoices.map((inv) => [
        `"${inv.invoiceNumber}"`,
        `"${inv.date}"`,
        `"${(inv.customerName || '').replace(/"/g, '""')}"`,
        `"${inv.customerCode || ''}"`,
        `"${inv.customerPhone || ''}"`,
        `"${(inv.customerAddress || '').replace(/"/g, '""')}"`,
        inv.totalUnits,
        inv.subtotal.toFixed(2),
        inv.discountAmount.toFixed(2),
        `"${(inv.discountLabel || '').replace(/"/g, '""')}"`,
        inv.outstanding.toFixed(2),
        inv.total.toFixed(2),
        `"${inv.status.toUpperCase()}"`,
        `"${inv.createdAt}"`
      ]);

      // Add summary line at bottom
      const totalSumUnits = targetInvoices.reduce((s, i) => s + (i.totalUnits || 0), 0);
      const totalSumSubtotal = targetInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
      const totalSumDiscount = targetInvoices.reduce((s, i) => s + (i.discountAmount || 0), 0);
      const totalSumGrandTotal = targetInvoices.reduce((s, i) => s + (i.total || 0), 0);

      const summaryRow = [
        '"【總計 TOTAL】"',
        `"${targetInvoices.length} 筆發票"`,
        '""',
        '""',
        '""',
        '""',
        totalSumUnits,
        totalSumSubtotal.toFixed(2),
        totalSumDiscount.toFixed(2),
        '""',
        '""',
        totalSumGrandTotal.toFixed(2),
        '""',
        '""'
      ];

      csvContent += [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\n');
    } else {
      // 2. 產品銷售明細報表 (Itemized Sales Breakdown)
      const headers = [
        '發票編號 (Invoice No)',
        '發票日期 (Date)',
        '客戶名稱 (Client Name)',
        '客戶代號 (Client Code)',
        '貨品名稱 (Product Name)',
        '產品分類 (Category)',
        '數量 (Qty)',
        '單位 (Unit)',
        '單價 (Rate HK$)',
        '品項金額 (Line Total HK$)',
        '發票收款狀態 (Invoice Status)'
      ];

      const rows: string[][] = [];

      targetInvoices.forEach((inv) => {
        inv.items.forEach((item) => {
          if (item.qty > 0) {
            const lineTotal = item.rate !== null ? (item.qty * item.rate).toFixed(2) : '0.00';
            rows.push([
              `"${inv.invoiceNumber}"`,
              `"${inv.date}"`,
              `"${(inv.customerName || '').replace(/"/g, '""')}"`,
              `"${inv.customerCode || ''}"`,
              `"${(item.name || '').replace(/"/g, '""')}"`,
              `"${item.category || ''}"`,
              String(item.qty),
              `"${item.unit || '件'}"`,
              item.rate !== null ? item.rate.toFixed(2) : '0.00',
              lineTotal,
              `"${inv.status.toUpperCase()}"`
            ]);
          }
        });
      });

      csvContent += [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const typeLabel = exportReportType === 'summary' ? '發票匯總報表' : '銷量明細報表';
    link.download = `Todays_Food_Lab_${typeLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExportSuccessMsg(`成功匯出 ${targetInvoices.length} 張發票的 Excel/CSV 報表！`);
    setTimeout(() => {
      setExportSuccessMsg(null);
      setIsExportModalOpen(false);
    }, 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Header */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            REVENUE & ARCHIVE
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase mt-1">
            INVOICE HISTORY (歷史發票與對帳)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Review, inspect, print DO/Invoice, export accounting reports, and manage settlement statuses
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Accounting Excel/CSV Export Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>📊 會計對帳匯出 (EXCEL / CSV)</span>
          </button>

          <button
            onClick={onNewInvoice}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>+ CREATE INVOICE</span>
          </button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-slate-200 shadow-xs">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Invoiced (總開單額)</p>
          <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight text-slate-900 font-mono">
            {formatCurrency(totalAmount, company.currency)}
          </p>
          <p className="text-xs text-blue-600 font-bold mt-1">
            {invoices.length} Total Records
          </p>
        </div>

        <div className="bg-white p-6 border border-slate-200 shadow-xs">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Settled / Paid (已收款)</p>
          <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight text-emerald-600 font-mono">
            {formatCurrency(paidAmount, company.currency)}
          </p>
          <p className="text-xs text-emerald-600 font-bold mt-1">
            {paidInvoices.length} Paid in Full
          </p>
        </div>

        <div className="bg-white p-6 border border-slate-200 shadow-xs">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pending Receivables (未收款)</p>
          <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight text-orange-600 font-mono">
            {formatCurrency(unpaidAmount, company.currency)}
          </p>
          <p className="text-xs text-orange-600 font-bold mt-1">
            {unpaidInvoices.length} Pending Settlement
          </p>
        </div>

        <div className="bg-white p-6 border border-slate-200 shadow-xs">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Outbound Units (出貨件數)</p>
          <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight text-slate-900 font-mono">
            {invoices.reduce((sum, inv) => sum + (inv.totalUnits || 0), 0)}
          </p>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Product Units Dispatched
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="SEARCH BY INVOICE #, CLIENT NAME, CODE OR DATE..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider focus:outline-hidden focus:border-slate-900 focus:bg-white transition"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { key: 'all', label: 'ALL INVOICES' },
              { key: 'issued', label: 'ISSUED (已發出)' },
              { key: 'paid', label: 'PAID (已收款)' },
              { key: 'draft', label: 'DRAFT (草稿)' },
              { key: 'overdue', label: 'OVERDUE (逾期)' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`text-xs px-4 py-2.5 font-black uppercase tracking-widest transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-900">
            INVOICE RECORDS ({sortedInvoices.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => toggleSort('number')}
                  className="py-3.5 px-6 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>INVOICE ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('date')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-6">CLIENT NAME</th>
                <th className="py-3.5 px-4 text-center">UNITS</th>
                <th
                  onClick={() => toggleSort('total')}
                  className="py-3.5 px-6 text-right cursor-pointer hover:text-slate-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>AMOUNT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-black uppercase tracking-wider text-slate-600">No Invoices Found</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Click "+ Create Invoice" to generate your first invoice</p>
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((inv) => {
                  const whatsAppUrl = generateWhatsAppShareUrl(inv, company);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-xs text-slate-900">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="hover:text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer text-left font-black"
                        >
                          <span>{inv.invoiceNumber}</span>
                        </button>
                      </td>

                      <td className="py-4 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                        {inv.date}
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{inv.customerName}</span>
                          {inv.customerCode && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 border border-slate-200">
                              {inv.customerCode}
                            </span>
                          )}
                        </div>
                        {inv.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {inv.customerPhone}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-bold text-slate-700">
                        {inv.totalUnits}
                      </td>

                      <td className="py-4 px-6 text-right font-mono font-black text-slate-900 text-base">
                        {formatCurrency(inv.total, inv.currency || company.currency)}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <select
                          value={inv.status}
                          onChange={(e) =>
                            handleStatusChange(inv.id, e.target.value as InvoiceStatus)
                          }
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 border focus:outline-hidden cursor-pointer ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : inv.status === 'issued'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : inv.status === 'overdue'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="draft">DRAFT</option>
                          <option value="issued">ISSUED</option>
                          <option value="paid">PAID</option>
                          <option value="overdue">OVERDUE</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Full Document Modal Button */}
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="px-2.5 py-1 text-xs font-black uppercase text-slate-900 hover:bg-slate-900 hover:text-white transition cursor-pointer border border-slate-200"
                            title="預覽發票與送貨單"
                          >
                            VIEW
                          </button>

                          {/* Fast Print DO (Delivery Note) Button */}
                          <button
                            onClick={() => handleQuickPrintDO(inv)}
                            className="px-2 py-1 text-xs font-black uppercase text-sky-700 hover:bg-sky-600 hover:text-white transition cursor-pointer border border-sky-200 bg-sky-50"
                            title="一鍵列印送貨單 (DO)"
                          >
                            🚚 DO
                          </button>

                          {/* WhatsApp Direct Share */}
                          <a
                            href={whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                            title="Share via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>

                          {/* Edit Button */}
                          <button
                            onClick={() => onEditInvoice(inv)}
                            className="p-1 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                            title="Edit Invoice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Duplicate Button */}
                          <button
                            onClick={() => onDuplicateInvoice(inv)}
                            className="p-1 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                            title="Duplicate as New"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounting Report Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-6 sm:p-8 space-y-6 border-2 border-slate-900 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  ACCOUNTING & SETTLEMENT
                </p>
                <h3 className="font-black text-xl text-slate-900 uppercase mt-0.5 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>會計對帳報表匯出 (EXCEL / CSV)</span>
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {exportSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-3 font-bold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{exportSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Option 1: Report Type */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  1. 選擇報表格式 (Report Type)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportReportType('summary')}
                    className={`p-3 text-left border-2 transition cursor-pointer ${
                      exportReportType === 'summary'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-900 uppercase">
                      發票總覽匯總報表
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      每張單據一行（客戶、小計、佣金折扣、應收總額、付款狀態）
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportReportType('detailed')}
                    className={`p-3 text-left border-2 transition cursor-pointer ${
                      exportReportType === 'detailed'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-900 uppercase">
                      產品銷量明細清單
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                      逐項列出每張單售出的貨品品名、數量、單價、金額
                    </div>
                  </button>
                </div>
              </div>

              {/* Option 2: Date Range */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  2. 選擇匯出時間區間 (Date Range)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: `全部發票紀錄 (${invoices.length} 筆)` },
                    { id: 'current_month', label: '本月份 (This Month)' },
                    { id: 'last_month', label: '上月份 (Last Month)' },
                    { id: 'current_filter', label: `目前篩選清單 (${sortedInvoices.length} 筆)` },
                  ].map((range) => (
                    <button
                      key={range.id}
                      type="button"
                      onClick={() => setExportDateRange(range.id as any)}
                      className={`p-2.5 text-left border text-xs font-bold transition cursor-pointer ${
                        exportDateRange === range.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compatibility Notice */}
              <div className="bg-slate-50 p-3 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">💡 Excel / Google Sheets 支援：</div>
                <p>
                  產生的 CSV 檔案預設包含 <strong>UTF-8 BOM 編碼</strong>，在 Microsoft Excel、Numbers 或 Google 試算表中雙擊開啟均能完美顯示繁體中文與金額數字，無亂碼問題。
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executeAccountingExport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>立即下載 CSV 報表</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
