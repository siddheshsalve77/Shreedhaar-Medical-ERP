import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CartItem, Product, Sale } from '../types';
import { Search, Trash2, Printer, FileSpreadsheet, PlusCircle, CheckCircle, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const POS: React.FC = () => {
  const { products, sales, processSale } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [includeGST, setIncludeGST] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const suggestions = useMemo(() => {
    if (cart.length === 0) return [];
    const cartIds = new Set(cart.map(c => c.id));
    const potentialMatches = new Map<string, number>();
    sales.forEach(sale => {
      if (sale.items.some(item => cartIds.has(item.id))) {
        sale.items.forEach(item => { if (!cartIds.has(item.id)) potentialMatches.set(item.id, (potentialMatches.get(item.id) || 0) + 1); });
      }
    });
    const sortedIds = [...potentialMatches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(entry => entry[0]);
    return products.filter(p => sortedIds.includes(p.id) && p.stock > 0 && !cartIds.has(p.id));
  }, [cart, sales, products]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert('Out of stock!');
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) { alert("Not enough stock"); return prev; }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm(''); // Clear search on add for better mobile UX
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const updateQuantity = (id: string, newQty: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    if (newQty > product.stock) return alert("Cannot exceed available stock");
    if (newQty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const updateSellPrice = (id: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, sellPrice: price } : item));
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const gst = includeGST ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gst;

  const searchResults = products.filter(p => 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())) && searchTerm.length > 0
  );

  const handleGenerateBill = () => {
    if (cart.length === 0) return;
    const savedSale = processSale(cart, customerMobile, customerName, customerEmail, includeGST);
    setLastSale(savedSale); setShowSuccessModal(true);
    setCart([]); setCustomerName(''); setCustomerEmail(''); setCustomerMobile(''); setSearchTerm(''); setIncludeGST(false);
  };

  const generatePDF = () => {
    if (!lastSale) return;
    const doc = new jsPDF();
    doc.text(`Invoice ID: ${lastSale.id}`, 14, 30);
    autoTable(doc, {
      startY: 60, head: [['Item', 'Qty', 'Price', 'Total']],
      body: lastSale.items.map(item => [item.name, item.quantity, item.sellPrice.toFixed(2), (item.quantity * item.sellPrice).toFixed(2)]),
    });
    doc.save(`Invoice_${lastSale.id}.pdf`);
  };

  const generateExcel = () => {
     if(!lastSale) return;
     const ws = XLSX.utils.json_to_sheet(lastSale.items.map(c => ({ Name: c.name, Quantity: c.quantity, Price: c.sellPrice, Total: c.quantity * c.sellPrice })));
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Invoice Items");
     XLSX.writeFile(wb, `Invoice_${lastSale.id}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col md:flex-row gap-6 overflow-hidden relative">
      {/* LEFT: Product Selection */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible relative">
        <div className="p-4 border-b border-gray-100 bg-gray-50 z-20 sticky top-0">
          <h2 className="font-semibold text-gray-700 mb-2">Product Search</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input type="text" placeholder="Search medicine..." className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 text-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        {/* Search Results - Optimized for Mobile Overlay */}
        {searchTerm.length > 0 && (
            <div className="absolute top-[88px] left-0 right-0 bottom-0 bg-white z-50 overflow-y-auto border-t border-gray-100 shadow-2xl p-2 md:relative md:top-0 md:shadow-none">
                {searchResults.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 mb-2 bg-gray-50 rounded-lg hover:bg-teal-50 active:bg-teal-100 transition-colors cursor-pointer border border-gray-200 shadow-sm" onClick={() => addToCart(product)}>
                    <div>
                        <h4 className="font-bold text-gray-800 text-lg">{product.name}</h4>
                        <p className="text-sm text-gray-500">{product.category} | Stock: <span className={product.stock < 10 ? 'text-red-500 font-bold' : ''}>{product.stock}</span></p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="font-bold text-teal-700 text-lg">₹{product.sellPrice}</span>
                        <PlusCircle size={28} className="text-teal-600" />
                    </div>
                    </div>
                ))}
                {searchResults.length === 0 && <div className="p-4 text-center text-gray-500">No medicines found.</div>}
            </div>
        )}

        <div className="hidden md:block flex-1 overflow-y-auto p-4 bg-gray-50/50">
             <div className="text-center text-gray-400 mt-10">Use search to add items to bill</div>
        </div>

        {suggestions.length > 0 && (
            <div className="p-4 bg-teal-50 border-t border-teal-100 hidden md:block">
                <div className="flex items-center gap-2 mb-2 text-teal-800"><Sparkles size={16} /><h3 className="text-sm font-bold">Quick Add</h3></div>
                <div className="flex gap-2 overflow-x-auto">
                    {suggestions.map(s => (
                        <div key={s.id} onClick={() => addToCart(s)} className="flex-shrink-0 bg-white p-2 rounded border border-teal-200 cursor-pointer hover:shadow-md transition w-32">
                            <p className="text-xs font-semibold truncate">{s.name}</p>
                            <p className="text-xs text-gray-500">₹{s.sellPrice}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* RIGHT: Billing Cart */}
      <div className="w-full md:w-[450px] flex flex-col bg-white rounded-xl shadow-lg border border-teal-100 overflow-hidden h-[60vh] md:h-auto">
        <div className="p-4 bg-teal-800 text-white"><h2 className="font-bold text-lg flex items-center gap-2">Current Bill</h2></div>
        <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2">
            <input type="text" placeholder="Customer Name" className="w-full p-2 text-sm border rounded bg-white text-gray-900" value={customerName} onChange={e=>setCustomerName(e.target.value)}/>
            <div className="flex gap-2">
                <input type="tel" placeholder="Mobile" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerMobile} onChange={e=>setCustomerMobile(e.target.value)}/>
                <input type="email" placeholder="Email" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 && <div className="text-center text-gray-400 mt-10">Cart is empty</div>}
          {cart.map(item => (
            <div key={item.id} className="flex flex-col border-b border-gray-100 pb-2">
              <div className="flex justify-between items-start mb-1">
                 <p className="text-sm font-medium text-gray-800 w-1/2 break-words">{item.name}</p>
                 <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500">₹</span>
                    <input type="number" step="0.01" className="w-16 p-1 text-right text-sm border rounded bg-white text-gray-900" value={item.sellPrice} onChange={(e) => updateSellPrice(item.id, e.target.value)} />
                 </div>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-xs text-gray-500 font-mono">₹{(item.sellPrice * item.quantity).toFixed(2)}</p>
                 <div className="flex items-center space-x-2 bg-gray-100 rounded p-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-white text-gray-800 shadow-sm">-</button>
                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-white text-gray-800 shadow-sm">+</button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
           <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Tax (GST 18%)</span>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${includeGST ? 'bg-teal-600' : 'bg-gray-300'}`} onClick={() => setIncludeGST(!includeGST)}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeGST ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
           </div>
           
           <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200"><span>Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
           </div>
           
           <button onClick={handleGenerateBill} disabled={cart.length === 0} className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-teal-800 text-white rounded-lg hover:bg-teal-900 shadow-md disabled:opacity-50 font-bold text-lg">
             <CheckCircle size={22} /> <span>Complete Sale</span>
           </button>
        </div>
      </div>

      {showSuccessModal && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600 w-8 h-8" /></div>
                <h3 className="text-2xl font-bold text-gray-800">Bill Saved!</h3>
             </div>
             <div className="space-y-3">
                <button onClick={generatePDF} className="w-full flex items-center justify-center space-x-2 p-3 bg-teal-600 text-white rounded-lg"><Printer size={18} /> <span>Download PDF</span></button>
                <button onClick={generateExcel} className="w-full flex items-center justify-center space-x-2 p-3 border border-gray-300 text-gray-700 rounded-lg"><FileSpreadsheet size={18} /> <span>Download Excel</span></button>
             </div>
             <button onClick={() => setShowSuccessModal(false)} className="mt-6 w-full p-2 text-gray-400 text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
