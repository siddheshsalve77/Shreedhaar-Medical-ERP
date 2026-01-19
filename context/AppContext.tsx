import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Sale, Notification, CartItem, ProductCategory } from '../types';

interface AppContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  products: Product[];
  sales: Sale[];
  notifications: Notification[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  processSale: (items: CartItem[], customerMobile?: string, customerName?: string, customerEmail?: string, includeGST?: boolean) => Sale;
  updateSale: (updatedSale: Sale) => void;
  deleteSale: (saleId: string) => void;
  resetSystem: () => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Dummy Initial Data (Only used if localStorage is empty)
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Paracetamol 500mg', category: 'Tablet/Medicine', batch: 'B101', expiryDate: '2026-12-31', buyPrice: 1.5, sellPrice: 5, stock: 150, location: 'Rack A1' },
  { id: '2', name: 'Amoxicillin 250mg', category: 'Tablet/Medicine', batch: 'B102', expiryDate: '2024-05-20', buyPrice: 8, sellPrice: 15, stock: 45, location: 'Rack A2' },
  { id: '3', name: 'Cough Syrup', category: 'Syrup', batch: 'B103', expiryDate: '2025-08-15', buyPrice: 40, sellPrice: 85, stock: 8, location: 'Shelf B' },
  { id: '4', name: 'Vitamin C', category: 'Tablet/Medicine', batch: 'B104', expiryDate: '2023-11-01', buyPrice: 2, sellPrice: 5, stock: 20, location: 'Rack A1' },
  { id: '5', name: 'Face Wash', category: 'Cosmetics', batch: 'C99', expiryDate: '2025-01-01', buyPrice: 90, sellPrice: 150, stock: 12, location: 'Counter' },
  { id: '6', name: 'Sanitary Pads XL', category: 'Sanitary Pad', batch: 'S01', expiryDate: '2026-06-01', buyPrice: 25, sellPrice: 40, stock: 50, location: 'Aisle 3' },
  { id: '7', name: 'Moisturizing Lotion', category: 'Lotion', batch: 'L22', expiryDate: '2025-11-20', buyPrice: 120, sellPrice: 180, stock: 15, location: 'Shelf C' },
];

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  // --- Persistence Logic ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth_token') === 'true';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Save to LocalStorage whenever data changes
  useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { 
    if(isAuthenticated) localStorage.setItem('auth_token', 'true'); 
    else localStorage.removeItem('auth_token');
  }, [isAuthenticated]);

  // Check for low stock on mount (and when products change)
  useEffect(() => {
    products.forEach(p => {
      if (p.stock < 10) {
        // Debounce or check if notification already exists could be added here
      }
    });
  }, [products]);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  const addNotification = (message: string, type: 'info' | 'warning' | 'alert') => {
    const id = Date.now().toString() + Math.random();
    const newNotif: Notification = {
      id,
      message,
      type,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => { removeNotification(id); }, 7000);
  };

  const removeNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // --- CRUD Operations ---

  const addProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
    addNotification(`Product added: ${product.name}`, 'info');
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    addNotification(`Product updated: ${updatedProduct.name}`, 'info');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    addNotification('Product deleted from inventory', 'warning');
  };

  const processSale = (
    items: CartItem[], 
    customerMobile?: string,
    customerName?: string, 
    customerEmail?: string, 
    includeGST: boolean = false
  ) => {
    let saleProfit = 0;
    let subTotal = 0;

    // 1. Update Inventory & Calculate Profit
    const updatedProducts = products.map(product => {
      const soldItem = items.find(item => item.id === product.id);
      if (soldItem) {
        const profitPerUnit = soldItem.sellPrice - soldItem.buyPrice;
        saleProfit += profitPerUnit * soldItem.quantity;
        subTotal += soldItem.sellPrice * soldItem.quantity;
        const newStock = product.stock - soldItem.quantity;
        if (newStock < 10) {
           addNotification(`Alert: ${product.name} running low (${newStock})`, 'warning');
        }
        return { ...product, stock: newStock };
      }
      return product;
    });

    setProducts(updatedProducts);

    const gstAmount = includeGST ? subTotal * 0.18 : 0;
    const totalAmount = subTotal + gstAmount;

    // 2. Record Sale
    const newSale: Sale = {
      id: Date.now().toString(),
      items,
      subTotal,
      gstAmount,
      totalAmount,
      totalProfit: saleProfit,
      timestamp: Date.now(),
      customerName,
      customerEmail,
      customerMobile
    };

    setSales(prev => [newSale, ...prev]);
    addNotification(`Bill generated. Total: ₹${totalAmount.toFixed(2)}`, 'info');
    return newSale;
  };

  // --- UPDATE SALE LOGIC ---
  const updateSale = (updatedSale: Sale) => {
    const oldSale = sales.find(s => s.id === updatedSale.id);
    if (!oldSale) return;

    // 1. Revert Old Stock (Add back)
    let tempProducts = [...products];
    oldSale.items.forEach(oldItem => {
        const pIndex = tempProducts.findIndex(p => p.id === oldItem.id);
        if(pIndex > -1) {
            tempProducts[pIndex] = { 
                ...tempProducts[pIndex], 
                stock: tempProducts[pIndex].stock + oldItem.quantity 
            };
        }
    });

    // 2. Apply New Stock (Deduct) & Recalculate Profit
    let newSaleProfit = 0;
    let newSubTotal = 0;

    // We iterate over the items in the UPDATED sale
    updatedSale.items.forEach(newItem => {
        const pIndex = tempProducts.findIndex(p => p.id === newItem.id);
        if(pIndex > -1) {
             const product = tempProducts[pIndex];
             // Note: We are not blocking negative stock here to allow corrections, but we could.
             tempProducts[pIndex] = {
                 ...product,
                 stock: product.stock - newItem.quantity
             };
             
             // Recalculate Profit based on ORIGINAL buy price (or current, we use current from product ref)
             const profitPerUnit = newItem.sellPrice - product.buyPrice;
             newSaleProfit += profitPerUnit * newItem.quantity;
        }
        newSubTotal += newItem.sellPrice * newItem.quantity;
    });

    // 3. Recalculate Financials
    const hasGST = oldSale.gstAmount > 0; // Assume GST preference persists from original sale
    const newGstAmount = hasGST ? newSubTotal * 0.18 : 0;
    const newTotalAmount = newSubTotal + newGstAmount;

    const finalSale: Sale = {
        ...updatedSale,
        subTotal: newSubTotal,
        gstAmount: newGstAmount,
        totalAmount: newTotalAmount,
        totalProfit: newSaleProfit
    };

    setProducts(tempProducts);
    setSales(prev => prev.map(s => s.id === updatedSale.id ? finalSale : s));
    addNotification(`Sale #${updatedSale.id} updated successfully.`, 'info');
  };

  // --- SMART DELETE (ROLLBACK) LOGIC ---
  const deleteSale = (saleId: string) => {
    const saleToDelete = sales.find(s => s.id === saleId);
    if (!saleToDelete) return;

    // 1. Restock Inventory (Add back items)
    const updatedProducts = products.map(product => {
        const itemInBill = saleToDelete.items.find(i => i.id === product.id);
        if (itemInBill) {
            // Add quantity back to stock
            return { ...product, stock: product.stock + itemInBill.quantity };
        }
        return product;
    });
    setProducts(updatedProducts);

    // 2. Remove Sale record
    setSales(prev => prev.filter(s => s.id !== saleId));
    
    addNotification(`Sale #${saleId} deleted. Stock restored.`, 'alert');
  };

  const resetSystem = () => {
      // STRICT RESET: Clear to empty arrays as per "Delete ALL" requirement
      setProducts([]); 
      setSales([]);
      localStorage.removeItem('products');
      localStorage.removeItem('sales');
      // We do not remove 'auth_token' to keep the admin logged in
      addNotification("System Reset Complete. All Data Cleared.", "alert");
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated,
      login,
      logout,
      products,
      sales,
      notifications,
      addProduct,
      updateProduct,
      deleteProduct,
      processSale,
      updateSale,
      deleteSale,
      resetSystem,
      removeNotification,
      markNotificationRead
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
