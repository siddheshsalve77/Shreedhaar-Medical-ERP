import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Sale, Notification, CartItem } from '../types';

interface AppContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  products: Product[];
  sales: Sale[];
  categories: string[];
  notifications: Notification[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addCategory: (category: string) => void;
  processSale: (items: CartItem[], customerMobile?: string, customerName?: string, customerEmail?: string, includeGST?: boolean, discountPercentage?: number) => Sale;
  updateSale: (updatedSale: Sale) => void;
  deleteSale: (saleId: string) => void;
  resetSystem: () => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default Categories
const INITIAL_CATEGORIES = ['Syrup', 'Tablet/Medicine', 'Lotion', 'Cosmetics', 'Sanitary Pad', 'Others'];

// Dummy Initial Data (Only used if localStorage is empty)
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Paracetamol 500mg', category: 'Tablet/Medicine', batch: 'B101', expiryDate: '2026-12-31', buyPrice: 1.5, sellPrice: 5, stock: 150, location: 'Rack A1' },
  { id: '2', name: 'Amoxicillin 250mg', category: 'Tablet/Medicine', batch: 'B102', expiryDate: '2024-05-20', buyPrice: 8, sellPrice: 15, stock: 45, location: 'Rack A2' },
  { id: '3', name: 'Cough Syrup', category: 'Syrup', batch: 'B103', expiryDate: '2025-08-15', buyPrice: 40, sellPrice: 85, stock: 8, location: 'Shelf B' },
];

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  // --- Persistence Logic ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth_token') === 'true';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('products');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch (e) {
      return INITIAL_PRODUCTS;
    }
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const saved = localStorage.getItem('sales');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('categories');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch (e) {
      return INITIAL_CATEGORIES;
    }
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Save to LocalStorage whenever data changes (CRITICAL FIX for Persistence)
  useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
  
  useEffect(() => { 
    if(isAuthenticated) localStorage.setItem('auth_token', 'true'); 
    else localStorage.removeItem('auth_token');
  }, [isAuthenticated]);

  // Check for low stock logic
  useEffect(() => {
    products.forEach(p => {
      if (p.stock < 10) {
         // distinct low stock check could go here
      }
    });
  }, [products]);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  const addNotification = (message: string, type: 'info' | 'warning' | 'alert') => {
    const id = Date.now().toString() + Math.random();
    const newNotif: Notification = { id, message, type, timestamp: Date.now(), read: false };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => { removeNotification(id); }, 7000);
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  // --- CRUD Operations ---

  const addCategory = (category: string) => {
    if (!categories.includes(category)) {
      setCategories(prev => [...prev, category]);
      addNotification(`Category '${category}' created`, 'info');
    }
  };

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
    includeGST: boolean = false,
    discountPercentage: number = 0
  ) => {
    let saleProfit = 0;
    let subTotal = 0;

    const updatedProducts = products.map(product => {
      const soldItem = items.find(item => item.id === product.id);
      if (soldItem) {
        const profitPerUnit = soldItem.sellPrice - soldItem.buyPrice;
        saleProfit += profitPerUnit * soldItem.quantity;
        subTotal += soldItem.sellPrice * soldItem.quantity;
        const newStock = product.stock - soldItem.quantity;
        if (newStock < 10) addNotification(`Alert: ${product.name} running low (${newStock})`, 'warning');
        return { ...product, stock: newStock };
      }
      return product;
    });

    setProducts(updatedProducts);

    const gstAmount = includeGST ? subTotal * 0.18 : 0;
    const grossTotal = subTotal + gstAmount;
    
    // Calculate Discount based on Gross Total
    const discountAmount = (grossTotal * discountPercentage) / 100;
    const finalTotal = grossTotal - discountAmount;
    
    // Adjust Profit: Subtract discount from profit since it reduces margin
    saleProfit = saleProfit - discountAmount;

    const newSale: Sale = {
      id: Date.now().toString(),
      items, subTotal, gstAmount, discountPercentage, discountAmount,
      totalAmount: finalTotal, totalProfit: saleProfit,
      timestamp: Date.now(), customerName, customerEmail, customerMobile
    };

    setSales(prev => [newSale, ...prev]);
    addNotification(`Bill generated. Total: ₹${finalTotal.toFixed(2)}`, 'info');
    return newSale;
  };

  const updateSale = (updatedSale: Sale) => {
    const oldSale = sales.find(s => s.id === updatedSale.id);
    if (!oldSale) return;

    let tempProducts = [...products];
    // Revert Old Stock
    oldSale.items.forEach(oldItem => {
        const pIndex = tempProducts.findIndex(p => p.id === oldItem.id);
        if(pIndex > -1) tempProducts[pIndex] = { ...tempProducts[pIndex], stock: tempProducts[pIndex].stock + oldItem.quantity };
    });

    let newSaleProfit = 0;
    let newSubTotal = 0;

    // Apply New Stock
    updatedSale.items.forEach(newItem => {
        const pIndex = tempProducts.findIndex(p => p.id === newItem.id);
        if(pIndex > -1) {
             const product = tempProducts[pIndex];
             tempProducts[pIndex] = { ...product, stock: product.stock - newItem.quantity };
             newSaleProfit += (newItem.sellPrice - product.buyPrice) * newItem.quantity;
        }
        newSubTotal += newItem.sellPrice * newItem.quantity;
    });

    const hasGST = oldSale.gstAmount > 0;
    const newGstAmount = hasGST ? newSubTotal * 0.18 : 0;
    const grossTotal = newSubTotal + newGstAmount;
    
    // Recalculate Discount
    const discPct = updatedSale.discountPercentage || 0;
    const newDiscountAmount = (grossTotal * discPct) / 100;
    const newTotalAmount = grossTotal - newDiscountAmount;
    
    newSaleProfit = newSaleProfit - newDiscountAmount;

    const finalSale: Sale = {
        ...updatedSale,
        subTotal: newSubTotal,
        gstAmount: newGstAmount,
        discountAmount: newDiscountAmount,
        totalAmount: newTotalAmount,
        totalProfit: newSaleProfit
    };

    setProducts(tempProducts);
    setSales(prev => prev.map(s => s.id === updatedSale.id ? finalSale : s));
    addNotification(`Sale #${updatedSale.id} updated successfully.`, 'info');
  };

  const deleteSale = (saleId: string) => {
    const saleToDelete = sales.find(s => s.id === saleId);
    if (!saleToDelete) return;

    const updatedProducts = products.map(product => {
        const itemInBill = saleToDelete.items.find(i => i.id === product.id);
        if (itemInBill) return { ...product, stock: product.stock + itemInBill.quantity };
        return product;
    });
    setProducts(updatedProducts);
    setSales(prev => prev.filter(s => s.id !== saleId));
    addNotification(`Sale #${saleId} deleted. Stock restored.`, 'alert');
  };

  const resetSystem = () => {
      setProducts([]); 
      setSales([]);
      setCategories(INITIAL_CATEGORIES);
      localStorage.removeItem('products');
      localStorage.removeItem('sales');
      localStorage.removeItem('categories');
      addNotification("System Reset Complete. All Data Cleared.", "alert");
  };

  return (
    <AppContext.Provider value={{
      isAuthenticated, login, logout, products, sales, categories, notifications,
      addProduct, updateProduct, deleteProduct, addCategory,
      processSale, updateSale, deleteSale, resetSystem, removeNotification, markNotificationRead
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
