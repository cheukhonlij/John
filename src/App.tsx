import React, { useState, useEffect } from 'react';
import { 
  FileText, History, Layers, Users, Settings, 
  Plus, Printer, Download, Sparkles, Building2,
  ChevronRight, RefreshCw, Check, Menu, X
} from 'lucide-react';
import { Product, Customer, Invoice, CompanyProfile } from './types';
import { 
  getStoredProducts, saveStoredProducts, 
  getStoredCustomers, saveStoredCustomers, 
  getStoredInvoices, saveStoredInvoices, 
  getStoredCompany, saveStoredCompany 
} from './utils/storage';
import { getCustomerPriceHistory } from './utils/pricing';
import { DEFAULT_PRODUCTS, DEFAULT_CUSTOMERS, DEFAULT_INVOICES, DEFAULT_COMPANY } from './data/defaultData';
import { InvoiceEditor } from './components/InvoiceEditor';
import { InvoiceHistory } from './components/InvoiceHistory';
import { ProductManager } from './components/ProductManager';
import { CustomerManager } from './components/CustomerManager';
import { CompanySettings } from './components/CompanySettings';
import { InvoiceViewModal } from './components/InvoiceViewModal';

type NavTab = 'editor' | 'history' | 'products' | 'customers' | 'settings';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('editor');

  // Core app state
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);

  // Active invoice being edited or viewed
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Mobile menu open
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initial load from storage
  useEffect(() => {
    setProducts(getStoredProducts());
    setCustomers(getStoredCustomers());
    setInvoices(getStoredInvoices());
    setCompany(getStoredCompany());
  }, []);

  // Handlers
  const handleSaveProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveStoredProducts(newProducts);
  };

  const handleSaveCustomers = (newCustomers: Customer[]) => {
    setCustomers(newCustomers);
    saveStoredCustomers(newCustomers);
  };

  const handleSaveInvoices = (newInvoices: Invoice[]) => {
    setInvoices(newInvoices);
    saveStoredInvoices(newInvoices);
  };

  const handleSaveCompany = (newCompany: CompanyProfile) => {
    setCompany(newCompany);
    saveStoredCompany(newCompany);
  };

  const handleSaveSingleInvoice = (invoice: Invoice) => {
    const exists = invoices.some((i) => i.id === invoice.id);
    let updated: Invoice[];
    if (exists) {
      updated = invoices.map((i) => (i.id === invoice.id ? invoice : i));
    } else {
      updated = [invoice, ...invoices];
    }
    handleSaveInvoices(updated);
  };

  const handleSaveNewCustomer = (newCustomer: Customer) => {
    const updated = [newCustomer, ...customers.filter((c) => c.id !== newCustomer.id)];
    handleSaveCustomers(updated);
  };

  const handleCreateInvoiceForCustomer = (customer: Customer) => {
    const historyMap = getCustomerPriceHistory(invoices, customer.id, customer.name, customer.code);

    const newDraft: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `${new Date().getFullYear()}${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getMonth() + 1).padStart(2, '0')}${Math.floor(100 + Math.random() * 900)}`,
      date: `${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerCode: customer.code,
      customerPhone: customer.phone,
      customerAddress: customer.address || '',
      items: products.map((p) => {
        const hist = historyMap.get(p.name.trim().toLowerCase());
        return {
          id: `item-${p.id}`,
          productId: p.id,
          name: p.name,
          category: p.category,
          rate: hist ? hist.lastRate : p.defaultRate,
          qty: 0,
          unit: p.unit,
        };
      }),
      totalUnits: 0,
      subtotal: 0,
      discountType: 'amount',
      discountValue: 0,
      discountLabel: 'Commission',
      discountAmount: 0,
      outstanding: 0,
      total: 0,
      currency: company.currency || 'HK$',
      paymentTerms: company.defaultPaymentTerms,
      status: 'issued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEditingInvoice(newDraft);
    setCurrentTab('editor');
  };

  const handleEditInvoiceFromHistory = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCurrentTab('editor');
  };

  const handleDuplicateInvoice = (invoice: Invoice) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);

    const duplicated: Invoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      invoiceNumber: `${yyyy}${dd}${mm}${rand}`,
      date: `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    handleSaveSingleInvoice(duplicated);
    setEditingInvoice(duplicated);
    setCurrentTab('editor');
  };

  const handleResetAllData = () => {
    setProducts(DEFAULT_PRODUCTS);
    setCustomers(DEFAULT_CUSTOMERS);
    setInvoices(DEFAULT_INVOICES);
    setCompany(DEFAULT_COMPANY);

    saveStoredProducts(DEFAULT_PRODUCTS);
    saveStoredCustomers(DEFAULT_CUSTOMERS);
    saveStoredInvoices(DEFAULT_INVOICES);
    saveStoredCompany(DEFAULT_COMPANY);

    setEditingInvoice(null);
  };

  const startNewEmptyInvoice = () => {
    setEditingInvoice(null);
    setCurrentTab('editor');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Main Navigation Header with Bold Typography Theme */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-6">
          {/* Logo / Brand Name - High Contrast Bold Heading */}
          <div 
            onClick={startNewEmptyInvoice}
            className="flex items-center space-x-4 cursor-pointer group shrink-0"
          >
            <div className="w-11 h-11 bg-slate-900 text-white flex items-center justify-center font-black text-lg tracking-tighter group-hover:bg-blue-600 transition-colors">
              TL
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 uppercase">
                {company.name || "TODAY'S FOOD LAB"}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                B2B Invoice Suite v2.0
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs - Bold Uppercase Tracking */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            <button
              onClick={() => {
                setEditingInvoice(null);
                setCurrentTab('editor');
              }}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'editor'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentTab === 'editor' ? 'bg-blue-400' : 'bg-transparent border-2 border-slate-300'}`}></span>
              <span>+ Create Invoice</span>
            </button>

            <button
              onClick={() => setCurrentTab('history')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'history'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentTab === 'history' ? 'bg-blue-400' : 'bg-transparent border-2 border-slate-300'}`}></span>
              <span>History ({invoices.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('products')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'products'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentTab === 'products' ? 'bg-blue-400' : 'bg-transparent border-2 border-slate-300'}`}></span>
              <span>Products ({products.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('customers')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
                currentTab === 'customers'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentTab === 'customers' ? 'bg-blue-400' : 'bg-transparent border-2 border-slate-300'}`}></span>
              <span>Customers ({customers.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`px-3 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </nav>

          {/* Quick Header Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => {
                setEditingInvoice(null);
                setCurrentTab('editor');
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              + New Invoice
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-6 pt-3 pb-6 space-y-2 bg-white border-t border-slate-200">
            <button
              onClick={() => {
                setEditingInvoice(null);
                setCurrentTab('editor');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-black text-xs uppercase tracking-widest flex items-center justify-between ${
                currentTab === 'editor' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-50'
              }`}
            >
              <span>+ Create Invoice</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('history');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-black text-xs uppercase tracking-widest flex items-center justify-between ${
                currentTab === 'history' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-50'
              }`}
            >
              <span>Invoice History</span>
              <span className="font-mono text-xs">{invoices.length}</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('products');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-black text-xs uppercase tracking-widest flex items-center justify-between ${
                currentTab === 'products' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-50'
              }`}
            >
              <span>Products Catalog</span>
              <span className="font-mono text-xs">{products.length}</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('customers');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-black text-xs uppercase tracking-widest flex items-center justify-between ${
                currentTab === 'customers' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-50'
              }`}
            >
              <span>Customers Directory</span>
              <span className="font-mono text-xs">{customers.length}</span>
            </button>

            <button
              onClick={() => {
                setCurrentTab('settings');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-black text-xs uppercase tracking-widest flex items-center gap-2 ${
                currentTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-50'
              }`}
            >
              <span>Settings</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-1">
        {currentTab === 'editor' && (
          <InvoiceEditor
            initialInvoice={editingInvoice}
            products={products}
            customers={customers}
            company={company}
            onSaveInvoice={handleSaveSingleInvoice}
            onSaveNewCustomer={handleSaveNewCustomer}
            onViewHistory={() => setCurrentTab('history')}
          />
        )}

        {currentTab === 'history' && (
          <InvoiceHistory
            invoices={invoices}
            company={company}
            onSaveInvoices={handleSaveInvoices}
            onEditInvoice={handleEditInvoiceFromHistory}
            onDuplicateInvoice={handleDuplicateInvoice}
            onViewInvoice={(inv) => setViewingInvoice(inv)}
            onNewInvoice={startNewEmptyInvoice}
          />
        )}

        {currentTab === 'products' && (
          <ProductManager
            products={products}
            onSaveProducts={handleSaveProducts}
            currency={company.currency || 'HK$'}
          />
        )}

        {currentTab === 'customers' && (
          <CustomerManager
            customers={customers}
            invoices={invoices}
            onSaveCustomers={handleSaveCustomers}
            onCreateInvoiceForCustomer={handleCreateInvoiceForCustomer}
            currency={company.currency || 'HK$'}
          />
        )}

        {currentTab === 'settings' && (
          <CompanySettings
            company={company}
            onSaveCompany={handleSaveCompany}
            onResetAllData={handleResetAllData}
          />
        )}
      </main>

      {/* Full-screen Invoice View Modal */}
      {viewingInvoice && (
        <InvoiceViewModal
          invoice={viewingInvoice}
          company={company}
          onClose={() => setViewingInvoice(null)}
          onEdit={handleEditInvoiceFromHistory}
          onDuplicate={handleDuplicateInvoice}
        />
      )}
    </div>
  );
}
