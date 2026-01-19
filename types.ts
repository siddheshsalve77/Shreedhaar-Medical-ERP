export type ProductCategory = 'Syrup' | 'Tablet/Medicine' | 'Lotion' | 'Cosmetics' | 'Sanitary Pad' | 'Others';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  batch: string;
  expiryDate: string; // YYYY-MM-DD
  buyPrice: number;
  sellPrice: number;
  stock: number;
  location: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Sale {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string; // Changed to Optional
  items: CartItem[];
  subTotal: number;
  gstAmount: number;
  totalAmount: number;
  totalProfit: number;
  timestamp: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  timestamp: number;
  read: boolean;
}

export type ViewState = 'DASHBOARD' | 'POS' | 'INVENTORY' | 'SALES_HISTORY';
