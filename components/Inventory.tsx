import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { Plus, Camera, Search, Check, Trash2, Edit2, Image as ImageIcon, X } from 'lucide-react';
declare const Tesseract: any;

const Inventory: React.FC = () => {
  const { products, categories, addProduct, updateProduct, deleteProduct, addCategory } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Form State
  const initialFormState: Product = {
    id: '', name: '', category: 'Tablet/Medicine', batch: '', expiryDate: '',
    buyPrice: 0, sellPrice: 0, stock: 0, location: '', image: ''
  };
  const [formData, setFormData] = useState<Product>(initialFormState);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = (product?: Product) => {
    if (product) setFormData(product);
    else setFormData({ ...initialFormState, id: Date.now().toString() });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const exists = products.find(p => p.id === formData.id);
    if (exists) updateProduct(formData);
    else addProduct(formData);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if(window.confirm("Are you sure you want to remove this item from inventory?")) deleteProduct(id);
  };

  // --- IMAGE & OCR LOGIC ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 1. Create Base64 for Preview/Storage
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);

      // 2. Perform OCR
      performOCR(file);
    }
  };

  const performOCR = async (file: File) => {
    setIsScanning(true);
    try {
      if (typeof Tesseract === 'undefined') {
        alert("OCR Library not loaded yet. Please wait.");
        return;
      }
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      const lines = text.split('\n');
      let detectedName = lines[0] ? lines[0].replace(/[^a-zA-Z0-9 ]/g, '') : '';
      
      // Basic Expiry Detection Regex
      const dateRegex = /(\d{2}[/-]\d{2}[/-]\d{4})|(\d{4}[/-]\d{2}[/-]\d{2})/;
      const dateMatch = text.match(dateRegex);
      const detectedExpiry = dateMatch ? dateMatch[0] : ''; // Simplistic, might need formatting to YYYY-MM-DD for input

      setFormData(prev => ({
        ...prev,
        name: detectedName || prev.name,
        // Only set expiry if it matches YYYY-MM-DD or close, otherwise keep manual
        // expiryDate: detectedExpiry || prev.expiryDate 
      }));
      if(detectedName) alert("OCR Scanned Name: " + detectedName);
    } catch (err) {
      console.error(err);
      alert('Failed to scan image text.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddCategory = () => {
      if(newCategoryName.trim()) {
          addCategory(newCategoryName.trim());
          setFormData(prev => ({...prev, category: newCategoryName.trim()}));
          setNewCategoryName('');
          setIsAddingCategory(false);
      }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
        <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-teal-800 text-white px-4 py-2 rounded-lg hover:bg-teal-900 transition-colors shadow-sm w-full md:w-auto justify-center">
          <Plus size={18} />
          <span>Add Medicine</span>
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
        <input type="text" placeholder="Search Name or Category..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm bg-white text-gray-900 placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Product</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Stock</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Price</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.map(product => {
              const isLowStock = product.stock < 10;
              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center space-x-3">
                          {product.image ? (
                              <img src={product.image} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                          ) : (
                              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs"><ImageIcon size={14}/></div>
                          )}
                          <div>
                              <div className="font-bold">{product.name}</div>
                              <div className="text-xs text-gray-500 md:hidden">{product.category}</div>
                          </div>
                      </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{product.category}</span></td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600 text-sm">{product.location || '-'}</td>
                  <td className={`px-6 py-4 ${isLowStock ? 'text-red-600 font-bold' : 'text-gray-600'}`}>{product.stock}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600">₹{product.sellPrice}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center space-x-3">
                        <button onClick={() => handleOpenModal(product)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete"><Trash2 size={16} /></button>
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
               {/* Smart Camera & Image Section */}
              <div className="bg-teal-50 p-4 rounded-lg mb-4 border border-teal-100">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                     <div className="flex items-center space-x-2 text-teal-800">
                        <Camera size={20} /> <span className="font-medium">Smart Add (Photo/Scan)</span>
                     </div>
                     <div className="flex space-x-2">
                        {/* Hidden Inputs */}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => handleImageUpload(e)} />
                        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={e => handleImageUpload(e, true)} />
                        
                        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isScanning} className="bg-teal-600 text-white px-3 py-2 rounded-md text-sm hover:bg-teal-700 transition flex items-center gap-2">
                          <Camera size={16}/> Take Photo
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className="bg-white border border-teal-300 text-teal-700 px-3 py-2 rounded-md text-sm hover:bg-teal-100 transition">
                          {isScanning ? 'Scanning...' : 'Upload File'}
                        </button>
                     </div>
                 </div>
                 {/* Image Preview */}
                 {formData.image && (
                     <div className="mt-4 flex justify-center">
                         <img src={formData.image} alt="Preview" className="h-32 rounded-lg border border-gray-300 shadow-sm" />
                     </div>
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                {/* Dynamic Category Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  {!isAddingCategory ? (
                      <div className="flex gap-2">
                        <select className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsAddingCategory(true)} className="p-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-gray-200" title="New Category">
                            <Plus size={20} className="text-gray-600"/>
                        </button>
                      </div>
                  ) : (
                      <div className="flex gap-2">
                          <input autoFocus type="text" placeholder="New Category Name" className="w-full p-2 border border-blue-300 rounded-lg focus:ring-blue-500 bg-white text-gray-900" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                          <button type="button" onClick={handleAddCategory} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Check size={20}/></button>
                          <button type="button" onClick={() => setIsAddingCategory(false)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"><X size={20}/></button>
                      </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                  <input required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-teal-500 bg-white text-gray-900" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
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