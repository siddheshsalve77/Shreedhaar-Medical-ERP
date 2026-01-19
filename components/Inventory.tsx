import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product, ProductCategory } from '../types';
import { Plus, Camera, Search, Check, AlertTriangle, Trash2, Edit2 } from 'lucide-react';
declare const Tesseract: any;

const CATEGORIES: ProductCategory[] = ['Syrup', 'Tablet/Medicine', 'Lotion', 'Cosmetics', 'Sanitary Pad', 'Others'];

const Inventory: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  // Form State
  const initialFormState: Product = {
    id: '',
    name: '',
    category: 'Tablet/Medicine',
    batch: '',
    expiryDate: '',
    buyPrice: 0,
    sellPrice: 0,
    stock: 0,
    location: ''
  };
  const [formData, setFormData] = useState<Product>(initialFormState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({ ...initialFormState, id: Date.now().toString() });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const exists = products.find(p => p.id === formData.id);
    if (exists) {
      updateProduct(formData);
    } else {
      addProduct(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if(window.confirm("Are you sure you want to remove this item from inventory?")) {
          deleteProduct(id);
      }
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsScanning(true);
      const image = e.target.files[0];
      try {
        const { data: { text } } = await Tesseract.recognize(image, 'eng');
        const lines = text.split('\n');
        let detectedName = lines[0] || '';
        const dateRegex = /(\d{2}[/-]\d{2}[/-]\d{4})|(\d{4}[/-]\d{2}[/-]\d{2})/;
        const dateMatch = text.match(dateRegex);
        const detectedExpiry = dateMatch ? dateMatch[0] : '';

        setFormData(prev => ({
          ...prev,
          name: detectedName || prev.name,
          expiryDate: detectedExpiry || prev.expiryDate
        }));
      } catch (err) {
        alert('Failed to scan image.');
      } finally {
        setIsScanning(false);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-teal-800 text-white px-4 py-2 rounded-lg hover:bg-teal-900 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>Add Medicine</span>
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search Name or Category..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm bg-white text-gray-900 placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Product</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Expiry</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Sell Price</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.map(product => {
              const threeMonthsFromNow = new Date();
              threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
              const isLowStock = product.stock < 10;
              const isExpired = new Date(product.expiryDate) < new Date();
              const isNearExpiry = new Date(product.expiryDate) < threeMonthsFromNow;
              const isWarning = isLowStock || isExpired || isNearExpiry;

              return (
                <tr key={product.id} className={`transition-colors ${isWarning ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{product.category}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{product.location || '-'}</td>
                  <td className={`px-6 py-4 ${isExpired || isNearExpiry ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                    {product.expiryDate} {isExpired && '(Exp)'}
                  </td>
                  <td className={`px-6 py-4 ${isLowStock ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                    {product.stock}
                  </td>
                  <td className="px-6 py-4 text-gray-600">₹{product.sellPrice}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center space-x-3">
                        <button onClick={() => handleOpenModal(product)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                            <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete">
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-teal-800">{products.find(p=>p.id===formData.id) ? 'Edit Product' : 'Add New Medicine'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
               {/* AI Section */}
              <div className="bg-teal-50 p-4 rounded-lg flex items-center justify-between mb-4 border border-teal-100">
                 <div className="flex items-center space-x-2 text-teal-800">
                    <Camera size={20} />
                    <span className="font-medium">Web AI Auto-Fill</span>
                 </div>
                 <div className="flex items-center space-x-2">
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleOCR} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="bg-white border border-teal-300 text-teal-700 px-3 py-1.5 rounded-md text-sm hover:bg-teal-100 transition disabled:opacity-50">
                      {isScanning ? 'Scanning Wrapper...' : 'Scan Medicine Wrapper'}
                    </button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ProductCategory})}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                  <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location (Rack/Shelf)</label>
                  <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input required type="date" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input required type="number" min="0" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buy Price (₹)</label>
                  <input required type="number" min="0" step="0.01" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.buyPrice} onChange={e => setFormData({...formData, buyPrice: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price (₹)</label>
                  <input required type="number" min="0" step="0.01" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: parseFloat(e.target.value)})} />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 shadow-sm flex items-center">
                  <Check size={18} className="mr-2" /> Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
