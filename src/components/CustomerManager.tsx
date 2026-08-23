import React, { useState } from 'react';
import { Customer, Invoice } from '../types';
import { 
  Users, Plus, Search, Edit2, Trash2, Phone, MapPin, FileText, 
  Check, X, AlertCircle, ArrowUpRight, DollarSign, History, ChevronDown, ChevronUp 
} from 'lucide-react';
import { formatCurrency } from '../utils/pdfExport';
import { getCustomerPriceHistoryList } from '../utils/pricing';

interface CustomerManagerProps {
  customers: Customer[];
  invoices: Invoice[];
  onSaveCustomers: (customers: Customer[]) => void;
  onCreateInvoiceForCustomer: (customer: Customer) => void;
  currency: string;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({
  customers,
  invoices,
  onSaveCustomers,
  onCreateInvoiceForCustomer,
  currency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [expandedPricesCustomerId, setExpandedPricesCustomerId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setCode('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setCode(c.code || '');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('請輸入客戶名稱 (Bill To)！');
      return;
    }

    if (editingCustomer) {
      const updated = customers.map((c) =>
        c.id === editingCustomer.id
          ? {
              ...c,
              name: name.trim(),
              code: code.trim(),
              phone: phone.trim(),
              email: email.trim(),
              address: address.trim(),
              notes: notes.trim(),
            }
          : c
      );
      onSaveCustomers(updated);
    } else {
      const newCustomer: Customer = {
        id: `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        code: code.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onSaveCustomers([newCustomer, ...customers]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, customerName: string) => {
    if (confirm(`確定要刪除客戶「${customerName}」嗎？`)) {
      onSaveCustomers(customers.filter((c) => c.id !== id));
    }
  };

  // Calculate customer purchase stats
  const getCustomerStats = (customer: Customer) => {
    const custInvoices = invoices.filter(
      (inv) =>
        inv.customerId === customer.id ||
        (inv.customerCode && customer.code && inv.customerCode.trim().toLowerCase() === customer.code.trim().toLowerCase()) ||
        (inv.customerName && inv.customerName.toLowerCase() === customer.name.toLowerCase())
    );
    const totalSpent = custInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    return {
      orderCount: custInvoices.length,
      totalSpent,
    };
  };

  const toggleExpandPrices = (customerId: string) => {
    setExpandedPricesCustomerId(expandedPricesCustomerId === customerId ? null : customerId);
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            CRM & DIRECTORY
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase mt-1">
            CUSTOMERS & SPECIAL PRICING (客戶與專屬批發價)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Maintain client records, delivery destinations, price memory, and lifetime order volumes ({customers.length} clients total)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-blue-400" />
          <span>+ ADD CUSTOMER</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-5 border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="SEARCH CLIENT NAME, CODE, PHONE OR DELIVERY ADDRESS..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider focus:outline-hidden focus:border-slate-900 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white p-16 text-center text-slate-400 border border-slate-200">
            <p className="text-sm font-black uppercase tracking-wider text-slate-600">No Customers Found</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Click "+ Add Customer" to create your first client profile</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const stats = getCustomerStats(customer);
            const priceHistoryList = getCustomerPriceHistoryList(invoices, customer.id, customer.name, customer.code);
            const isPriceExpanded = expandedPricesCustomerId === customer.id;

            return (
              <div
                key={customer.id}
                className="bg-white p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-2 mb-3 pb-3 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {customer.code ? `CODE: ${customer.code}` : 'CLIENT'}
                      </p>
                      <h3 className="font-black text-lg text-slate-900 mt-0.5">
                        {customer.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(customer)}
                        className="p-1 text-slate-400 hover:text-slate-900 transition cursor-pointer"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact info list */}
                  <div className="space-y-2 text-xs text-slate-600 my-3">
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono font-bold text-slate-900">{customer.phone}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-600 font-medium line-clamp-2">{customer.address}</span>
                      </div>
                    )}
                    {customer.notes && (
                      <div className="text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 border border-slate-100 mt-2">
                        Note: {customer.notes}
                      </div>
                    )}
                  </div>

                  {/* Customer Price History Section */}
                  {priceHistoryList.length > 0 && (
                    <div className="my-3 border-t border-slate-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleExpandPrices(customer.id)}
                        className="w-full flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1.5 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span>專屬成交價記憶 ({priceHistoryList.length} 款產品)</span>
                        </div>
                        {isPriceExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isPriceExpanded && (
                        <div className="mt-2 bg-slate-50 border border-slate-200 p-2 space-y-1.5 max-h-40 overflow-y-auto text-xs animate-in fade-in duration-150">
                          {priceHistoryList.map((item) => (
                            <div key={item.productName} className="flex justify-between items-center py-1 border-b border-slate-200 last:border-0">
                              <span className="font-bold text-slate-800 text-[11px] truncate max-w-[60%]">{item.productName}</span>
                              <span className="font-mono font-black text-emerald-700 text-xs">
                                ${item.lastRate.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Purchase stats & New Invoice action */}
                <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                      TOTAL ({stats.orderCount} ORDERS)
                    </div>
                    <div className="text-base font-black font-mono text-slate-900">
                      {formatCurrency(stats.totalSpent, currency)}
                    </div>
                  </div>

                  <button
                    onClick={() => onCreateInvoiceForCustomer(customer)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>+ INVOICE</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-8 space-y-6 border-2 border-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {editingCustomer ? 'UPDATE PROFILE' : 'NEW CLIENT'}
                </p>
                <h3 className="font-black text-xl text-slate-900 uppercase mt-0.5">
                  {editingCustomer ? 'EDIT CUSTOMER' : 'ADD NEW CUSTOMER'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 p-1 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Customer Name (Bill To) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mary or Pick and Match"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                    autoFocus
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Client Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. UN, PM, GMC"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 64095115"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Delivery Destination / Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 北角匯二期109號鋪"
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Internal Notes & Commission Terms (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Tuesday delivery schedule, default 40% commission discount..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-medium focus:border-slate-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingCustomer ? 'SAVE CHANGES' : 'CREATE CUSTOMER'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
