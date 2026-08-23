import React, { useState } from 'react';
import { Product } from '../types';
import { PRODUCT_CATEGORIES } from '../data/defaultData';
import { Plus, Search, Edit2, Trash2, Tag, Check, X, Layers, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/pdfExport';

interface ProductManagerProps {
  products: Product[];
  onSaveProducts: (products: Product[]) => void;
  currency: string;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  onSaveProducts,
  currency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [rate, setRate] = useState<string>('');
  const [unit, setUnit] = useState('包');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory(PRODUCT_CATEGORIES[0]);
    setRate('');
    setUnit('包');
    setSku('');
    setDescription('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category || PRODUCT_CATEGORIES[0]);
    setRate(product.defaultRate !== null ? product.defaultRate.toString() : '');
    setUnit(product.unit || '包');
    setSku(product.sku || '');
    setDescription(product.description || '');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('請輸入貨品名稱！');
      return;
    }

    const parsedRate = rate.trim() !== '' ? parseFloat(rate) : null;
    if (parsedRate !== null && isNaN(parsedRate)) {
      setErrorMessage('請輸入有效的單價數字！');
      return;
    }

    if (editingProduct) {
      // Update existing
      const updated = products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: name.trim(),
              category,
              defaultRate: parsedRate,
              unit: unit.trim(),
              sku: sku.trim(),
              description: description.trim(),
            }
          : p
      );
      onSaveProducts(updated);
    } else {
      // Create new
      const newProd: Product = {
        id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: name.trim(),
        category,
        defaultRate: parsedRate,
        unit: unit.trim() || '包',
        sku: sku.trim(),
        description: description.trim(),
      };
      onSaveProducts([newProd, ...products]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, prodName: string) => {
    if (confirm(`確定要刪除貨品「${prodName}」嗎？`)) {
      const filtered = products.filter((p) => p.id !== id);
      onSaveProducts(filtered);
    }
  };

  const filteredProducts = products.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.category && prod.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (prod.sku && prod.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat =
      selectedCategory === 'all' || prod.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-8">
      {/* Header & Action Bar */}
      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            INVENTORY & CATALOG
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase mt-1">
            PRODUCTS CATALOG
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage all wholesale items, default rates, and measurement units ({products.length} products total)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>+ ADD PRODUCT</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="SEARCH PRODUCT NAME, CATEGORY OR SKU..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-xs font-bold uppercase tracking-wider focus:outline-hidden focus:border-slate-900 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900"
              >
                CLEAR
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-900 focus:border-slate-900 focus:outline-hidden"
            >
              <option value="all">ALL CATEGORIES</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`text-xs px-3 py-1.5 font-black uppercase tracking-wider transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ALL ({products.length})
          </button>
          {PRODUCT_CATEGORIES.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            if (count === 0 && selectedCategory !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 font-black uppercase tracking-wider transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid / Table */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-900">
            PRODUCT ITEMS ({filteredProducts.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">PRODUCT NAME</th>
                <th className="py-3.5 px-4">CATEGORY</th>
                <th className="py-3.5 px-4">DEFAULT RATE</th>
                <th className="py-3.5 px-4 text-center">UNIT</th>
                <th className="py-3.5 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <p className="text-sm font-black uppercase tracking-wider text-slate-600">No Products Found</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Click "+ Add Product" to create new items in catalog</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{prod.name}</div>
                      {prod.description && (
                        <div className="text-xs text-slate-400 mt-0.5 font-medium">{prod.description}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 border border-slate-200">
                        {prod.category || 'UNCATEGORIZED'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-black text-slate-900 text-base">
                      {prod.defaultRate !== null
                        ? formatCurrency(prod.defaultRate, currency)
                        : <span className="text-slate-400 font-normal text-xs">DYNAMIC</span>}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 border border-slate-200">
                        {prod.unit || '包'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="px-2.5 py-1 text-xs font-black uppercase text-slate-900 hover:bg-slate-900 hover:text-white transition cursor-pointer border border-slate-200"
                          title="Edit Product"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(prod.id, prod.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white max-w-lg w-full p-8 space-y-6 border-2 border-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {editingProduct ? 'UPDATE RECORD' : 'NEW ITEM'}
                </p>
                <h3 className="font-black text-xl text-slate-900 uppercase mt-0.5">
                  {editingProduct ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
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
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 秘製黑椒,即食雞胸 或 烤日本蕃薯"
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-xs font-black uppercase tracking-wider focus:border-slate-900 focus:outline-hidden"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Measurement Unit
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="包 / 件 / kg / 套"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Default Rate ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="13.00"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Product SKU (Optional)
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. CB-001"
                    className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-mono font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 180g Vacuum Sealed Pack"
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-sm font-bold focus:border-slate-900 focus:bg-white focus:outline-hidden"
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
                  <span>{editingProduct ? 'SAVE CHANGES' : 'CREATE PRODUCT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
