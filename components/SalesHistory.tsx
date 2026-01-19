import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sale, CartItem } from '../types';
import { X, Trash2, Printer, AlertCircle, Edit, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SalesHistory: React.FC = () => {
    const { sales, deleteSale, updateSale } = useApp();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Sale | null>(null);

    // Initialize edit form when a sale is selected
    useEffect(() => {
        if (selectedSale) {
            setEditForm(selectedSale);
        }
    }, [selectedSale]);

    // Re-used PDF Logic for Reprinting
    const reprintBill = (sale: Sale, e: React.MouseEvent) => {
        e.stopPropagation();
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22); doc.setTextColor(0, 128, 128); doc.text("Shreedhar Medical", 14, 20);
        doc.setFontSize(10); doc.setTextColor(0, 0, 0); 
        // Updated Address for Reprint
        doc.text("Mhada Colony, Shrirampur", 14, 25);
        doc.text("Maharashtra - 413709 | Phone: 9822062809 / 9270262809", 14, 30);
        
        doc.text("Invoice / Receipt (REPRINT)", 14, 38);

        doc.text(`Invoice ID: ${sale.id}`, 14, 45);
        doc.text(`Date: ${new Date(sale.timestamp).toLocaleString()}`, 14, 50);
        doc.text(`Customer: ${sale.customerName || 'Guest'}`, 14, 55);
        if(sale.customerMobile) doc.text(`Mobile: ${sale.customerMobile}`, 14, 60);
        
        // Updated Table Columns
        autoTable(doc, {
            startY: sale.customerMobile ? 65 : 60,
            head: [['Item Name', 'Qty', 'MRP', 'Discount', 'Net Amount']],
            body: sale.items.map(item => {
                let discStr = '-';
                if(item.itemDiscountValue > 0) {
                    discStr = item.itemDiscountType === 'PERCENT' ? `${item.itemDiscountValue}%` : `-${item.itemDiscountValue}`;
                }
                
                let effectivePrice = item.sellPrice;
                 if(item.itemDiscountValue > 0) {
                      if(item.itemDiscountType === 'PERCENT') {
                          effectivePrice = item.sellPrice - (item.sellPrice * item.itemDiscountValue / 100);
                      } else {
                          effectivePrice = item.sellPrice - item.itemDiscountValue;
                      }
                 }
                
                return [
                    item.name, 
                    item.quantity, 
                    item.sellPrice.toFixed(2), 
                    discStr, 
                    (effectivePrice * item.quantity).toFixed(2)
                ]
            }),
            theme: 'grid',
            headStyles: { fillColor: [0, 128, 128] }, // Medical Teal
            columnStyles: {
                2: { halign: 'right' }, // MRP
                3: { halign: 'center' }, // Disc
                4: { halign: 'right', fontStyle: 'bold' } // Net
            }
        });
        
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text(`Subtotal: ${sale.subTotal.toFixed(2)}`, 140, finalY);
        let nextY = finalY + 7;

        if (sale.gstAmount > 0) {
            doc.text(`GST (18%): ${sale.gstAmount.toFixed(2)}`, 140, nextY);
            nextY += 7;
        }

        if (sale.discountAmount && sale.discountAmount > 0) {
             doc.setTextColor(220, 53, 69);
             doc.text(`Discount (${sale.discountPercentage}%): -${sale.discountAmount.toFixed(2)}`, 140, nextY);
             doc.setTextColor(0,0,0);
             nextY += 7;
        }

        doc.setFont("helvetica", "bold"); 
        doc.text(`Grand Total: ${sale.totalAmount.toFixed(2)}`, 140, nextY);
        doc.save(`Reprint_Invoice_${sale.id}.pdf`);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    };

    const handleEditClick = (sale: Sale, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedSale(sale);
        setIsEditing(true);
    };

    const confirmDelete = () => {
        if(confirmDeleteId) {
            deleteSale(confirmDeleteId);
            setConfirmDeleteId(null);
            setSelectedSale(null); // Close detail modal if open
        }
    };

    const handleEditSave = () => {
        if (editForm && window.confirm("Saving changes will recalculate inventory and revenue. Proceed?")) {
            updateSale(editForm);
            setIsEditing(false);
            setSelectedSale(null); // Close modal
        }
    };

    const handleEditItemChange = (itemId: string, field: 'quantity' | 'sellPrice', value: string) => {
        if (!editForm) return;
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) return;

        const updatedItems = editForm.items.map(item => 
            item.id === itemId ? { ...item, [field]: numValue } : item
        );
        setEditForm({ ...editForm, items: updatedItems });
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Transaction History</h1>
                <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded shadow-sm border">Total Records: {sales.length}</div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sales.map((sale) => (
                                <tr key={sale.id} onClick={() => { setSelectedSale(sale); setIsEditing(false); }} className="hover:bg-teal-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4 text-sm text-gray-900">{new Date(sale.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{sale.customerName || 'Guest'}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-teal-800">₹{sale.totalAmount.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-3">
                                            <button 
                                                onClick={(e) => reprintBill(sale, e)}
                                                className="text-gray-400 hover:text-teal-600 transition-colors tooltip"
                                                title="Reprint Bill"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleEditClick(sale, e)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors tooltip"
                                                title="Edit Sale"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteClick(sale.id, e)}
                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete & Restock"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                             {sales.length === 0 && (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No sales recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Bill Modal / Edit Modal */}
            {selectedSale && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-teal-800">{isEditing ? 'Edit Sale Details' : 'Bill Details'}</h3>
                            <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600"><X /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            {/* Customer Details Section */}
                            <div className="grid grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <div><span className="text-gray-500 block">ID</span> <span className="font-medium text-gray-900">{selectedSale.id}</span></div>
                                <div><span className="text-gray-500 block">Date</span> <span className="font-medium text-gray-900">{new Date(selectedSale.timestamp).toLocaleDateString()}</span></div>
                                
                                {isEditing && editForm ? (
                                    <>
                                        <div className="col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1">Customer Name</label>
                                            <input type="text" className="w-full p-1 border rounded text-sm bg-white text-black" value={editForm.customerName || ''} onChange={(e) => setEditForm({...editForm, customerName: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1">Mobile</label>
                                            <input type="text" className="w-full p-1 border rounded text-sm bg-white text-black" value={editForm.customerMobile || ''} onChange={(e) => setEditForm({...editForm, customerMobile: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-gray-500 block mb-1">Discount (%)</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                min="0" max="100" 
                                                className="w-full p-1 border rounded text-sm bg-white text-black" 
                                                value={editForm.discountPercentage || 0} 
                                                onChange={(e) => setEditForm({...editForm, discountPercentage: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div><span className="text-gray-500 block">Customer</span> <span className="font-medium text-gray-900">{selectedSale.customerName || 'N/A'}</span></div>
                                        <div><span className="text-gray-500 block">Mobile</span> <span className="font-medium text-gray-900">{selectedSale.customerMobile || 'N/A'}</span></div>
                                    </>
                                )}
                            </div>

                            <h4 className="font-semibold text-gray-700 mb-3 border-b pb-2">Items Purchased</h4>
                            <div className="space-y-3 mb-6">
                                {(isEditing && editForm ? editForm.items : selectedSale.items).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-200 pb-2">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{item.name}</p>
                                            {isEditing ? (
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <label className="text-xs text-gray-500">Qty:</label>
                                                    <input type="number" className="w-12 p-1 border rounded text-xs text-center bg-white text-black" value={item.quantity} onChange={(e) => handleEditItemChange(item.id, 'quantity', e.target.value)} />
                                                    <label className="text-xs text-gray-500 ml-2">Price:</label>
                                                    <input type="number" step="0.01" className="w-16 p-1 border rounded text-xs text-right bg-white text-black" value={item.sellPrice} onChange={(e) => handleEditItemChange(item.id, 'sellPrice', e.target.value)} />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <div className="text-xs text-gray-500">{item.quantity} x MRP ₹{item.sellPrice.toFixed(2)}</div>
                                                    {item.itemDiscountValue > 0 && (
                                                         <div className="text-[10px] text-red-500">Disc: {item.itemDiscountType === 'PERCENT' ? item.itemDiscountValue + '%' : '₹'+item.itemDiscountValue}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-col items-end">
                                             {/* Calculate rough net for display */}
                                            {item.itemDiscountValue > 0 ? (
                                                <>
                                                    <span className="text-[10px] line-through text-gray-400">₹{(item.sellPrice * item.quantity).toFixed(2)}</span>
                                                    <p className="font-semibold text-gray-800">
                                                        ₹{
                                                            ((item.itemDiscountType === 'PERCENT' 
                                                                ? item.sellPrice * (1 - item.itemDiscountValue/100) 
                                                                : item.sellPrice - item.itemDiscountValue) * item.quantity).toFixed(2)
                                                        }
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="font-semibold text-gray-800">₹{(item.quantity * item.sellPrice).toFixed(2)}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-200 pt-4 space-y-2">
                                {/* Note: Calculated totals in Edit Mode might differ from displayed until saved. For simplicity in UI, showing original unless re-calculated via complex state. 
                                    Since editForm updates local state, we can compute rough total for display. */}
                                {isEditing && editForm ? (
                                    <div className="text-right">
                                         <p className="text-xs text-gray-500 mb-1">Estimated New Total (before GST/Disc)</p>
                                         <p className="text-xl font-bold text-blue-600">₹{editForm.items.reduce((acc, i) => acc + (i.quantity * i.sellPrice), 0).toFixed(2)}</p>
                                         <p className="text-xs text-gray-400">Final totals calculated on save.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span> <span>₹{selectedSale.subTotal.toFixed(2)}</span></div>
                                        {selectedSale.gstAmount > 0 && (
                                            <div className="flex justify-between text-sm text-gray-600"><span>GST (18%)</span> <span>₹{selectedSale.gstAmount.toFixed(2)}</span></div>
                                        )}
                                        {selectedSale.discountAmount && selectedSale.discountAmount > 0 && (
                                            <div className="flex justify-between text-sm text-red-600"><span>Discount ({selectedSale.discountPercentage}%)</span> <span>-₹{selectedSale.discountAmount.toFixed(2)}</span></div>
                                        )}
                                        <div className="flex justify-between text-lg font-bold text-teal-900 border-t border-dashed pt-2 mt-2"><span>Total Amount</span> <span>₹{selectedSale.totalAmount.toFixed(2)}</span></div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50 rounded-b-xl">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                                    <button onClick={handleEditSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                                        <Save size={16} /> Save Changes
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={(e) => reprintBill(selectedSale, e)} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2">
                                        <Printer size={16} /> Reprint
                                    </button>
                                    <button onClick={() => { setIsEditing(true); setEditForm(selectedSale); }} className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(selectedSale.id)} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center">
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in zoom-in duration-200 border-t-4 border-red-500">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertCircle size={32} />
                            <h3 className="text-lg font-bold">Confirm Delete?</h3>
                        </div>
                        <p className="text-gray-600 mb-6 text-sm">
                            Are you sure you want to delete this bill? 
                            <br/><br/>
                            <span className="font-semibold text-gray-800">This action will automatically RESTOCK inventory and deduct revenue.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium">Yes, Delete & Restock</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesHistory;