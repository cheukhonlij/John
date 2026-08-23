import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Product, Invoice, CompanyProfile, InvoiceItem, DiscountType, InvoiceStatus } from '../types';
import { InvoicePreview } from './InvoicePreview';
import { 
  FileText, Sparkles, Plus, Trash2, Printer, Download, 
  MessageCircle, Save, RotateCcw, Search, Eye, 
  Check, UserPlus, Sliders, ChevronDown, ChevronUp,
  Tag, Info, HelpCircle, Image as ImageIcon, ExternalLink, Copy,
  Truck, ArrowUpRight, DollarSign, History
} from 'lucide-react';
import { 
  printInvoiceStandalone,
  downloadInvoiceStandaloneFile,
  generateWhatsAppShareUrl, 
  generateEmailShareUrl,
} from '../utils/pdfExport';
import { getStoredInvoices } from '../utils/storage';
import { getCustomerPriceHistory, CustomerProductPriceInfo } from '../utils/pricing';
import confetti from 'canvas-confetti';

interface InvoiceEditorProps {
  initialInvoice?: Invoice | null;
  products: Product[];
  customers: Customer[];
  company: CompanyProfile;
  onSaveInvoice: (invoice: Invoice) => void;
  onSaveNewCustomer: (customer: Customer) => void;
  onViewHistory: () => void;
}

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({
  initialInvoice,
  products,
  customers,
  company,
  onSaveInvoice,
  onSaveNewCustomer,
  onViewHistory,
}) => {
  // Invoice Metadata state
  const [invoiceId, setInvoiceId] = useState<string>(
    initialInvoice ? initialInvoice.id : `inv-${Date.now()}`
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    initialInvoice ? initialInvoice.invoiceNumber : generateInvoiceNum()
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialInvoice ? initialInvoice.date : getTodayFormatted()
  );
  const [status, setStatus] = useState<InvoiceStatus>(
    initialInvoice ? initialInvoice.status : 'issued'
  );

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialInvoice?.customerId || ''
  );
  const [customerName, setCustomerName] = useState<string>(
    initialInvoice ? initialInvoice.customerName : 'Mary'
  );
  const [customerCode, setCustomerCode] = useState<string>(
    initialInvoice ? initialInvoice.customerCode : 'UN'
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialInvoice ? initialInvoice.customerPhone : '64095115'
  );
  const [customerAddress, setCustomerAddress] = useState<string>(
    initialInvoice ? initialInvoice.customerAddress : ''
  );

  // Items State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [hideZeroItems, setHideZeroItems] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // Custom Item Form
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomRate, setNewCustomRate] = useState('');
  const [newCustomQty, setNewCustomQty] = useState('1');
  const [newCustomUnit, setNewCustomUnit] = useState('包');

  // Financial Adjustments
  const [discountType, setDiscountType] = useState<DiscountType>(
    initialInvoice ? initialInvoice.discountType : 'amount'
  );
  const [discountValue, setDiscountValue] = useState<number>(
    initialInvoice ? initialInvoice.discountValue : 0
  );
  const [discountLabel, setDiscountLabel] = useState<string>(
    initialInvoice ? initialInvoice.discountLabel : 'Discount / Commission'
  );
  const [outstanding, setOutstanding] = useState<number>(
    initialInvoice ? initialInvoice.outstanding : 0
  );
  const [currency, setCurrency] = useState<string>(
    initialInvoice ? initialInvoice.currency : company.currency || 'HK$'
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initialInvoice ? initialInvoice.paymentTerms : company.defaultPaymentTerms
  );

  // UI state
  const [previewDocMode, setPreviewDocMode] = useState<'invoice' | 'delivery_note'>('invoice');
  const [isExporting, setIsExporting] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showQuickPresets, setShowQuickPresets] = useState(true);
  const [activeTabMobile, setActiveTabMobile] = useState<'editor' | 'preview'>('editor');
  const [exportNotice, setExportNotice] = useState<{ open: boolean; filename: string; blobUrl?: string; type: 'pdf' | 'png' } | null>(null);
  const [appliedPriceNotice, setAppliedPriceNotice] = useState<string | null>(null);

  // Customer Price History calculation
  const customerPriceHistory = useMemo(() => {
    const allInvoices = getStoredInvoices();
    return getCustomerPriceHistory(allInvoices, selectedCustomerId, customerName, customerCode);
  }, [selectedCustomerId, customerName, customerCode]);

  const priceHistoryCount = customerPriceHistory.size;

  // Initialize items from products catalog or existing invoice
  useEffect(() => {
    if (initialInvoice && initialInvoice.items) {
      setInvoiceId(initialInvoice.id);
      setInvoiceNumber(initialInvoice.invoiceNumber);
      setInvoiceDate(initialInvoice.date);
      setCustomerName(initialInvoice.customerName);
      setCustomerCode(initialInvoice.customerCode);
      setCustomerPhone(initialInvoice.customerPhone);
      setCustomerAddress(initialInvoice.customerAddress || '');
      setSelectedCustomerId(initialInvoice.customerId || '');
      setDiscountType(initialInvoice.discountType || 'amount');
      setDiscountValue(initialInvoice.discountValue || 0);
      setDiscountLabel(initialInvoice.discountLabel || 'Discount / Commission');
      setOutstanding(initialInvoice.outstanding || 0);
      setCurrency(initialInvoice.currency || 'HK$');
      setPaymentTerms(initialInvoice.paymentTerms || company.defaultPaymentTerms);
      setStatus(initialInvoice.status || 'issued');

      // Merge products with existing invoice items
      const existingMap = new Map<string, InvoiceItem>(
        initialInvoice.items.map((i) => [i.name, i])
      );
      const initialized: InvoiceItem[] = products.map((prod) => {
        const existing = existingMap.get(prod.name);
        return {
          id: existing ? existing.id : `item-${prod.id}`,
          productId: prod.id,
          name: prod.name,
          category: prod.category,
          rate: existing ? existing.rate : prod.defaultRate,
          qty: existing ? existing.qty : 0,
          unit: prod.unit,
        };
      });

      // Also append any custom items not in products catalog
      initialInvoice.items.forEach((item) => {
        if (!products.some((p) => p.name === item.name)) {
          initialized.push({ ...item });
        }
      });

      setItems(initialized);
    } else {
      // Default: create items from all catalog products with qty 0
      const initialized: InvoiceItem[] = products.map((prod) => ({
        id: `item-${prod.id}`,
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        rate: prod.defaultRate,
        qty: 0,
        unit: prod.unit,
      }));

      // Pre-set Mary sample if brand new
      const sweetPotato = initialized.find((i) => i.name.includes('烤日本蕃薯'));
      if (sweetPotato) sweetPotato.qty = 15;

      setItems(initialized);
    }
  }, [initialInvoice, products]);

  function generateInvoiceNum() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);
    return `${yyyy}${dd}${mm}${rand}`;
  }

  function getTodayFormatted() {
    const today = new Date();
    return `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  }

  // Calculations
  const totalUnits = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const subtotal = items.reduce((sum, item) => {
    if (item.rate !== null && item.qty > 0) {
      return sum + item.qty * item.rate;
    }
    return sum;
  }, 0);

  const discountAmount =
    discountType === 'percent'
      ? subtotal * ((discountValue || 0) / 100)
      : (discountValue || 0);

  const total = Math.max(0, subtotal - discountAmount - (outstanding || 0));

  const isDO = previewDocMode === 'delivery_note';

  const currentInvoiceData: Invoice = {
    id: invoiceId,
    invoiceNumber,
    date: invoiceDate,
    customerId: selectedCustomerId,
    customerName: customerName || 'Walk-in Client',
    customerCode,
    customerPhone,
    customerAddress,
    items,
    totalUnits,
    subtotal,
    discountType,
    discountValue,
    discountLabel,
    discountAmount,
    outstanding,
    total,
    currency,
    paymentTerms,
    status,
    createdAt: initialInvoice?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Customer dropdown select
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;
    const client = customers.find((c) => c.id === customerId);
    if (client) {
      setCustomerName(client.name);
      setCustomerCode(client.code || '');
      setCustomerPhone(client.phone || '');
      setCustomerAddress(client.address || '');

      // Check if price memory exists
      const allInvoices = getStoredInvoices();
      const historyMap = getCustomerPriceHistory(allInvoices, client.id, client.name, client.code);
      if (historyMap.size > 0) {
        setAppliedPriceNotice(`已偵測到「${client.name}」有 ${historyMap.size} 款專屬歷史成交價`);
      }
    }
  };

  // One-click apply all past customer prices
  const handleApplyAllCustomerPrices = () => {
    if (priceHistoryCount === 0) return;
    let appliedCount = 0;
    setItems((prev) =>
      prev.map((item) => {
        const hist = customerPriceHistory.get(item.name.trim().toLowerCase());
        if (hist && hist.lastRate !== item.rate) {
          appliedCount++;
          return { ...item, rate: hist.lastRate };
        }
        return item;
      })
    );
    setAppliedPriceNotice(`已成功為 ${customerName} 套用 ${appliedCount} 款歷史特價！`);
    setTimeout(() => setAppliedPriceNotice(null), 3500);
  };

  // Quick save current customer to database
  const handleSaveCurrentCustomer = () => {
    if (!customerName.trim()) {
      alert('請先輸入客戶名稱！');
      return;
    }
    const newCust: Customer = {
      id: `c_${Date.now()}`,
      name: customerName.trim(),
      code: customerCode.trim(),
      phone: customerPhone.trim(),
      address: customerAddress.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onSaveNewCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    alert(`客戶「${customerName}」已成功儲存至客戶資料庫！`);
  };

  // Update item quantity
  const updateItemQty = (id: string, newQtyStr: string) => {
    const newQty = newQtyStr === '' ? 0 : Math.max(0, parseFloat(newQtyStr) || 0);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
    );
  };

  // Update item rate
  const updateItemRate = (id: string, newRateStr: string) => {
    const newRate = newRateStr === '' ? null : parseFloat(newRateStr);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rate: newRate } : item))
    );
  };

  // Add custom line item
  const handleAddCustomItem = () => {
    if (!newCustomName.trim()) {
      alert('請輸入貨品名稱');
      return;
    }
    const parsedRate = newCustomRate !== '' ? parseFloat(newCustomRate) : null;
    const parsedQty = parseFloat(newCustomQty) || 1;

    const newItem: InvoiceItem = {
      id: `custom-${Date.now()}`,
      name: newCustomName.trim(),
      rate: parsedRate,
      qty: parsedQty,
      unit: newCustomUnit.trim() || '包',
      category: '自訂項目',
    };

    setItems((prev) => [newItem, ...prev]);
    setNewCustomName('');
    setNewCustomRate('');
    setNewCustomQty('1');
  };

  const handleClearAllQty = () => {
    if (confirm('確定要將所有貨品數量清零嗎？')) {
      setItems((prev) => prev.map((item) => ({ ...item, qty: 0 })));
    }
  };

  const handleResetForm = () => {
    if (confirm('確定要重設目前發票的所有輸入內容嗎？')) {
      setInvoiceNumber(generateInvoiceNum());
      setInvoiceDate(getTodayFormatted());
      setCustomerName('');
      setCustomerCode('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedCustomerId('');
      setDiscountValue(0);
      setOutstanding(0);
      setItems(
        products.map((p) => ({
          id: `item-${p.id}`,
          productId: p.id,
          name: p.name,
          category: p.category,
          rate: p.defaultRate,
          qty: 0,
          unit: p.unit,
        }))
      );
    }
  };

  // Preset loading helpers
  const loadPreset = (key: string) => {
    const fresh = products.map((p) => ({
      id: `item-${p.id}`,
      productId: p.id,
      name: p.name,
      category: p.category,
      rate: p.defaultRate,
      qty: 0,
      unit: p.unit,
    }));

    setDiscountValue(0);
    setOutstanding(0);
    setDiscountType('amount');
    setDiscountLabel('Commission');

    const setQ = (nameKeyword: string, qty: number) => {
      const it = fresh.find((i) => i.name.includes(nameKeyword));
      if (it) it.qty = qty;
    };
    const setR = (nameKeyword: string, rate: number) => {
      const it = fresh.find((i) => i.name.includes(nameKeyword));
      if (it) it.rate = rate;
    };

    if (key === 'c1') {
      handleSelectCustomer('c1');
      setCustomerName('Mary');
      setCustomerCode('UN');
      setCustomerPhone('64095115');
      setCustomerAddress('');
      setInvoiceDate('20/4/2026');
      setInvoiceNumber('20262004001');
      setQ('烤日本蕃薯', 15);
    } else if (key === 'c2') {
      handleSelectCustomer('c2');
      setCustomerName('Pick and Match');
      setCustomerCode('PM');
      setCustomerPhone('Ging 62893834');
      setCustomerAddress('香港九龍觀塘興業街');
      setInvoiceDate('1/6/2026');
      setInvoiceNumber('20260106002');
      setR('田園香草', 18); setQ('田園香草', 25);
      setR('蒜味香草', 18); setQ('蒜味香草', 15);
      setR('秘製黑椒', 18); setQ('秘製黑椒', 38);
      setR('四川麻辣', 18); setQ('四川麻辣', 20);
      setR('風味沙薑', 18); setQ('風味沙薑', 25);
      setR('惹味孜然', 18); setQ('惹味孜然', 15);
      setR('越式香茅', 18); setQ('越式香茅', 15);
      setQ('Defect Chicken Breast', 11);
      setQ('Form Board Share', 0.5);
      setDiscountType('percent');
      setDiscountValue(40);
      setDiscountLabel('Commission 40%');
    } else if (key === 'c3') {
      handleSelectCustomer('c3');
      setCustomerName('Soulstar');
      setCustomerCode('SS');
      setCustomerPhone('Paris 96918123');
      setInvoiceDate('27/5/2026');
      setInvoiceNumber('20262705001');
      setQ('招牌原味', 5); setQ('蒜味香草', 5); setQ('秘製黑椒', 5);
      setQ('日式照燒', 5); setQ('泰式香辣', 5); setQ('四川麻辣', 5);
      setQ('田園香草', 5); setQ('風味沙薑', 5); setQ('惹味孜然', 5);
      setQ('越式香茅', 5); setQ('即食雞胸肉丸 原味', 3); setQ('即食雞胸肉丸 黑松露', 3);
      setQ('牛腱', 5); setQ('醉翼', 2); setQ('烤日本蕃薯', 10); setQ('焗南瓜片', 6);
    } else if (key === 'c4') {
      handleSelectCustomer('c4');
      setCustomerName('GMC');
      setCustomerCode('GMC');
      setCustomerPhone('King 98462061');
      setInvoiceDate('2/7/2026');
      setInvoiceNumber('20260207002');
      setR('招牌原味', 12.3); setQ('招牌原味', 44);
      setR('蒜味香草', 12.3); setQ('蒜味香草', 16);
      setR('秘製黑椒', 12.3); setQ('秘製黑椒', 15);
      setR('日式照燒', 12.3); setQ('日式照燒', 10);
      setR('四川麻辣', 12.3); setQ('四川麻辣', 7);
      setR('風味沙薑', 12.3); setQ('風味沙薑', 16);
      setR('惹味孜然', 12.3); setQ('惹味孜然', 12);
    } else if (key === 'c5') {
      handleSelectCustomer('c5');
      setCustomerName('台沐');
      setCustomerCode('Kokoyu');
      setCustomerPhone('Otto +852 92733330');
      setCustomerAddress('北角匯二期109號鋪');
      setInvoiceDate('30/6/2026');
      setInvoiceNumber('20263006001');
      setR('秘製黑椒', 11); setQ('秘製黑椒', 30);
      setR('日式照燒', 11); setQ('日式照燒', 75);
      setR('泰式香辣', 11); setQ('泰式香辣', 8);
      setR('風味沙薑', 11); setQ('風味沙薑', 65);
      setQ('紅天使番薯(1Kg)', 8); setQ('焗南瓜片', 70);
    } else if (key === 'c8') {
      handleSelectCustomer('c8');
      setCustomerName('金二少冰室');
      setCustomerCode('KM');
      setCustomerPhone('Issac Chau 67710322');
      setCustomerAddress('九龍柯士甸道地下71號');
      setInvoiceDate('28/5/2026');
      setInvoiceNumber('20262805001');
      setR('招牌原味', 9); setQ('招牌原味', 300);
    }

    setItems(fresh);
  };

  // Actions
  const handleSaveToHistory = () => {
    onSaveInvoice(currentInvoiceData);
    setSavedFeedback(true);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  const handlePrintOrPDF = () => {
    setIsExporting(true);
    try {
      onSaveInvoice(currentInvoiceData);
      const res = printInvoiceStandalone(currentInvoiceData, company, isDO);
      if (res.success) {
        const typeTag = isDO ? 'DeliveryNote_DO' : 'Invoice';
        setExportNotice({
          open: true,
          filename: `${typeTag}_${invoiceNumber}_${customerName || 'Client'}.html`,
          blobUrl: res.blobUrl,
          type: 'pdf',
        });
        confetti({ particleCount: 40, spread: 50 });
      }
    } catch (e: any) {
      alert(`列印出錯: ${e?.message || '未知錯誤'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = () => {
    setIsExporting(true);
    try {
      onSaveInvoice(currentInvoiceData);
      const res = downloadInvoiceStandaloneFile(currentInvoiceData, company, isDO);
      if (res.success) {
        setExportNotice({
          open: true,
          filename: res.filename,
          blobUrl: res.blobUrl,
          type: 'pdf',
        });
        confetti({ particleCount: 40, spread: 50 });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const filteredItems = items.filter((it) => {
    const matchesSearch = it.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat =
      selectedCatFilter === 'all' || it.category === selectedCatFilter;
    return matchesSearch && matchesCat;
  });

  const whatsAppUrl = generateWhatsAppShareUrl(currentInvoiceData, company, isDO);
  const emailUrl = generateEmailShareUrl(currentInvoiceData, company, isDO);

  return (
    <div className="space-y-8">
      {/* Mobile Tab Toggle */}
      <div className="lg:hidden flex bg-white p-1 border border-slate-200 shadow-xs">
        <button
          onClick={() => setActiveTabMobile('editor')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTabMobile === 'editor'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          INVOICE BUILDER
        </button>
        <button
          onClick={() => setActiveTabMobile('preview')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTabMobile === 'preview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>LIVE A4 PREVIEW</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: CONTROLS & FORM */}
        <div
          className={`lg:col-span-6 space-y-6 ${
            activeTabMobile === 'editor' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Quick Preset Samples Card */}
          <div className="bg-slate-900 text-white p-5 border border-slate-800 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>QUICK ORDER PRESETS (快速批發單範本)</span>
              </span>
              <button
                onClick={() => setShowQuickPresets(!showQuickPresets)}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              >
                {showQuickPresets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showQuickPresets && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'c1', label: 'Mary (烤蕃薯 15包)' },
                  { id: 'c2', label: 'Pick and Match (40%佣金)' },
                  { id: 'c3', label: 'Soulstar (綜合雞胸/蕃薯)' },
                  { id: 'c4', label: 'GMC ($12.3批發價)' },
                  { id: 'c5', label: '台沐 Kokoyu (北角門市)' },
                  { id: 'c8', label: '金二少冰室 (300包)' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadPreset(p.id)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 hover:border-slate-500 transition cursor-pointer text-xs font-bold text-slate-200 truncate"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 1: Customer & Invoice Meta */}
          <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>1. CLIENT & INVOICE DETAILS</span>
              </h2>
              <button
                type="button"
                onClick={handleResetForm}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-600 uppercase flex items-center gap-1 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Form</span>
              </button>
            </div>

            {/* Price Memory Banner Notification */}
            {priceHistoryCount > 0 && (
              <div className="bg-emerald-50 border border-emerald-300 p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    已載入 <strong>{customerName}</strong> 歷史紀錄：共 <strong>{priceHistoryCount}</strong> 款貨品曾有專屬成交價
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAllCustomerPrices}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider transition shrink-0 cursor-pointer shadow-xs"
                >
                  一鍵套用歷史價
                </button>
              </div>
            )}

            {appliedPriceNotice && (
              <div className="bg-blue-50 border border-blue-300 p-2.5 text-blue-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{appliedPriceNotice}</span>
              </div>
            )}

            {/* Quick Customer Picker Dropdown */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Select from Saved Clients
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider focus:border-slate-900 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- CHOOSE A CUSTOMER DIRECTORY ENTRY --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `[${c.code}]` : ''} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSaveCurrentCustomer}
                  title="儲存此客戶資料"
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">SAVE CLIENT</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Customer Name (Bill To) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Mary or Pick and Match"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Client Code (Optional)
                </label>
                <input
                  type="text"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  placeholder="e.g. UN, PM, GMC"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Invoice Number #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Customer Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 64095115"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Invoice Settlement Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-wider focus:border-slate-900 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="issued">ISSUED (已發出)</option>
                  <option value="paid">PAID (已收款)</option>
                  <option value="draft">DRAFT (草稿)</option>
                  <option value="overdue">OVERDUE (逾期)</option>
                  <option value="cancelled">CANCELLED (已取消)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Delivery Destination / Address (送貨地址)
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. 北角匯二期109號鋪"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Products Catalog & Order Lines */}
          <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>2. ORDER ITEMS ({items.filter(i => i.qty > 0).length} ITEMS ORDERED)</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {priceHistoryCount > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyAllCustomerPrices}
                    className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 bg-emerald-100 px-2 py-0.5 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    title="套用該客戶上次成交價"
                  >
                    <History className="w-3 h-3" />
                    <span>套用上次價</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearAllQty}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-600 uppercase flex items-center gap-1 cursor-pointer transition"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All Qty</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar for Products */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="SEARCH PRODUCT..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-wider focus:border-slate-900 focus:outline-hidden cursor-pointer"
              >
                <option value="all">ALL CATEGORIES</option>
                {Array.from(new Set(products.map((p) => p.category))).map((cat) => (
                  <option key={String(cat)} value={String(cat)}>
                    {String(cat).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Display Mode Toggle */}
            <div className="bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                Invoice Table Display:
              </span>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideZeroItems}
                  onChange={(e) => setHideZeroItems(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-8 h-4.5 bg-slate-300 peer-focus:outline-hidden peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                <span className="ms-2.5 text-[11px] font-black uppercase tracking-wider text-slate-900">
                  {hideZeroItems ? 'HIDE 0 QTY ITEMS' : 'SHOW ALL CATALOG'}
                </span>
              </label>
            </div>

            {/* Scrollable Products List with Price History Memory Badges */}
            <div className="space-y-2 max-h-88 overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const hasQty = item.qty > 0;
                const hist = customerPriceHistory.get(item.name.trim().toLowerCase());
                const isCustomRateMatched = hist && item.rate === hist.lastRate;
                const hasDifferentHistRate = hist && item.rate !== hist.lastRate;

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 border transition ${
                      hasQty
                        ? 'bg-slate-50 border-slate-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate" title={item.name}>
                          <span>{item.name}</span>
                          {item.unit && (
                            <span className="text-[10px] text-slate-400 ml-1 font-normal">({item.unit})</span>
                          )}
                        </div>

                        {/* Customer Last Price Memory Pill */}
                        {hist && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {hasDifferentHistRate ? (
                              <button
                                type="button"
                                onClick={() => updateItemRate(item.id, String(hist.lastRate))}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider rounded-xs cursor-pointer transition"
                                title={`點擊套用該客戶上次成交價 $${hist.lastRate}`}
                              >
                                <History className="w-2.5 h-2.5" />
                                <span>上次成交: ${hist.lastRate} (點擊套用)</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold uppercase rounded-xs">
                                <Check className="w-2.5 h-2.5 text-emerald-700" />
                                <span>專屬成交價 ${hist.lastRate}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-24 flex items-center">
                        <span className="text-slate-400 text-xs font-mono mr-1">$</span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.rate !== null ? item.rate : ''}
                          placeholder="Rate"
                          onChange={(e) => updateItemRate(item.id, e.target.value)}
                          className="w-full p-1 border border-slate-200 text-xs text-right bg-white font-mono font-bold focus:border-slate-900 focus:outline-hidden"
                        />
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.qty > 0 ? item.qty : ''}
                          placeholder="0"
                          onChange={(e) => updateItemQty(item.id, e.target.value)}
                          className={`w-full p-1 border text-xs text-right font-black font-mono focus:border-slate-900 focus:outline-hidden ${
                            hasQty ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom line item insertion */}
            <div className="pt-4 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                placeholder="CUSTOM ITEM NAME (自訂品項)"
                value={newCustomName}
                onChange={(e) => setNewCustomName(e.target.value)}
                className="flex-1 p-2 bg-slate-50 border border-slate-200 text-xs font-bold uppercase focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
              <input
                type="number"
                placeholder="RATE$"
                step="0.5"
                value={newCustomRate}
                onChange={(e) => setNewCustomRate(e.target.value)}
                className="w-20 p-2 bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 whitespace-nowrap cursor-pointer transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>+ ADD ITEM</span>
              </button>
            </div>
          </div>

          {/* Section 3: Financials, Discount & Notes */}
          <div className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <span>3. DISCOUNT, TERMS & BANKING</span>
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Commission / Discount Deductions
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="p-2.5 border border-slate-200 text-xs bg-slate-100 font-black uppercase tracking-wider focus:border-slate-900 focus:outline-hidden"
                  >
                    <option value="amount">$</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Discount / Commission Label
                </label>
                <input
                  type="text"
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  placeholder="e.g. Commission 40%"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Outstanding / Prepaid Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={outstanding || ''}
                  onChange={(e) => setOutstanding(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 text-sm font-mono font-black focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Footer Payment Terms & Banking Info
              </label>
              <textarea
                rows={3}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE INVOICE PREVIEW & FLOATING ACTIONS */}
        <div
          className={`lg:col-span-6 space-y-6 ${
            activeTabMobile === 'preview' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Action Bar with Document Mode Switcher */}
          <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-3 sticky top-16 z-20">
            {/* Mode Switcher Segmented Button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3 flex-wrap">
              <div className="flex items-center bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewDocMode('invoice')}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    !isDO ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>📄 發票 (Invoice)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDocMode('delivery_note')}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isDO ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>🚚 送貨單 (Delivery Note)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToHistory}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SAVE</span>
                </button>

                {savedFeedback && (
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1 animate-in fade-in">
                    <Check className="w-4 h-4" /> SAVED!
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Primary Print / Save as PDF Button */}
                <button
                  type="button"
                  onClick={handlePrintOrPDF}
                  disabled={isExporting}
                  title={`開啟獨立列印視窗 (${isDO ? '送貨單' : '發票'})`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>PRINT / 另存 PDF ({isDO ? '送貨單' : '發票'})</span>
                </button>

                {/* Download Standalone File */}
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={isExporting}
                  title={`下載 ${isDO ? '送貨單' : '發票'} 檔案`}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider border border-slate-900 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載檔案</span>
                </button>

                {/* WhatsApp */}
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-black uppercase tracking-wider border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
                  title="Send via WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WHATSAPP</span>
                </a>
              </div>
            </div>
          </div>

          {/* Live Preview Container */}
          <div className="bg-slate-200 p-3 sm:p-6 border border-slate-300 flex justify-center overflow-x-auto shadow-inner">
            <InvoicePreview
              invoice={currentInvoiceData}
              company={company}
              containerId="liveInvoicePreview"
              hideZeroItems={hideZeroItems}
              isDeliveryNote={isDO}
            />
          </div>
        </div>
      </div>

      {/* Export Success Modal */}
      {exportNotice && exportNotice.open && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white max-w-md w-full p-6 border-2 border-slate-900 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 text-white flex items-center justify-center font-black">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
                  {isDO ? '送貨單' : '發票'}列印與檔案已就緒！
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {exportNotice.filename}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-200 text-xs space-y-2.5 text-slate-700">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>📁 列印與儲存說明：</span>
              </div>
              <p className="leading-relaxed">
                系統已自動開啟專用列印視窗。如您需要<strong>另存為 PDF</strong>，請在瀏覽器列印設定中將目標選擇為<strong>「另存為 PDF (Save as PDF)」</strong>。
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {/* Re-open print window */}
              {exportNotice.blobUrl && (
                <a
                  href={exportNotice.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>在新分頁開啟專用列印頁面</span>
                </a>
              )}

              {/* Direct Download Button */}
              {exportNotice.blobUrl && (
                <a
                  href={exportNotice.blobUrl}
                  download={exportNotice.filename}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-center font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>直接下載檔案 (Download HTML)</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setExportNotice(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider cursor-pointer mt-1"
              >
                關閉 (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
