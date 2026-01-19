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
  loading: boolean; // Added loading state to interface
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  products: Product[];
  sales: Sale[];
  categories: string[];
  notifications: Notification[];
  addProduct: (product: Product) => Promise<void>; // Changed to Promise for better handling
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: string) => Promise<void>;
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
  const [loading, setLoading] = useState(true); // CRITICAL: Start loading as true
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 1. Critical Auth Listener (Fixes Session Crash)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth State Changed. User:", currentUser ? currentUser.email : "Logged Out");
      setUser(currentUser);
      setLoading(false); // CRITICAL: Stop loading only after Firebase checks auth
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (Real-time Sync)
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setSales([]);
      return;
    }

    // Products Listener
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prodList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prodList);
    }, (error) => console.error("Products sync error:", error));

    // Sales Listener
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
      console.error("Login Error:", error);
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

  // --- Inventory Actions (Robust Error Handling) ---

  const addCategory = async (category: string) => {
    try {
      if (!categories.includes(category)) {
        await addDoc(collection(db, "categories"), { name: category });
        addNotification(`Category '${category}' synced`, 'info');
      }
    } catch (error) {
      console.error("Error adding category:", error);
      addNotification("Failed to add category", "alert");
    }
  };

  const addProduct = async (product: Product) => {
    try {
      // Exclude ID from the data payload so Firestore generates one (or use provided if specific)
      // Note: If product.id is a temp timestamp, we let Firestore create a new auto-ID
      // But if we want to update the local list optimistically, we handle that via onSnapshot
      const { id, ...data } = product; 
      
      console.log("Attempting to add product:", data);
      await addDoc(collection(db, "products"), data);
      
      addNotification(`Product added to Cloud: ${product.name}`, 'info');
    } catch (error: any) {
      console.error("Error adding product:", error);
      addNotification("Failed to save medicine: " + error.message, "alert");
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const productRef = doc(db, "products", updatedProduct.id);
      await updateDoc(productRef, { ...updatedProduct });
      addNotification(`Product updated: ${updatedProduct.name}`, 'info');
    } catch (error: any) {
      console.error("Error updating product:", error);
      addNotification("Failed to update medicine", "alert");
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
      addNotification('Product deleted from inventory', 'warning');
    } catch (error: any) {
      console.error("Error deleting product:", error);
      addNotification("Failed to delete medicine", "alert");
    }
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

      console.log("Processing Sale Transaction...", newSaleData);

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
      
      return { id: newSaleRef.id, ...newSaleData } as Sale;

    } catch (e: any) {
      console.error("Transaction Failed:", e);
      addNotification("Transaction Failed: " + e.message, "alert");
      return null;
    }
  };

  // --- Smart Delete (Rollback) ---
  const deleteSale = async (saleId: string) => {
    try {
      const saleToDelete = sales.find(s => s.id === saleId);
      if (!saleToDelete) return;

      console.log("Deleting Sale & Rolling back stock:", saleId);
      const batch = writeBatch(db);

      // 1. Restore Stock (Rollback)
      saleToDelete.items.forEach(item => {
        const productRef = doc(db, "products", item.id);
        batch.update(productRef, {
          stock: increment(item.quantity)
        });
      });

      // 2. Delete Sale Record
      const saleRef = doc(db, "sales", saleId);
      batch.delete(saleRef);

      await batch.commit();
      addNotification(`Sale #${saleId.slice(-4)} deleted. Stock Restored.`, 'alert');

    } catch (e: any) {
      console.error("Delete Sale Failed:", e);
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
       console.error("Update Sale Failed:", e);
       addNotification("Update Failed", "alert");
     }
  };

  const resetSystem = async () => {
    alert("System Reset is disabled in Cloud Mode to prevent accidental data loss.");
  };

  return (
    <AppContext.Provider value={{
      user, loading, isAuthenticated: !!user, login, logout, 
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