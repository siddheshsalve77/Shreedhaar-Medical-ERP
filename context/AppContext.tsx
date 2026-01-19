import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Sale, Notification, CartItem } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  writeBatch, 
  query, 
  orderBy,
  increment
} from "firebase/firestore";

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  products: Product[];
  sales: Sale[];
  categories: string[];
  notifications: Notification[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addCategory: (category: string) => void;
  processSale: (items: CartItem[], customerMobile?: string, customerName?: string, customerEmail?: string, includeGST?: boolean, discountPercentage?: number) => Promise<Sale | null>;
  updateSale: (updatedSale: Sale) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
  resetSystem: () => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Default Categories (fallback)
const INITIAL_CATEGORIES = ['Syrup', 'Tablet/Medicine', 'Lotion', 'Cosmetics', 'Sanitary Pad', 'Others'];

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (Real-time Sync) - Only run if logged in
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setSales([]);
      return;
    }

    // Products Listener (Inventory)
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prodList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prodList);
    }, (error) => console.error("Products sync error:", error));

    // Sales Listener (Bills & Stats)
    const qSales = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const saleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setSales(saleList);
    }, (error) => console.error("Sales sync error:", error));

    // Categories Listener
    const unsubCategories = onSnapshot(collection(db, "categories"), (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().name as string);
      if(cats.length > 0) setCategories(cats);
      else setCategories(INITIAL_CATEGORIES);
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubCategories();
    };
  }, [user]);

  // --- Auth Actions ---
  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      addNotification("Welcome back to Cloud Dashboard", "info");
    } catch (error: any) {
      addNotification("Login Failed: " + error.message, "alert");
      throw error;
    }
  };

  const logout = () => signOut(auth);

  // --- Notifications ---
  const addNotification = (message: string, type: 'info' | 'warning' | 'alert') => {
    const id = Date.now().toString() + Math.random();
    const newNotif: Notification = { id, message, type, timestamp: Date.now(), read: false };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => { removeNotification(id); }, 7000);
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  // --- Inventory Actions (Cloud) ---

  const addCategory = async (category: string) => {
    if (!categories.includes(category)) {
      await addDoc(collection(db, "categories"), { name: category });
      addNotification(`Category '${category}' synced`, 'info');
    }
  };

  const addProduct = async (product: Product) => {
    // We let Firestore generate the ID or use the one provided if strictly needed
    const { id, ...data } = product; 
    await addDoc(collection(db, "products"), data);
    addNotification(`Product added to Cloud: ${product.name}`, 'info');
  };

  const updateProduct = async (updatedProduct: Product) => {
    const productRef = doc(db, "products", updatedProduct.id);
    await updateDoc(productRef, { ...updatedProduct });
    addNotification(`Product updated: ${updatedProduct.name}`, 'info');
  };

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, "products", id));
    addNotification('Product deleted from inventory', 'warning');
  };

  // --- Billing Logic (Atomic Transactions) ---

  const processSale = async (
    items: CartItem[], 
    customerMobile?: string,
    customerName?: string, 
    customerEmail?: string, 
    includeGST: boolean = false,
    discountPercentage: number = 0
  ) => {
    try {
      // 1. Calculations
      let saleProfit = 0;
      let subTotal = 0;

      items.forEach(item => {
        let effectiveSellPrice = item.sellPrice;
        if(item.itemDiscountValue > 0) {
            if(item.itemDiscountType === 'PERCENT') {
                effectiveSellPrice = item.sellPrice - (item.sellPrice * item.itemDiscountValue / 100);
            } else {
                effectiveSellPrice = item.sellPrice - item.itemDiscountValue;
            }
        }
        const profitPerUnit = effectiveSellPrice - item.buyPrice;
        saleProfit += profitPerUnit * item.quantity;
        subTotal += effectiveSellPrice * item.quantity;
      });

      const gstAmount = includeGST ? subTotal * 0.18 : 0;
      const grossTotal = subTotal + gstAmount;
      const discountAmount = (grossTotal * discountPercentage) / 100;
      const finalTotal = grossTotal - discountAmount;
      saleProfit = saleProfit - discountAmount;

      const newSaleData = {
        items, subTotal, gstAmount, discountPercentage, discountAmount,
        totalAmount: finalTotal, totalProfit: saleProfit,
        timestamp: Date.now(), customerName: customerName || '', customerEmail: customerEmail || '', customerMobile: customerMobile || ''
      };

      // 2. Atomic Batch Write (Sale + Inventory Deduct)
      const batch = writeBatch(db);

      // A. Create Sale Doc
      const newSaleRef = doc(collection(db, "sales"));
      batch.set(newSaleRef, newSaleData);

      // B. Deduct Inventory
      items.forEach(item => {
        const productRef = doc(db, "products", item.id);
        batch.update(productRef, {
          stock: increment(-item.quantity)
        });
      });

      await batch.commit();
      addNotification(`Cloud Bill Generated: ₹${finalTotal.toFixed(2)}`, 'info');
      
      // Return constructed sale object with ID for UI
      return { id: newSaleRef.id, ...newSaleData } as Sale;

    } catch (e: any) {
      console.error(e);
      addNotification("Transaction Failed: " + e.message, "alert");
      return null;
    }
  };

  // --- Smart Delete (Rollback) ---
  const deleteSale = async (saleId: string) => {
    try {
      const saleToDelete = sales.find(s => s.id === saleId);
      if (!saleToDelete) return;

      const batch = writeBatch(db);

      // 1. Restore Stock (Rollback)
      saleToDelete.items.forEach(item => {
        const productRef = doc(db, "products", item.id);
        batch.update(productRef, {
          stock: increment(item.quantity)
        });
      });

      // 2. Delete Sale Record (Updates Stats via onSnapshot automatically)
      const saleRef = doc(db, "sales", saleId);
      batch.delete(saleRef);

      await batch.commit();
      addNotification(`Sale #${saleId.slice(-4)} deleted. Stock Restored.`, 'alert');

    } catch (e: any) {
      addNotification("Delete Failed: " + e.message, "alert");
    }
  };

  const updateSale = async (updatedSale: Sale) => {
     try {
       const saleRef = doc(db, "sales", updatedSale.id);
       await updateDoc(saleRef, {
         customerName: updatedSale.customerName,
         customerMobile: updatedSale.customerMobile,
       });
       addNotification("Sale Details Updated", "info");
     } catch(e: any) {
       addNotification("Update Failed", "alert");
     }
  };

  const resetSystem = async () => {
    alert("System Reset is disabled in Cloud Mode to prevent accidental data loss.");
  };

  return (
    <AppContext.Provider value={{
      user, isAuthenticated: !!user, login, logout, 
      products, sales, categories, notifications,
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