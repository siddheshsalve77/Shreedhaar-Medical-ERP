import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CartItem, Product, Sale } from '../types';
import { Search, Trash2, Printer, FileSpreadsheet, PlusCircle, CheckCircle, Sparkles, Tag, Percent, Hash, AlertCircle } from 'lucide-react';
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
  const [discountPercent, setDiscountPercent] = useState<string>(''); // Global Discount
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // --- Search & Suggestion Logic ---
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
      return [...prev, { ...product, quantity: 1, itemDiscountType: 'PERCENT', itemDiscountValue: 0 }];
    });
    setSearchTerm(''); 
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

  const toggleItemDiscountType = (id: string) => {
      setCart(prev => prev.map(item => 
        item.id === id 
        ? { ...item, itemDiscountType: item.itemDiscountType === 'PERCENT' ? 'FLAT' : 'PERCENT' }
        : item
      ));
  };

  const updateItemDiscountValue = (id: string, val: string) => {
      const num = parseFloat(val);
      if(isNaN(num) || num < 0) return;
      setCart(prev => prev.map(item => item.id === id ? { ...item, itemDiscountValue: num } : item));
  };

  // --- Helper Calculations ---
  const calculateItemNetPrice = (item: CartItem) => {
      let finalPrice = item.sellPrice;
      if (item.itemDiscountValue > 0) {
          if (item.itemDiscountType === 'PERCENT') {
              finalPrice = item.sellPrice - (item.sellPrice * item.itemDiscountValue / 100);
          } else {
              finalPrice = item.sellPrice - item.itemDiscountValue;
          }
      }
      return Math.max(0, finalPrice);
  };

  const calculateItemTotal = (item: CartItem) => {
      return calculateItemNetPrice(item) * item.quantity;
  };

  // --- Global Totals Logic ---
  const totalMRP = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const netSubtotal = cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  
  const gstAmount = includeGST ? netSubtotal * 0.18 : 0;
  const grossTotal = netSubtotal + gstAmount;
  
  const globalDiscountRate = parseFloat(discountPercent) || 0;
  const globalDiscountAmount = (grossTotal * globalDiscountRate) / 100;
  const grandTotal = grossTotal - globalDiscountAmount;

  const totalPotentialValue = totalMRP + gstAmount;
  const totalSavings = totalPotentialValue - grandTotal;

  const searchResults = products.filter(p => 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())) && searchTerm.length > 0
  );

  const handleGenerateBill = async () => {
    if (cart.length === 0) return;
    // processSale is now Async/Await because of Firebase
    const savedSale = await processSale(cart, customerMobile, customerName, customerEmail, includeGST, globalDiscountRate);
    if(savedSale) {
        setLastSale(savedSale); setShowSuccessModal(true);
        setCart([]); setCustomerName(''); setCustomerEmail(''); setCustomerMobile(''); setSearchTerm(''); setIncludeGST(false); setDiscountPercent('');
    }
  };

  // --- Professional PDF Generation ---
  const generatePDF = () => {
    if (!lastSale) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // 1. Header Section
    doc.setFillColor(22, 75, 96); // Navy 700
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Shreedhar Medical", 14, 18);
    
    // UPDATED ADDRESS BLOCK - MHADA COLONY
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Mhada Colony, Shrirampur", 14, 25);
    doc.text("Maharashtra - 413709 | Phone: 9822062809 / 9270262809", 14, 30);
    
    doc.setFontSize(14);
    doc.text("INVOICE", pageWidth - 14, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`#${lastSale.id.slice(-6).toUpperCase()}`, pageWidth - 14, 25, { align: 'right' });
    doc.text(new Date(lastSale.timestamp).toLocaleString(), pageWidth - 14, 30, { align: 'right' });

    // 2. Customer Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text("Bill To:", 14, 50);
    doc.setFontSize(10);
    doc.text(`Customer Name: ${lastSale.customerName || 'Walk-in Customer'}`, 14, 56);
    doc.text(`Mobile No: ${lastSale.customerMobile || 'N/A'}`, 14, 61);

    // 3. Product Table
    autoTable(doc, {
      startY: 68,
      head: [['Item Name', 'Batch', 'Exp', 'Qty', 'MRP', 'Disc', 'Net Amt']],
      body: lastSale.items.map(item => {
        let discDisplay = '-';
        if(item.itemDiscountValue > 0) {
             discDisplay = item.itemDiscountType === 'PERCENT' ? `${item.itemDiscountValue}%` : `${item.itemDiscountValue}`;
        }
        
        let effectivePrice = item.sellPrice;
        if(item.itemDiscountValue > 0) {
            if(item.itemDiscountType === 'PERCENT') effectivePrice = item.sellPrice * (1 - item.itemDiscountValue/100);
            else effectivePrice = item.sellPrice - item.itemDiscountValue;
        }

        return [
          item.name,
          item.batch,
          item.expiryDate,
          item.quantity,
          item.sellPrice.toFixed(2),
          discDisplay,
          (effectivePrice * item.quantity).toFixed(2)
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [22, 75, 96], textColor: 255 }, 
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 }, 
        4: { halign: 'right' }, 
        5: { halign: 'center' }, 
        6: { halign: 'right', fontStyle: 'bold' } 
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;

    // 4. Totals Section & Footer
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Terms & Conditions:", 14, finalY + 10);
    doc.text("1. Goods once sold will not be taken back.", 14, finalY + 15);
    doc.text("2. Please consult doctor before consuming.", 14, finalY + 20);
    
    let currentY = finalY + 5;
    const rightX = pageWidth - 60;
    const rightValueX = pageWidth - 14;

    const addRow = (label: string, value: string, isBold = false) => {
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(isBold ? 11 : 10);
        doc.setTextColor(0,0,0);
        doc.text(label, rightX, currentY);
        doc.text(value, rightValueX, currentY, { align: 'right' });
        currentY += 6;
    };

    const pdfTotalMRP = lastSale.items.reduce((sum, i) => sum + (i.sellPrice * i.quantity), 0);
    
    doc.setTextColor(150);
    doc.setFontSize(10);
    doc.text("Total MRP:", rightX, currentY);
    doc.text(`${pdfTotalMRP.toFixed(2)}`, rightValueX, currentY, { align: 'right' });
    const textWidth = doc.getTextWidth(`${pdfTotalMRP.toFixed(2)}`);
    doc.line(rightValueX - textWidth, currentY - 1, rightValueX, currentY - 1);
    currentY += 6;

    if (lastSale.gstAmount > 0) addRow("GST (18%):", `+ ${lastSale.gstAmount.toFixed(2)}`);
    if (lastSale.discountAmount > 0) {
        doc.setTextColor(200, 0, 0);
        addRow("Discount:", `- ${lastSale.discountAmount.toFixed(2)}`);
    }

    doc.setFillColor(240, 240, 240);
    doc.rect(rightX - 2, currentY - 4, 60, 10, 'F');
    doc.setTextColor(0, 50, 0);
    addRow("Net Payable:", `${lastSale.totalAmount.toFixed(2)}`, true);

    doc.setFontSize(9);
    doc.setTextColor(0,0,0);
    doc.text("Authorized Signatory", pageWidth - 14, finalY + 40, { align: 'right' });
    doc.text("Shreedhar Medical", pageWidth - 14, finalY + 45, { align: 'right' });

    doc.save(`Invoice_${lastSale.id}.pdf`);
  };

  const generateExcel = () => {
     if(!lastSale) return;
     const itemsData = lastSale.items.map(item => ({ 
         Item: item.name, Batch: item.batch, Expiry: item.expiryDate, Qty: item.quantity, 
         MRP: item.sellPrice, NetAmount: (item.sellPrice * item.quantity).toFixed(2) 
     }));
     const ws = XLSX.utils.json_to_sheet(itemsData);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Invoice");
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
            <input type="text" placeholder="Search medicine..." className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 text-lg shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        {/* Search Results - FIX: Added fixed positioning for mobile overlay */}
        {searchTerm.length > 0 && (
            <div className="absolute top-[88px] left-0 w-full md:w-auto md:left-0 md:right-0 bg-white z-[50] overflow-y-auto border-t border-gray-100 shadow-2xl p-2 md:max-h-[60vh] max-h-[50vh] inset-x-0">
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
      <div className="w-full md:w-[450px] flex flex-col bg-white rounded-xl shadow-lg border border-teal-100 overflow-hidden h-[75vh] md:h-auto">
        <div className="p-4 bg-navy-800 text-white"><h2 className="font-bold text-lg flex items-center gap-2">Current Bill</h2></div>
        <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2">
            <input type="text" placeholder="Customer Name" className="w-full p-2 text-sm border rounded bg-white text-gray-900" value={customerName} onChange={e=>setCustomerName(e.target.value)}/>
            <div className="flex gap-2">
                <input type="tel" placeholder="Mobile" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerMobile} onChange={e=>setCustomerMobile(e.target.value)}/>
                <input type="email" placeholder="Email" className="w-1/2 p-2 text-sm border rounded bg-white text-gray-900" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 && <div className="text-center text-gray-400 mt-10">Cart is empty</div>}
          {cart.map(item => {
              const netPrice = calculateItemNetPrice(item);
              const hasDiscount = item.itemDiscountValue > 0;
              return (
                <div key={item.id} className="flex flex-col border-b border-gray-100 pb-2">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium text-gray-800 w-1/2 break-words">{item.name}</p>
                    <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">MRP ₹</span>
                        <input type="number" step="0.01" className="w-16 p-1 text-right text-sm border rounded bg-white text-gray-900" value={item.sellPrice} onChange={(e) => updateSellPrice(item.id, e.target.value)} />
                    </div>
                </div>
                
                {/* Dual Mode Discount Per Item */}
                <div className="flex items-center justify-between mb-2 bg-gray-50 p-1 rounded">
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => toggleItemDiscountType(item.id)}
                            className={`p-1 rounded border ${item.itemDiscountType === 'PERCENT' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-green-100 text-green-600 border-green-200'}`}
                            title="Toggle Discount Mode"
                        >
                            {item.itemDiscountType === 'PERCENT' ? <Percent size={14}/> : <Hash size={14}/>}
                        </button>
                        <input 
                            type="number" 
                            className="w-16 p-1 text-xs border rounded bg-white text-gray-900"
                            placeholder="Disc"
                            value={item.itemDiscountValue === 0 ? '' : item.itemDiscountValue}
                            onChange={(e) => updateItemDiscountValue(item.id, e.target.value)}
                        />
                    </div>
                    {hasDiscount && (
                        <span className="text-xs text-red-500 font-medium">
                            {item.itemDiscountType === 'PERCENT' ? `-${item.itemDiscountValue}%` : `-₹${item.itemDiscountValue}`} off
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        {hasDiscount ? (
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 line-through">₹{item.sellPrice.toFixed(2)}</span>
                                <span className="text-sm font-bold text-teal-800 font-mono">₹{netPrice.toFixed(2)}</span>
                             </div>
                        ) : (
                             <span className="text-sm font-bold text-teal-800 font-mono">₹{netPrice.toFixed(2)}</span>
                        )}
                        <span className="text-[10px] text-gray-500">Unit Price</span>
                    </div>

                    <div className="flex items-center space-x-2 bg-gray-100 rounded p-1">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-white text-gray-800 shadow-sm">-</button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-white text-gray-800 shadow-sm">+</button>
                    </div>
                    
                    <div className="flex flex-col items-end w-16">
                        <span className="font-bold text-gray-900">₹{calculateItemTotal(item).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 mt-1"><Trash2 size={16} /></button>
                    </div>
                </div>
                </div>
            )})}
        </div>

        {/* --- BOTTOM SUMMARY SECTION --- */}
        <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
           {/* Tax & Global Discount Controls */}
           <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
               <div className="flex items-center space-x-2">
                   <input type="checkbox" id="gst" checked={includeGST} onChange={(e) => setIncludeGST(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500"/>
                   <label htmlFor="gst" className="text-xs font-semibold text-gray-700 cursor-pointer">Add GST (18%)</label>
               </div>
               <div className="flex items-center space-x-2">
                   <span className="text-xs font-semibold text-gray-700">Disc %</span>
                   <input 
                    type="number" min="0" max="100" 
                    className="w-12 p-1 text-xs border rounded text-center bg-white" 
                    placeholder="0" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} 
                   />
               </div>
           </div>

           {/* Totals Display */}
           <div className="p-4 space-y-1">
               {/* 1. Strikethrough Total MRP */}
               <div className="flex justify-between items-end">
                   <span className="text-xs text-gray-400 font-medium">Total MRP</span>
                   <span className="text-sm text-gray-400 line-through decoration-gray-400 decoration-1">
                       ₹{totalMRP.toFixed(2)}
                   </span>
               </div>
               
               {/* 2. Breakdowns (GST/Discount) */}
               {(gstAmount > 0 || globalDiscountAmount > 0) && (
                   <div className="flex flex-col text-xs text-gray-500">
                        {gstAmount > 0 && <div className="flex justify-between"><span>+ GST</span><span>₹{gstAmount.toFixed(2)}</span></div>}
                        {globalDiscountAmount > 0 && <div className="flex justify-between text-red-500"><span>- Global Disc</span><span>₹{globalDiscountAmount.toFixed(2)}</span></div>}
                   </div>
               )}

               {/* 3. Final Payable & Savings */}
               <div className="flex justify-between items-center pt-2">
                   <div className="flex flex-col">
                       <span className="text-sm font-bold text-gray-700">Net Payable</span>
                       {totalSavings > 0 && (
                           <div className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mt-1 border border-green-200">
                               <Sparkles size={10} fill="currentColor"/>
                               <span className="font-bold">You Save ₹{totalSavings.toFixed(2)}</span>
                           </div>
                       )}
                   </div>
                   <span className="text-3xl font-extrabold text-teal-700">₹{grandTotal.toFixed(0)}<span className="text-lg text-gray-400 font-medium">{grandTotal % 1 !== 0 ? grandTotal.toFixed(2).slice(-3) : '.00'}</span></span>
               </div>
               
               <button onClick={handleGenerateBill} disabled={cart.length === 0} className="w-full mt-3 bg-navy-800 text-white py-3 rounded-lg shadow-lg hover:bg-navy-900 active:transform active:scale-95 transition-all font-bold text-lg flex items-center justify-center gap-2">
                   <CheckCircle size={20}/> Confirm & Print
               </button>
           </div>
        </div>
      </div>

      {showSuccessModal && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="text-green-600 w-8 h-8" /></div>
                <h3 className="text-2xl font-bold text-gray-800">Bill Saved Successfully!</h3>
                <p className="text-gray-500 mt-1">Invoice #{lastSale.id.slice(-6).toUpperCase()}</p>
                {lastSale.discountAmount && lastSale.discountAmount > 0 && (
                    <div className="mt-3 inline-block px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-100">
                        Total Savings: ₹{totalSavings.toFixed(2)}
                    </div>
                )}
             </div>
             <div className="space-y-3">
                <button onClick={generatePDF} className="w-full flex items-center justify-center space-x-2 p-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"><Printer size={18} /> <span>Print Invoice (PDF)</span></button>
                <button onClick={generateExcel} className="w-full flex items-center justify-center space-x-2 p-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"><FileSpreadsheet size={18} /> <span>Export Excel</span></button>
             </div>
             <button onClick={() => setShowSuccessModal(false)} className="mt-6 w-full p-2 text-gray-400 text-sm hover:text-gray-600">Close Window</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;