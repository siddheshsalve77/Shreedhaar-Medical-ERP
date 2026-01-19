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
  
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');

  // Billing Config
  const [includeGST, setIncludeGST] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // --- Smart Suggestions Logic (AI) ---
  const suggestions = useMemo(() => {
    if (cart.length === 0) return [];
    
    const cartIds = new Set(cart.map(c => c.id));
    const potentialMatches = new Map<string, number>();

    // Analyze history to find what was bought with current cart items
    sales.forEach(sale => {
      const hasCartItem = sale.items.some(item => cartIds.has(item.id));
      if (hasCartItem) {
        sale.items.forEach(item => {
          if (!cartIds.has(item.id)) {
             potentialMatches.set(item.id, (potentialMatches.get(item.id) || 0) + 1);
          }
        });
      }
    });

    // Sort by frequency and take top 2
    const sortedIds = [...potentialMatches.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(entry => entry[0]);
      
    // Filter out items already in cart or out of stock
    return products.filter(p => sortedIds.includes(p.id) && p.stock > 0 && !cartIds.has(p.id));
  }, [cart, sales, products]);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert('Out of stock!');
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
           alert("Not enough stock available");
           return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

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

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const gst = includeGST ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gst;

  const searchResults = products.filter(p => 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    searchTerm.length > 0
  );

  const handleGenerateBill = () => {
    if (cart.length === 0) return;
    // Mobile is now optional, so no check here.

    const savedSale = processSale(cart, customerMobile, customerName, customerEmail, includeGST);
    setLastSale(savedSale);
    setShowSuccessModal(true);
    
    // Reset Form
    setCart([]);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerMobile('');
    setSearchTerm('');
    setIncludeGST(false);
  };

  // --- Export Logic ---
  const generatePDF = () => {
    if (!lastSale) return;
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(0, 128, 128); doc.text("Shreedhar Medical", 14, 20);
    doc.setFontSize(10); doc.setTextColor(0, 0, 0);
    doc.text(`Invoice ID: ${lastSale.id}`, 14, 30);
    doc.text(`Date: ${new Date(lastSale.timestamp).toLocaleString()}`, 14, 35);
    doc.text(`Customer: ${lastSale.customerName || 'Guest'}`, 14, 45);
    if(lastSale.customerMobile) doc.text(`Mobile: ${lastSale.customerMobile}`, 14, 50);
    
    autoTable(doc, {
      startY: lastSale.customerMobile ? 60 : 55,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: lastSale.items.map(item => [item.name, item.quantity, item.sellPrice.toFixed(2), (item.quantity * item.sellPrice).toFixed(2)]),
      theme: 'grid',
      headStyles: { fillColor: [0, 128, 128] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Subtotal: ${lastSale.subTotal.toFixed(2)}`, 140, finalY);
    if (lastSale.gstAmount > 0) doc.text(`GST (18%): ${lastSale.gstAmount.toFixed(2)}`, 140, finalY + 5);
    doc.setFont("helvetica", "bold"); doc.text(`Grand Total: ${lastSale.totalAmount.toFixed(2)}`, 140, finalY + (lastSale.gstAmount > 0 ? 12 : 8));
    doc.save(`Invoice_${lastSale.id}.pdf`);
  };

  const generateExcel = () => {
     if(!lastSale) return;
     const ws = XLSX.utils.json_to_sheet(lastSale.items.map(c => ({
         Name: c.name, Quantity: c.quantity, Price: c.sellPrice, Total: c.quantity * c.sellPrice
     })));
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Invoice Items");
     XLSX.writeFile(wb, `Invoice_${lastSale.id}.xlsx`);
  };

  return (
    <div className="p-6 h-full flex flex-col md:flex-row gap-6 overflow-hidden relative">
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700 mb-2">Product Search</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input type="text" placeholder="Search medicine or category..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        {/* Search Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchTerm.length === 0 && <div className="text-center text-gray-400 mt-10">Start typing to search products...</div>}
          {searchResults.map(product => (
            <div key={product.id} className="flex items-center justify-between p-3 mb-2 bg-gray-50 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer group" onClick={() => addToCart(product)}>
              <div>
                <h4 className="font-medium text-gray-800">{product.name}</h4>
                <p className="text-xs text-gray-500">{product.category} | Stock: <span className={product.stock < 10 ? 'text-red-500 font-bold' : ''}>{product.stock}</span></p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-bold text-teal-700">₹{product.sellPrice}</span>
                <button className="text-teal-600 opacity-0 group-hover:opacity-100"><PlusCircle size={20} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* AI Suggestions Panel */}
        {suggestions.length > 0 && (
            <div className="p-4 bg-teal-50 border-t border-teal-100">
                <div className="flex items-center gap-2 mb-2 text-teal-800">
                    <Sparkles size={16} />
                    <h3 className="text-sm font-bold">Frequently Bought Together</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {suggestions.map(s => (
                        <div key={s.id} onClick={() => addToCart(s)} className="flex-shrink-0 bg-white p-2 rounded border border-teal-200 cursor-pointer hover:shadow-md transition w-32">
                            <p className="text-xs font-semibold truncate">{s.name}</p>
                            <p className="text-xs text-gray-500">₹{s.sellPrice}</p>
                            <p className="text-[10px] text-teal-600 font-bold mt-1">+ Add to Bill</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="w-full md:w-[450px] flex flex-col bg-white rounded-xl shadow-lg border border-teal-100 overflow-hidden">
        <div className="p-4 bg-teal-800 text-white"><h2 className="font-bold text-lg flex items-center gap-2">New Bill</h2></div>
        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-2">
            <input type="text" placeholder="Customer Name (Optional)" className="w-full p-2 text-sm border rounded bg-white text-gray-900" value={customerName} onChange={e=>setCustomerName(e.target.value)}/>
            <div className="flex gap-2">
                <input type="tel" placeholder="Mobile (Optional)" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerMobile} onChange={e=>setCustomerMobile(e.target.value)}/>
                <input type="email" placeholder="Email (Optional)" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 && <div className="text-center text-gray-400 mt-10">Cart is empty</div>}
          {cart.map(item => (
            <div key={item.id} className="flex flex-col border-b border-gray-100 pb-2">
              <div className="flex justify-between items-start mb-1">
                 <p className="text-sm font-medium text-gray-800 w-1/2">{item.name}</p>
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Price:</span>
                    <input type="number" step="0.01" className="w-16 p-1 text-right text-sm border rounded bg-white text-gray-900" value={item.sellPrice} onChange={(e) => updateSellPrice(item.id, e.target.value)} />
                 </div>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-xs text-gray-500">Sub: ₹{(item.sellPrice * item.quantity).toFixed(2)}</p>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">-</button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">+</button>
                    <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
           <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700">Tax Settings</span>
              <div 
                className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${includeGST ? 'bg-teal-600' : 'bg-gray-300'}`}
                onClick={() => setIncludeGST(!includeGST)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeGST ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
           </div>
           {includeGST && <div className="text-right text-xs text-teal-600 mb-2 font-bold">GST (18%) Enabled</div>}
           
           <div className="space-y-1 mb-4">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              {includeGST && <div className="flex justify-between text-sm text-gray-600"><span>GST (18%)</span><span>₹{gst.toFixed(2)}</span></div>}
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200"><span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
           </div>
           
           <button onClick={handleGenerateBill} disabled={cart.length === 0} className="w-full flex items-center justify-center space-x-2 px-4 py-4 bg-teal-800 text-white rounded-lg hover:bg-teal-900 shadow-md disabled:opacity-50 font-bold text-lg">
             <CheckCircle size={22} /> <span>Generate Bill</span>
           </button>
        </div>
      </div>

      {showSuccessModal && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600 w-8 h-8" /></div>
                <h3 className="text-2xl font-bold text-gray-800">Bill Saved!</h3>
                <p className="text-sm font-semibold mt-2">ID: {lastSale.id}</p>
             </div>
             <div className="space-y-3">
                <button onClick={generatePDF} className="w-full flex items-center justify-center space-x-2 p-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"><Printer size={18} /> <span>Download PDF</span></button>
                <button onClick={generateExcel} className="w-full flex items-center justify-center space-x-2 p-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"><FileSpreadsheet size={18} /> <span>Download Excel</span></button>
             </div>
             <button onClick={() => setShowSuccessModal(false)} className="mt-6 w-full p-2 text-gray-400 hover:text-gray-600 text-sm">Close & Start New Bill</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
