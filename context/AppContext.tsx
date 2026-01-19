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
  increment,
  getDocs
} from "firebase/firestore";

interface AppContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  products: Product[];
  sales: Sale[];
  categories: string[];
  notifications: Notification[];
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCategory: (category: string) => Promise<void>;
  processSale: (items: CartItem[], customerMobile?: string, customerName?: string, customerEmail?: string, includeGST?: boolean, discountPercentage?: number) => Promise<Sale | null>;
  updateSale: (updatedSale: Sale) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
  hardReset: () => Promise<void>; // New function
  resetSystem: () => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_CATEGORIES = ['Syrup', 'Tablet/Medicine', 'Lotion', 'Cosmetics', 'Sanitary Pad', 'Others'];

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setSales([]);
      return;
    }

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prodList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prodList);
    });

    const qSales = query(collection(db, "sales"), orderBy("timestamp", "desc"));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const saleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      setSales(saleList);
    });

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

  const addNotification = (message: string, type: 'info' | 'warning' | 'alert') => {
    const id = Date.now().toString() + Math.random();
    const newNotif: Notification = { id, message, type, timestamp: Date.now(), read: false };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => { removeNotification(id); }, 7000);
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const addCategory = async (category: string) => {
    try {
      if (!categories.includes(category)) {
        await addDoc(collection(db, "categories"), { name: category });
        addNotification(`Category '${category}' added`, 'info');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const addProduct = async (product: Product) => {
    try {
      const { id, ...data } = product; 
      await addDoc(collection(db, "products"), data);
      addNotification(`Product added: ${product.name}`, 'info');
    } catch (error: any) {
      addNotification("Error saving product", "alert");
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const productRef = doc(db, "products", updatedProduct.id);
      await updateDoc(productRef, { ...updatedProduct });
      addNotification(`Product updated: ${updatedProduct.name}`, 'info');
    } catch (error: any) {
      addNotification("Update failed", "alert");
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
      addNotification('Product deleted', 'warning');
    } catch (error: any) {
      addNotification("Delete failed", "alert");
    }
  };

  const processSale = async (items: CartItem[], customerMobile?: string, customerName?: string, customerEmail?: string, includeGST: boolean = false, discountPercentage: number = 0) => {
    try {
      let saleProfit = 0;
      let subTotal = 0;
      items.forEach(item => {
        let effectiveSellPrice = item.sellPrice;
        if(item.itemDiscountValue > 0) {
            if(item.itemDiscountType === 'PERCENT') effectiveSellPrice = item.sellPrice - (item.sellPrice * item.itemDiscountValue / 100);
            else effectiveSellPrice = item.sellPrice - item.itemDiscountValue;
        }
        saleProfit += (effectiveSellPrice - item.buyPrice) * item.quantity;
        subTotal += effectiveSellPrice * item.quantity;
      });
      const gstAmount = includeGST ? subTotal * 0.18 : 0;
      const grossTotal = subTotal + gstAmount;
      const discountAmount = (grossTotal * discountPercentage) / 100;
      const finalTotal = grossTotal - discountAmount;
      saleProfit = saleProfit - discountAmount;
      const newSaleData = { items, subTotal, gstAmount, discountPercentage, discountAmount, totalAmount: finalTotal, totalProfit: saleProfit, timestamp: Date.now(), customerName: customerName || '', customerEmail: customerEmail || '', customerMobile: customerMobile || '' };
      const batch = writeBatch(db);
      const newSaleRef = doc(collection(db, "sales"));
      batch.set(newSaleRef, newSaleData);
      items.forEach(item => {
        const productRef = doc(db, "products", item.id);
        batch.update(productRef, { stock: increment(-item.quantity) });
      });
      await batch.commit();
      addNotification(`Bill Generated: ₹${finalTotal.toFixed(2)}`, 'info');
      return { id: newSaleRef.id, ...newSaleData } as Sale;
    } catch (e: any) {
      addNotification("Transaction failed", "alert");
      return null;
    }
  };

  const deleteSale = async (saleId: string) => {
    try {
      const saleToDelete = sales.find(s => s.id === saleId);
      if (!saleToDelete) return;
      const batch = writeBatch(db);
      saleToDelete.items.forEach(item => {
        const productRef = doc(db, "products", item.id);
        batch.update(productRef, { stock: increment(item.quantity) });
      });
      const saleRef = doc(db, "sales", saleId);
      batch.delete(saleRef);
      await batch.commit();
      addNotification(`Sale deleted. Stock restored.`, 'alert');
    } catch (e: any) {
      addNotification("Delete failed", "alert");
    }
  };

  const updateSale = async (updatedSale: Sale) => {
     try {
       const saleRef = doc(db, "sales", updatedSale.id);
       await updateDoc(saleRef, { customerName: updatedSale.customerName, customerMobile: updatedSale.customerMobile });
       addNotification("Sale updated", "info");
     } catch(e: any) {
       addNotification("Update failed", "alert");
     }
  };

  const hardReset = async () => {
    try {
      const collections = ["products", "sales", "categories"];
      for (const collName of collections) {
        const q = query(collection(db, collName));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      addNotification("Factory Reset Complete", "alert");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      addNotification("Reset failed: " + error.message, "alert");
    }
  };

  const resetSystem = () => {
    alert("Use the Reset button in Dashboard with the correct admin password.");
  };

  return (
    <AppContext.Provider value={{
      user, loading, isAuthenticated: !!user, login, logout, 
      products, sales, categories, notifications,
      addProduct, updateProduct, deleteProduct, addCategory,
      processSale, updateSale, deleteSale, hardReset, resetSystem, removeNotification, markNotificationRead
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