import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { Plus, Camera, Search, Check, Trash2, Edit2, Image as ImageIcon, X, Info } from 'lucide-react';
declare const Tesseract: any;

const Inventory: React.FC = () => {
  const { products, categories, addProduct, updateProduct, deleteProduct, addCategory } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const initialFormState: Product = {
    id: '', name: '', category: 'Tablet/Medicine', batch: '', expiryDate: '',
    buyPrice: 0, sellPrice: 0, stock: 0, location: '', image: '', vendor: ''
  };
  const [formData, setFormData] = useState<Product>(initialFormState);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = (product?: Product) => {
    if (product) setFormData(product);
    else setFormData({ ...initialFormState, id: Date.now().toString() });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const exists = products.find(p => p.id === formData.id);
    if (exists) await updateProduct(formData);
    else await addProduct(formData);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if(window.confirm("Are you sure you want to remove this item from inventory?")) deleteProduct(id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
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
      setFormData(prev => ({ ...prev, name: detectedName || prev.name }));
      if(detectedName) alert("OCR Scanned Name: " + detectedName);
    } catch (err) {
      console.error(err);
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

  const inputClasses = "w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-gray-900 placeholder-gray-400 shadow-sm";
  const labelClasses = "block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1";
  const helperClasses = "text-[11px] text-gray-400 mt-0.5 leading-tight";

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
        <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-teal-800 text-white px-5 py-2.5 rounded-lg hover:bg-teal-900 transition-all shadow-md active:scale-95 w-full md:w-auto justify-center font-bold">
          <Plus size={20} />
          <span>Add New Medicine</span>
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
        <input type="text" placeholder="Search by name, category, or vendor..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm bg-white text-gray-900 placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Medicine / Product</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vendor</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rack Location</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price (₹)</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.map(product => {
              const isLowStock = product.stock < 10;
              return (
                <tr key={product.id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center space-x-3">
                          {product.image ? (
                              <img src={product.image} alt="" className="w-9 h-9 rounded-md object-cover border border-gray-200" />
                          ) : (
                              <div className="w-9 h-9 rounded-md bg-teal-100 flex items-center justify-center text-teal-700 text-xs"><ImageIcon size={18}/></div>
                          )}
                          <div>
                              <div className="font-bold text-gray-800">{product.name}</div>
                              <div className="text-[10px] text-gray-500 md:hidden">Cat: {product.category}</div>
                          </div>
                      </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600"><span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium border border-gray-200">{product.category}</span></td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600 text-sm truncate max-w-[150px]">{product.vendor || '-'}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-600 text-sm">{product.location || '-'}</td>
                  <td className={`px-6 py-4 ${isLowStock ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-700'}`}>{product.stock}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-gray-900 font-semibold">₹{product.sellPrice}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center space-x-4">
                        <button onClick={() => handleOpenModal(product)} className="text-blue-600 hover:text-blue-800 transition-colors" title="Edit Item"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete Item"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No products found in inventory.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-100 flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-teal-50 rounded-t-2xl">
              <div>
                  <h2 className="text-xl font-extrabold text-teal-900">{products.find(p=>p.id===formData.id) ? 'Update Medicine Data' : 'Register New Medicine'}</h2>
                  <p className="text-xs text-teal-600 mt-0.5">Fill in all medicine details to update the cloud inventory.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors text-3xl font-light">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Image & OCR Section */}
              <div className="bg-white p-4 rounded-xl border-2 border-dashed border-teal-100 flex flex-col items-center">
                 <div className="flex items-center gap-2 mb-4">
                    {formData.image ? (
                        <div className="relative group">
                            <img src={formData.image} alt="Preview" className="h-24 w-24 object-cover rounded-lg border-2 border-teal-500 shadow-md" />
                            <button type="button" onClick={() => setFormData({...formData, image: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                        </div>
                    ) : (
                        <div className="h-24 w-24 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-gray-100 text-gray-300"><ImageIcon size={32}/></div>
                    )}
                    <div className="flex flex-col gap-2">
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => handleImageUpload(e)} />
                        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={e => handleImageUpload(e, true)} />
                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 shadow-sm active:scale-95 transition-all"><Camera size={16}/> Scan Medicine</button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-teal-700 underline font-medium hover:text-teal-900">Choose from gallery</button>
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-400">Tip: Take a photo of the medicine strip to automatically detect the name.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                {/* Medicine Name */}
                <div className="md:col-span-2">
                  <label className={labelClasses}>Medicine / Product Name</label>
                  <input required className={inputClasses} placeholder="e.g., Crocin 650mg, Pan D, Face Mask" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  <p className={helperClasses}>Full commercial name as printed on the box.</p>
                </div>
                
                {/* Category Selection */}
                <div>
                  <label className={labelClasses}>Product Category</label>
                  {!isAddingCategory ? (
                      <div className="flex gap-2">
                        <select className={inputClasses} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsAddingCategory(true)} className="p-2 bg-teal-50 text-teal-700 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors" title="Create New Category">
                            <Plus size={22}/>
                        </button>
                      </div>
                  ) : (
                      <div className="flex gap-2">
                          <input autoFocus type="text" placeholder="Enter new category" className={inputClasses} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                          <button type="button" onClick={handleAddCategory} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm"><Check size={20}/></button>
                          <button type="button" onClick={() => setIsAddingCategory(false)} className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200"><X size={20}/></button>
                      </div>
                  )}
                  <p className={helperClasses}>Groups products for easier billing and analytics.</p>
                </div>

                {/* Batch Number */}
                <div>
                  <label className={labelClasses}>Batch Number</label>
                  <input required className={inputClasses} placeholder="e.g., B-102, LOT-99" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} />
                  <p className={helperClasses}>Internal ID used to track specific manufacturing runs.</p>
                </div>

                {/* Expiry Date */}
                <div>
                  <label className={labelClasses}>Expiry Date</label>
                  <input required type="date" className={inputClasses} value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
                  <p className={helperClasses}>System will alert when this date is near.</p>
                </div>

                {/* Rack Location */}
                <div>
                  <label className={labelClasses}>Rack / Shelf Location</label>
                  <input required className={inputClasses} placeholder="e.g., Shelf A-1, Drawer 4" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                  <p className={helperClasses}>Physical location of medicine in the store.</p>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className={labelClasses}>Stock Quantity</label>
                  <input required type="number" min="0" className={inputClasses} placeholder="Current Units in Hand" value={formData.stock || ''} onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})} />
                  <p className={helperClasses}>Total number of units available for sale.</p>
                </div>

                {/* Vendor */}
                <div>
                  <label className={labelClasses}>Vendor / Supplier Name</label>
                  <input className={inputClasses} placeholder="e.g., Cipla Ltd, Apex Distributors" value={formData.vendor || ''} onChange={e => setFormData({...formData, vendor: e.target.value})} />
                  <p className={helperClasses}>Entity from whom you purchased this medicine.</p>
                </div>

                {/* Buy Price */}
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <label className={labelClasses}>Buy Price (Cost)</label>
                  <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 font-bold">₹</span>
                      <input required type="number" min="0" step="0.01" className={`${inputClasses} pl-7`} placeholder="e.g., 45.00" value={formData.buyPrice || ''} onChange={e => setFormData({...formData, buyPrice: parseFloat(e.target.value) || 0})} />
                  </div>
                  <p className={helperClasses}>Price you paid to the Vendor (used for profit calculation).</p>
                </div>

                {/* Sell Price */}
                <div className="bg-teal-50 p-2 rounded-lg border border-teal-100">
                  <label className={labelClasses}>Sell Price (MRP)</label>
                  <div className="relative">
                      <span className="absolute left-3 top-2 text-teal-600 font-bold">₹</span>
                      <input required type="number" min="0" step="0.01" className={`${inputClasses} pl-7 border-teal-200`} placeholder="e.g., 60.00" value={formData.sellPrice || ''} onChange={e => setFormData({...formData, sellPrice: parseFloat(e.target.value) || 0})} />
                  </div>
                  <p className={helperClasses}>Price to be charged to the Customer.</p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-4 pt-5 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-500 hover:text-gray-700 font-bold hover:bg-gray-50 rounded-lg transition-colors">Discard Changes</button>
                <button type="submit" className="px-8 py-2.5 bg-teal-800 text-white rounded-lg hover:bg-teal-900 shadow-lg active:scale-95 transition-all flex items-center gap-2 font-bold">
                  <Check size={20} /> Confirm Save
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