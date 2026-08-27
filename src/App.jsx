import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, Boxes, ArrowLeftRight, Truck, ClipboardList,
  Plus, Search, AlertTriangle, PackageX, TrendingUp, TrendingDown,
  X, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, Check,
  Building2, Package, Wallet, Bell, ChevronRight, Boxes as BoxesIcon,
  Receipt, Printer, Store, ShoppingCart, User, IndianRupee,
  Contact, Phone, MessageCircle, Mail, MapPin, CalendarClock, UserPlus, StickyNote,
  Download, Upload, LogOut
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { supabase } from "./lib/supabase";
import { seedCustomers, getDefaultWhatsAppState, syncCustomersFromInvoices } from "./lib/whatsappData";
import { WhatsAppModule } from "./components/WhatsAppModule";
import { Auth } from "./components/Auth";

/* ------------------------------------------------------------------ */
/*  StockRoom — Inventory & Supplier Management                        */
/*  A self-contained operations tool for a product-based SMB.          */
/*  No external services, no AI. All state is held in-session.         */
/* ------------------------------------------------------------------ */

const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);
const STOCKROOM_STATE_ID = "main";
let cloudPersistTimer = null;
let cloudWriteQueue = Promise.resolve();
let cloudLoadPromise = null;
let lastPersistedSnapshotKey = null;
let lastScheduledSnapshotKey = null;
let cloudSaveGeneration = 0;

function normalizeCloudData(value) {
  return value && typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

const defaultShopState = {
  name: "Rudrani Collection",
  line1: "Shop No. 12, Main Market",
  city: "Rudrapur, Uttarakhand 263153",
  phone: "+91 90000 00000",
  gstin: "",
};

function getDefaultStockroomState() {
  return {
    // New/reset StockRoom starts as a genuinely blank canvas.
    // Rudrani Collection remains the shop identity.
    currency: "₹",
    suppliers: [],
    products: [],
    movements: [],
    pos: [],
    invoices: [],
    customers: [],
    leads: [],
    shop: defaultShopState,
    whatsapp: getDefaultWhatsAppState(),
  };
}

function mergeCloudState(value) {
  const cloud = normalizeCloudData(value);
  const defaults = getDefaultStockroomState();
  return {
    currency: cloud.currency ?? defaults.currency,
    suppliers: Array.isArray(cloud.suppliers) ? cloud.suppliers : defaults.suppliers,
    products: Array.isArray(cloud.products) ? cloud.products : defaults.products,
    movements: Array.isArray(cloud.movements) ? cloud.movements : defaults.movements,
    pos: Array.isArray(cloud.pos) ? cloud.pos : defaults.pos,
    invoices: Array.isArray(cloud.invoices) ? cloud.invoices : defaults.invoices,
    customers: Array.isArray(cloud.customers) ? cloud.customers : defaults.customers,
    leads: Array.isArray(cloud.leads) ? cloud.leads : defaults.leads,
    shop: { ...defaultShopState, ...(cloud.shop && typeof cloud.shop === "object" ? cloud.shop : {}) },
    whatsapp: cloud.whatsapp && typeof cloud.whatsapp === "object" ? { ...getDefaultWhatsAppState(), ...cloud.whatsapp, settings: { ...getDefaultWhatsAppState().settings, ...(cloud.whatsapp.settings || {}) } } : defaults.whatsapp,
  };
}

async function loadCloudState(userId) {
  if (cloudLoadPromise) return cloudLoadPromise;

  cloudLoadPromise = (async () => {
    console.log("[CLOUD] LOAD START", { id: STOCKROOM_STATE_ID, userId });
    const { data, error } = await supabase
      .from("stockroom_state")
      .select("data")
      .eq("id", STOCKROOM_STATE_ID)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    const nextCloudState = mergeCloudState(data && data.data);
    console.log("[CLOUD] LOAD SUCCESS", {
      id: STOCKROOM_STATE_ID,
      userId,
      hasRow: Boolean(data),
      productsCount: nextCloudState.products.length,
    });
    lastPersistedSnapshotKey = JSON.stringify(createCloudSnapshot(nextCloudState));
    lastScheduledSnapshotKey = null;
    return nextCloudState;
  })().finally(() => {
    cloudLoadPromise = null;
  });

  return cloudLoadPromise;
}

function createCloudSnapshot(nextState) {
  return {
    currency: nextState.currency,
    suppliers: nextState.suppliers,
    products: nextState.products,
    movements: nextState.movements,
    pos: nextState.pos,
    invoices: nextState.invoices,
    customers: nextState.customers,
    leads: nextState.leads,
    shop: nextState.shop,
    whatsapp: nextState.whatsapp,
  };
}

function cancelPendingCloudSave() {
  cloudSaveGeneration += 1;

  if (cloudPersistTimer) {
    clearTimeout(cloudPersistTimer);
    cloudPersistTimer = null;
  }

  lastScheduledSnapshotKey = null;
}

function scheduleCloudSave(userId, nextState, onSaveError, onSaveSuccess) {
  const snapshot = createCloudSnapshot(nextState);

  const snapshotKey = JSON.stringify(snapshot);
  if (snapshotKey === lastPersistedSnapshotKey) {
    return;
  }
  if (snapshotKey === lastScheduledSnapshotKey) {
    return;
  }

  lastScheduledSnapshotKey = snapshotKey;
  const saveGeneration = ++cloudSaveGeneration;

  if (cloudPersistTimer) {
    clearTimeout(cloudPersistTimer);
  }

  const payload = { id: STOCKROOM_STATE_ID, user_id: userId, data: snapshot };

  cloudPersistTimer = setTimeout(() => {
    cloudWriteQueue = cloudWriteQueue
      .then(async () => {
        if (saveGeneration !== cloudSaveGeneration) return;

        console.log("[CLOUD] SAVE START", {
          id: STOCKROOM_STATE_ID,
          saveGeneration,
          productsCount: payload.data.products.length,
          hasAuthCloudTest: payload.data.products.some((product) => product.name === "AUTH-CLOUD-TEST" || product.sku === "AUTH-CLOUD-TEST"),
        });

        const result = await supabase
          .from("stockroom_state")
          .upsert(payload, { onConflict: "id" });
        const { error } = result;

        console.log("[CLOUD] SAVE RESULT", {
          id: STOCKROOM_STATE_ID,
          saveGeneration,
          productsCount: payload.data.products.length,
          result,
        });

        if (error) {
          console.error("[CLOUD] SAVE ERROR", error);
          throw error;
        }

        if (saveGeneration === cloudSaveGeneration) {
          lastPersistedSnapshotKey = snapshotKey;
          lastScheduledSnapshotKey = null;
          onSaveSuccess?.();
        }
      })
      .catch((error) => {
        if (saveGeneration === cloudSaveGeneration) {
          lastScheduledSnapshotKey = null;
          onSaveError?.(error);
        }
        console.error("[CLOUD] SAVE ERROR", error);
        console.error("Failed to save StockRoom state to Supabase:", error);
      });
  }, 400);
}

function useSingleCloudState(user, authLoading) {
  const [state, setState] = useState(() => getDefaultStockroomState());
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    cancelPendingCloudSave();

    if (!user) {
      setCloudReady(false);
      setCloudError(null);
      setSaveError(null);
      return;
    }

    let active = true;
    setCloudReady(false);
    setCloudError(null);
    setSaveError(null);

    async function hydrate() {
      try {
        const cloudState = await loadCloudState(user.id);
        if (!active) return;
        setState(mergeCloudState(cloudState));
        setCloudReady(true);
      } catch (error) {
        console.error("Failed to load StockRoom cloud state from Supabase:", error);
        if (active) {
          setCloudError(error);
          setCloudReady(false);
        }
      }
    }

    hydrate();

    return () => {
      active = false;
      cancelPendingCloudSave();
    };
  }, [authLoading, user?.id, reloadToken]);

  useEffect(() => {
    if (!user || !cloudReady || cloudError) return;
    scheduleCloudSave(user.id, state, setSaveError, () => setSaveError(null));
  }, [user, cloudReady, cloudError, state]);

  return [state, setState, { cloudReady, cloudError, saveError, reloadCloud: () => setReloadToken((value) => value + 1) }];
}

const CATEGORIES = ["Fabric", "Lehenga", "Saree", "Suit / Kurta", "Gown / Anarkali", "Dupatta / Accessory", "Trims & Embellishment"];
const UOMS = ["pc", "metre", "roll", "set"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free size", "N/A"];
const IN_REASONS = ["Purchase receipt", "Customer return", "Stock adjustment", "Transfer in"];
const OUT_REASONS = ["Boutique sale", "Online order", "Exhibition / trunk show", "Alteration / sample", "Damaged / soiled", "Stock adjustment", "Transfer out"];

/* ----------------------------- seed data --------------------------- */

const seedSuppliers = [
  { id: "sup_1", name: "Surat Silk Mills", contact: "Rajesh Mehta", email: "rajesh@suratsilk.in", phone: "+91 98250 41120", leadTime: 10, terms: "Net 30", status: "active" },
  { id: "sup_2", name: "Banaras Handloom House", contact: "Anjali Verma", email: "anjali@banarashandloom.in", phone: "+91 94150 22087", leadTime: 18, terms: "Net 45", status: "active" },
  { id: "sup_3", name: "Jaipur Ethnic Wholesale", contact: "Vikram Singh", email: "vikram@jaipurethnic.in", phone: "+91 90010 33344", leadTime: 14, terms: "Net 30", status: "active" },
  { id: "sup_4", name: "Chandni Chowk Trims Co.", contact: "Farhan Ali", email: "farhan@cctrims.in", phone: "+91 98110 55098", leadTime: 7, terms: "On receipt", status: "active" },
];

const seedProducts = [
  { id: "prd_1", sku: "LEH-BRIDAL-MAROON", name: "Bridal Lehenga — Zardozi", category: "Lehenga", supplierId: "sup_3", qty: 12, reorder: 6, unitCost: 8200, unitPrice: 21999, location: "R1-A", size: "Free size", color: "Maroon", uom: "set" },
  { id: "prd_2", sku: "SAR-BANARASI-GOLD", name: "Banarasi Silk Saree", category: "Saree", supplierId: "sup_2", qty: 4, reorder: 8, unitCost: 3400, unitPrice: 8999, location: "R2-C", size: "N/A", color: "Gold", uom: "pc" },
  { id: "prd_3", sku: "FAB-RAWSILK-RED", name: "Raw Silk Fabric", category: "Fabric", supplierId: "sup_1", qty: 0, reorder: 40, unitCost: 320, unitPrice: 650, location: "F1-02", size: "N/A", color: "Rani Red", uom: "metre" },
  { id: "prd_4", sku: "FAB-GEORGETTE-BLK", name: "Georgette Fabric", category: "Fabric", supplierId: "sup_1", qty: 76, reorder: 50, unitCost: 145, unitPrice: 330, location: "F1-05", size: "N/A", color: "Black", uom: "metre" },
  { id: "prd_5", sku: "FAB-NET-IVORY", name: "Embroidered Net Fabric", category: "Fabric", supplierId: "sup_1", qty: 210, reorder: 120, unitCost: 260, unitPrice: 590, location: "F2-01", size: "N/A", color: "Ivory", uom: "metre" },
  { id: "prd_6", sku: "GWN-ANARKALI-TEAL", name: "Anarkali Gown — Sequin", category: "Gown / Anarkali", supplierId: "sup_3", qty: 18, reorder: 10, unitCost: 2600, unitPrice: 6499, location: "R3-B", size: "M", color: "Teal", uom: "pc" },
  { id: "prd_7", sku: "FAB-VELVET-GREEN", name: "Micro Velvet Fabric", category: "Fabric", supplierId: "sup_1", qty: 22, reorder: 30, unitCost: 210, unitPrice: 480, location: "F2-06", size: "N/A", color: "Bottle Green", uom: "metre" },
  { id: "prd_8", sku: "TRM-ZARI-GOLD", name: "Zari Border Roll (9m)", category: "Trims & Embellishment", supplierId: "sup_4", qty: 140, reorder: 60, unitCost: 85, unitPrice: 0, location: "T1-03", size: "N/A", color: "Gold", uom: "roll" },
];

const seedMovements = [
  { id: uid("mv_"), productId: "prd_5", type: "in", qty: 200, reason: "Purchase receipt", ref: "PO-1043", date: "2026-08-14" },
  { id: uid("mv_"), productId: "prd_6", type: "out", qty: 4, reason: "Boutique sale", ref: "SO-8891", date: "2026-08-15" },
  { id: uid("mv_"), productId: "prd_1", type: "out", qty: 2, reason: "Boutique sale", ref: "SO-8892", date: "2026-08-15" },
  { id: uid("mv_"), productId: "prd_3", type: "out", qty: 40, reason: "Alteration / sample", ref: "WO-221", date: "2026-08-13" },
  { id: uid("mv_"), productId: "prd_8", type: "in", qty: 100, reason: "Purchase receipt", ref: "PO-1041", date: "2026-08-12" },
];

const seedPOs = [
  { id: "po_1", number: "PO-1050", supplierId: "sup_1", status: "ordered", created: "2026-08-16", expected: "2026-08-26",
    lines: [{ productId: "prd_3", qty: 120, received: 0, unitCost: 320 }, { productId: "prd_7", qty: 60, received: 0, unitCost: 210 }] },
  { id: "po_2", number: "PO-1048", supplierId: "sup_2", status: "partial", created: "2026-08-10", expected: "2026-08-24",
    lines: [{ productId: "prd_2", qty: 24, received: 10, unitCost: 3400 }] },
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

const seedInvoices = [
  { id: "inv_1", number: "INV-0001", date: "2026-08-15", customer: "Priya Sharma", phone: "+91 98xxxxx210",
    lines: [{ productId: "prd_1", qty: 1, price: 21999 }], discountPct: 5, taxRate: 5, payment: "UPI" },
  { id: "inv_2", number: "INV-0002", date: "2026-08-15", customer: "Walk-in", phone: "",
    lines: [{ productId: "prd_6", qty: 1, price: 6499 }, { productId: "prd_4", qty: 3, price: 330 }], discountPct: 0, taxRate: 5, payment: "Cash" },
];

/* --- CRM: wholesale outreach --- */

const LEAD_STAGES = ["New lead", "Contacted", "Samples requested", "Negotiating", "Converted", "Dropped"];
const STAGE_TONES = { "New lead": "slate", "Contacted": "teal", "Samples requested": "amber", "Negotiating": "amber", "Converted": "emerald", "Dropped": "rose" };
const TOUCH_TYPES = ["Call", "WhatsApp", "Email", "Market visit", "Sample received", "Note"];
const TOUCH_ICONS = { Call: Phone, WhatsApp: MessageCircle, Email: Mail, "Market visit": MapPin, "Sample received": Package, Note: StickyNote };
const LEAD_SOURCES = ["Market visit", "Exhibition / trade fair", "Referral", "IndiaMART / online", "Walked into shop", "Other"];

const seedLeads = [
  { id: "ld_1", name: "Kanchipuram Silks Direct", contact: "S. Meenakshi", phone: "+91 98400 77812", email: "meenakshi@kanchisilks.in", city: "Kanchipuram", dealsIn: "Pure silk sarees, wedding range", source: "Exhibition / trade fair", stage: "Negotiating", nextFollowUp: "2026-08-18",
    touches: [
      { id: uid("tc_"), type: "Market visit", date: "2026-08-02", note: "Met at Delhi trade fair, stall B-14. Strong bridal saree range." },
      { id: uid("tc_"), type: "WhatsApp", date: "2026-08-09", note: "Shared rate card. Kanjivaram from ₹4,200/pc at 20+ qty." },
      { id: uid("tc_"), type: "Call", date: "2026-08-14", note: "Pushed for Net 30; they want advance for first order. Follow up Monday." },
    ] },
  { id: "ld_2", name: "Ludhiana Winter Fabrics", contact: "Harpreet Gill", phone: "+91 98150 44230", email: "", city: "Ludhiana", dealsIn: "Woollen suit fabric, pashmina blends", source: "Referral", stage: "Samples requested", nextFollowUp: "2026-08-21",
    touches: [
      { id: uid("tc_"), type: "Call", date: "2026-08-11", note: "Referred by Vikram (Jaipur Ethnic). Asked for winter fabric samples before Sept stock." },
    ] },
  { id: "ld_3", name: "Mumbai Kurti Hub", contact: "Deepa Nair", phone: "+91 99870 12005", email: "deepa@mkhub.in", city: "Mumbai", dealsIn: "Readymade kurtis, co-ord sets", source: "IndiaMART / online", stage: "New lead", nextFollowUp: "2026-08-17",
    touches: [] },
];

/* --------------------------- small helpers ------------------------- */

const today = () => new Date().toISOString().slice(0, 10);

function stockState(p) {
  if (p.qty <= 0) return "out";
  if (p.qty <= p.reorder) return "low";
  return "ok";
}

function invoiceTotals(inv) {
  const subtotal = inv.lines.reduce((a, l) => a + l.qty * l.price, 0);
  const discountAmt = subtotal * (inv.discountPct || 0) / 100;
  const taxable = subtotal - discountAmt;
  const gst = taxable * (inv.taxRate || 0) / 100;
  const cgst = gst / 2, sgst = gst / 2;
  const beforeRound = taxable + gst;
  const grand = Math.round(beforeRound);
  const roundOff = grand - beforeRound;
  return { subtotal, discountAmt, taxable, gst, cgst, sgst, roundOff, grand };
}

const STATE_STYLES = {
  ok: { label: "In stock", chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", bar: "bg-emerald-500" },
  low: { label: "Low stock", chip: "bg-amber-50 text-amber-700 ring-amber-600/20", bar: "bg-amber-500" },
  out: { label: "Out of stock", chip: "bg-rose-50 text-rose-700 ring-rose-600/20", bar: "bg-rose-500" },
};

/* ------------------------------ atoms ------------------------------ */

function Chip({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
    teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StateChip({ state }) {
  const s = STATE_STYLES[state];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.chip}`}>{s.label}</span>;
}

function Money({ value, cur }) {
  return <span className="tabular-nums">{cur}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <div className="mb-3 rounded-xl bg-slate-100 p-3 text-slate-400"><Icon size={22} /></div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------- app ------------------------------- */

export default function App() {
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState, cloudStatus] = useSingleCloudState(user, authLoading);
  const { cloudReady, cloudError, saveError, reloadCloud } = cloudStatus;

  const cur = state.currency;
  const suppliers = state.suppliers;
  const products = state.products;
  const movements = state.movements;
  const pos = state.pos;
  const invoices = state.invoices;
  const customers = useMemo(() => syncCustomersFromInvoices(invoices, state.customers ?? seedCustomers), [invoices, state.customers]);
  const leads = state.leads;
  const shop = state.shop;
  const whatsapp = state.whatsapp ?? getDefaultWhatsAppState();

  const setCur = (next) => setState((prev) => ({ ...prev, currency: next }));
  const setSuppliers = (next) => setState((prev) => ({ ...prev, suppliers: typeof next === "function" ? next(prev.suppliers) : next }));
  const setProducts = (next) => setState((prev) => ({ ...prev, products: typeof next === "function" ? next(prev.products) : next }));
  const setMovements = (next) => setState((prev) => ({ ...prev, movements: typeof next === "function" ? next(prev.movements) : next }));
  const setPOs = (next) => setState((prev) => ({ ...prev, pos: typeof next === "function" ? next(prev.pos) : next }));
  const setInvoices = (next) => setState((prev) => ({ ...prev, invoices: typeof next === "function" ? next(prev.invoices) : next }));
  const setCustomers = (next) => setState((prev) => ({ ...prev, customers: typeof next === "function" ? next(prev.customers) : next }));
  const setLeads = (next) => setState((prev) => ({ ...prev, leads: typeof next === "function" ? next(prev.leads) : next }));
  const setShop = (next) => setState((prev) => ({ ...prev, shop: typeof next === "function" ? next(prev.shop) : next }));
  const setWhatsApp = (next) => setState((prev) => ({ ...prev, whatsapp: typeof next === "function" ? next(prev.whatsapp ?? getDefaultWhatsAppState()) : next }));

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const product = (id) => products.find((p) => p.id === id);

  /* --- auth setup --- */
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession();
        console.log("[AUTH] SESSION", data);
        if (active) {
          console.log("[AUTH] USER", data.session?.user ?? null);
          setUser(data.session?.user ?? null);
        }
      } catch (error) {
        console.error("Failed to check auth session:", error);
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH] SESSION", { event, session });
      if (active) {
        console.log("[AUTH] USER", session?.user ?? null);
        setUser(session?.user ?? null);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  /* --- derived metrics --- */
  const metrics = useMemo(() => {
    const units = products.reduce((a, p) => a + p.qty, 0);
    const value = products.reduce((a, p) => a + p.qty * p.unitCost, 0);
    const low = products.filter((p) => stockState(p) === "low").length;
    const out = products.filter((p) => stockState(p) === "out").length;
    const openPO = pos.filter((o) => o.status !== "received").length;
    const salesToday = invoices.filter((i) => i.date === today()).reduce((a, i) => a + invoiceTotals(i).grand, 0);
    return { skus: products.length, units, value, low, out, alerts: low + out, openPO, salesToday };
  }, [products, pos, invoices]);

  /* --- mutations --- */
  function upsertProduct(data) {
    setProducts((prev) => {
      if (data.id) return prev.map((p) => (p.id === data.id ? { ...p, ...data } : p));
      return [...prev, { ...data, id: uid("prd_") }];
    });
  }
  function removeProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }
  function upsertSupplier(data) {
    setSuppliers((prev) => {
      if (data.id) return prev.map((s) => (s.id === data.id ? { ...s, ...data } : s));
      return [...prev, { ...data, id: uid("sup_") }];
    });
  }
  function removeSupplier(id) {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }
  function recordMovement(m) {
    const p = product(m.productId);
    if (!p) return;
    const delta = m.type === "in" ? m.qty : -m.qty;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, qty: Math.max(0, x.qty + delta) } : x)));
    setMovements((prev) => [{ ...m, id: uid("mv_") }, ...prev]);
  }
  function addPO(po) {
    setPOs((prev) => [{ ...po, id: uid("po_"), number: nextPONumber(prev), status: "ordered", created: today() }, ...prev]);
  }
  function receivePOLine(poId, lineIdx, amount) {
    setPOs((prev) => prev.map((po) => {
      if (po.id !== poId) return po;
      const lines = po.lines.map((l, i) => i === lineIdx ? { ...l, received: Math.min(l.qty, l.received + amount) } : l);
      const done = lines.every((l) => l.received >= l.qty);
      const some = lines.some((l) => l.received > 0);
      return { ...po, lines, status: done ? "received" : some ? "partial" : "ordered" };
    }));
    const po = pos.find((o) => o.id === poId);
    const line = po?.lines[lineIdx];
    if (line) {
      const p = product(line.productId);
      setProducts((prev) => prev.map((x) => (x.id === line.productId ? { ...x, qty: x.qty + amount } : x)));
      setMovements((prev) => [{ id: uid("mv_"), productId: line.productId, type: "in", qty: amount, reason: "Purchase receipt", ref: po.number, date: today() }, ...prev]);
    }
  }

  function nextPONumber(list) {
    const nums = list.map((o) => parseInt(o.number.replace(/\D/g, ""), 10)).filter(Boolean);
    const max = nums.length ? Math.max(...nums) : 1050;
    return "PO-" + (max + 1);
  }

  function nextInvoiceNumber() {
    const nums = invoices.map((i) => parseInt(i.number.replace(/\D/g, ""), 10)).filter(Boolean);
    const max = nums.length ? Math.max(...nums) : 0;
    return "INV-" + String(max + 1).padStart(4, "0");
  }

  function createInvoice(inv) {
    const number = nextInvoiceNumber();
    const record = { ...inv, id: uid("inv_"), number, date: today() };
    setState((prev) => {
      const nextInvoices = [record, ...prev.invoices];
      return {
        ...prev,
        invoices: nextInvoices,
        customers: syncCustomersFromInvoices(nextInvoices, prev.customers ?? seedCustomers),
      };
    });
    // Each billed line issues stock out of the room, logged against the invoice.
    inv.lines.forEach((l) => recordMovement({ productId: l.productId, type: "out", qty: l.qty, reason: "Boutique sale", ref: number, date: today() }));
    return record;
  }

  function getWhatsAppMessageKey({ customerId, customerName, companyName, phone, orderNumber, invoiceNumber, template = "Invoice delivery" }) {
    const normalized = [customerId || "", customerName || "", companyName || "", phone || "", invoiceNumber || orderNumber || "", template || ""]
      .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .join("_") || "wa_message";
    return `wa_msg_${normalized}`;
  }

  function sendMockWhatsAppMessage({ customerName, companyName, phone, orderNumber, invoiceNumber, template = "Invoice delivery", customerId, invoiceId, orderId }) {
    const invoiceRef = invoiceNumber || orderNumber || "—";
    const messageKey = getWhatsAppMessageKey({ customerId, customerName, companyName, phone, orderNumber, invoiceNumber, template });
    const payload = {
      id: messageKey,
      messageKey,
      customerId: customerId || null,
      invoiceId: invoiceId || null,
      orderId: orderId || null,
      customerName: customerName || "Customer",
      companyName: companyName || customerName || "Business",
      customerPhone: phone || "",
      orderNumber: orderNumber || invoiceRef,
      invoiceNumber: invoiceRef,
      status: "Sending",
      template,
      messageType: "invoice",
      eventText: `Invoice ${invoiceRef} sent via WhatsApp`,
      createdAt: new Date().toISOString(),
    };

    setWhatsApp((prev) => {
      const base = prev ?? getDefaultWhatsAppState();
      const messages = Array.isArray(base.messages) ? base.messages : [];
      const alreadyExists = messages.some((message) => {
        const sameId = message.id === messageKey || message.messageKey === messageKey;
        const sameInvoice = (message.invoiceNumber || message.orderNumber || "") === invoiceRef && (message.customerPhone || "") === (phone || "");
        return sameId || sameInvoice;
      });

      if (alreadyExists) {
        return base;
      }

      return {
        ...getDefaultWhatsAppState(),
        ...base,
        messages: [payload, ...messages],
      };
    });

    window.setTimeout(() => {
      setWhatsApp((prev) => ({
        ...getDefaultWhatsAppState(),
        ...(prev ?? getDefaultWhatsAppState()),
        messages: (prev?.messages || []).map((message) => message.id === messageKey || message.messageKey === messageKey ? { ...message, status: "Sent" } : message),
      }));
      window.setTimeout(() => {
        setWhatsApp((prev) => ({
          ...getDefaultWhatsAppState(),
          ...(prev ?? getDefaultWhatsAppState()),
          messages: (prev?.messages || []).map((message) => message.id === messageKey || message.messageKey === messageKey ? { ...message, status: "Delivered" } : message),
        }));
      }, 1200);
    }, 1000);
  }

  /* --- CRM actions --- */
  function upsertLead(data) {
    setLeads((prev) => {
      if (data.id) return prev.map((l) => (l.id === data.id ? { ...l, ...data } : l));
      return [{ ...data, id: uid("ld_"), touches: [] }, ...prev];
    });
  }
  function removeLead(id) { setLeads((prev) => prev.filter((l) => l.id !== id)); }
  function logTouch(leadId, touch) {
    setLeads((prev) => prev.map((l) => l.id === leadId
      ? { ...l, touches: [{ ...touch, id: uid("tc_") }, ...l.touches], nextFollowUp: touch.nextFollowUp || l.nextFollowUp }
      : l));
  }
  function setLeadStage(leadId, stage) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
  }
  function convertLead(lead) {
    // Promote a won wholesale lead into the supplier book, ready for POs.
    upsertSupplier({ name: lead.name, contact: lead.contact, email: lead.email, phone: lead.phone, leadTime: 14, terms: "Net 30", status: "active" });
    setLeadStage(lead.id, "Converted");
  }

  /* --- backup & restore --- */
  function exportBackup() {
    const data = { app: "stockroom", version: 1, exportedAt: new Date().toISOString(),
      cur, suppliers, products, movements, pos, invoices, leads, shop };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockroom-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (d.app !== "stockroom" || !Array.isArray(d.products)) {
          window.alert("This file doesn't look like a StockRoom backup.");
          return;
        }
        if (!window.confirm(`Restore backup from ${d.exportedAt ? d.exportedAt.slice(0, 10) : "unknown date"}? This replaces ALL current data on this device.`)) return;
        setCur(d.cur ?? "₹");
        setSuppliers(d.suppliers ?? []);
        setProducts(d.products ?? []);
        setMovements(d.movements ?? []);
        setPOs(d.pos ?? []);
        setInvoices(d.invoices ?? []);
        setLeads(d.leads ?? []);
        if (d.shop) setShop(d.shop);
        window.alert("Backup restored.");
      } catch {
        window.alert("Couldn't read this file. Make sure it's a StockRoom backup (.json).");
      }
    };
    reader.readAsText(file);
  }

  async function handleResetAllData() {
    if (!window.confirm("Clear ALL saved data for Rudrani Collection (products, invoices, leads, everything) and start with a blank StockRoom? This cannot be undone.")) {
      return;
    }

    try {
      // Cancel any pending save timer to prevent stale saves after reset
      cancelPendingCloudSave();

      // Wait for any in-flight save to complete before proceeding
      await cloudWriteQueue;

      // Get the default/reset state
      const resetState = getDefaultStockroomState();
      const resetSnapshotKey = JSON.stringify(createCloudSnapshot(resetState));

      // Perform the Supabase upsert to persist the reset state to cloud
      const payload = { id: STOCKROOM_STATE_ID, user_id: user.id, data: resetState };
      const { error } = await supabase
        .from("stockroom_state")
        .upsert(payload, { onConflict: "id" });

      if (error) {
        console.error("[CLOUD] RESET ERROR", error);
        window.alert("Failed to reset data on cloud. Please try again.");
        return;
      }

      // Update persist-tracking variables BEFORE state update.
      // This ensures scheduleCloudSave won't queue a new save when it runs after the re-render.
      lastPersistedSnapshotKey = resetSnapshotKey;
      lastScheduledSnapshotKey = null;

      // Update the React state (this triggers re-render and useEffect)
      setState(resetState);

      // Reload the page to complete the reset
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("[CLOUD] RESET ERROR", error);
      window.alert("Failed to reset data. Please try again.");
    }
  }

  const overdueFollowUps = leads.filter((l) => !["Converted", "Dropped"].includes(l.stage) && l.nextFollowUp && l.nextFollowUp <= today()).length;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "billing", label: "Billing", icon: Receipt },
    { id: "inventory", label: "Inventory", icon: Boxes, badge: metrics.alerts || null },
    { id: "movements", label: "Stock movements", icon: ArrowLeftRight },
    { id: "suppliers", label: "Suppliers", icon: Truck },
    { id: "purchasing", label: "Purchase orders", icon: ClipboardList, badge: metrics.openPO || null },
    { id: "crm", label: "Wholesale CRM", icon: Contact, badge: overdueFollowUps || null },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  ];

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans text-slate-800">
        <div className="text-center">
          <div className="mb-4 h-3 w-3 rounded-full bg-teal-700 mx-auto animate-pulse"></div>
          <p className="text-sm text-slate-500">Loading StockRoom...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Auth />;
  }

  if (cloudError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans text-slate-800">
        <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <h1 className="text-base font-semibold text-slate-900">Could not load StockRoom data</h1>
          <p className="mt-2 text-sm text-slate-500">Your shared company data was not changed. Check the connection and try again.</p>
          <button
            onClick={reloadCloud}
            className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!cloudReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans text-slate-800">
        <div className="text-center">
          <div className="mb-4 h-3 w-3 rounded-full bg-teal-700 mx-auto animate-pulse"></div>
          <p className="text-sm text-slate-500">Loading shared company data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #print-invoice, #print-invoice * { visibility: visible !important; }
        #print-invoice { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        .no-print { display: none !important; }
      }`}</style>
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-700 text-white shadow-sm">
            <BoxesIcon size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-slate-900">StockRoom</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Ops · v1</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <n.icon size={17} className={active ? "text-teal-700" : "text-slate-400"} />
                <span className="flex-1 text-left">{n.label}</span>
                {n.badge && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{n.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Currency</label>
          <select value={cur} onChange={(e) => setCur(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            {["₹", "$", "€", "£"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={exportBackup} title="Download all data as a backup file"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
              <Download size={13} /> Backup
            </button>
            <label title="Restore from a backup file"
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
              <Upload size={13} /> Restore
              <input type="file" accept=".json,application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ""; }} />
            </label>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700">
            <LogOut size={13} /> Sign Out
          </button>
          <button
            onClick={handleResetAllData}
            className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
            Reset all data
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top nav */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${view === n.id ? "bg-teal-50 text-teal-800" : "text-slate-500"}`}>
              <n.icon size={14} /> {n.label}
            </button>
          ))}
        </div>

        <main className="flex-1 px-4 py-6 sm:px-8">
          {saveError && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              StockRoom could not save the latest change to cloud. Your changes are still on this screen; please check the connection before refreshing.
            </div>
          )}
          {view === "dashboard" && (
            <Dashboard metrics={metrics} products={products} movements={movements} cur={cur} supplierName={supplierName} product={product} go={setView} />
          )}
          {view === "billing" && (
            <Billing invoices={invoices} products={products} product={product} cur={cur} shop={shop} onShop={setShop} metrics={metrics} onCreate={createInvoice} />
          )}
          {view === "inventory" && (
            <Inventory products={products} suppliers={suppliers} cur={cur} supplierName={supplierName}
              onSave={upsertProduct} onDelete={removeProduct} onMove={recordMovement} />
          )}
          {view === "movements" && (
            <Movements movements={movements} products={products} product={product} cur={cur} onMove={recordMovement} />
          )}
          {view === "suppliers" && (
            <Suppliers suppliers={suppliers} products={products} onSave={upsertSupplier} onDelete={removeSupplier} go={setView} />
          )}
          {view === "purchasing" && (
            <Purchasing pos={pos} suppliers={suppliers} products={products} cur={cur} supplierName={supplierName} product={product}
              onCreate={addPO} onReceive={receivePOLine} />
          )}
          {view === "crm" && (
            <CRM leads={leads} onSave={upsertLead} onDelete={removeLead} onTouch={logTouch} onStage={setLeadStage} onConvert={convertLead} go={setView} />
          )}
          {view === "whatsapp" && (
            <WhatsAppModule
              customers={customers}
              invoices={invoices}
              whatsapp={whatsapp}
              shop={shop}
              onSelectCustomer={(customer) => setCustomers((prev) => prev.map((item) => item.id === customer.id ? customer : item))}
              onSendInvoice={(invoice, customer) => {
                if (!invoice) return;
                const matchedCustomer = customer || customers.find((item) => item.name === invoice.customer || item.whatsapp === invoice.phone) || customers[0];
                const invoiceNumber = invoice.number || invoice.invoiceNumber || "—";
                const companyName = matchedCustomer?.companyName || matchedCustomer?.name || invoice.customer || "Business";
                sendMockWhatsAppMessage({
                  customerId: matchedCustomer?.id,
                  invoiceId: invoice?.id,
                  orderId: invoice?.id,
                  customerName: matchedCustomer?.primaryContact || matchedCustomer?.name || invoice.customer || "Customer",
                  companyName,
                  phone: matchedCustomer?.whatsapp || invoice.phone || "+91 00000 00000",
                  invoiceNumber,
                  orderNumber: invoiceNumber,
                  template: "Invoice delivery",
                });
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* --------------------------- Dashboard ----------------------------- */

function KPI({ icon: Icon, label, value, tone = "slate", sub }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}><Icon size={16} /></span>
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Dashboard({ metrics, products, movements, cur, product, go }) {
  const byCat = useMemo(() => {
    const m = {};
    products.forEach((p) => { m[p.category] = (m[p.category] || 0) + p.qty * p.unitCost; });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [products]);

  const alerts = products.filter((p) => stockState(p) !== "ok").sort((a, b) => a.qty - b.qty);
  const recent = movements.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Operations overview</h1>
        <p className="text-sm text-slate-500">Live stock position across every SKU in the room.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI icon={Package} label="Active SKUs" value={metrics.skus} tone="teal" sub={`${metrics.units.toLocaleString()} units on hand`} />
        <KPI icon={Wallet} label="Stock value (at cost)" value={<span>{cur}{Math.round(metrics.value).toLocaleString()}</span>} />
        <KPI icon={AlertTriangle} label="Low stock" value={metrics.low} tone="amber" sub="At or below reorder point" />
        <KPI icon={PackageX} label="Out of stock" value={metrics.out} tone="rose" sub="Needs replenishment" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* value by category */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-800">Inventory value by category</h2>
          <p className="mb-4 text-xs text-slate-400">Quantity on hand × unit cost</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCat} margin={{ left: -18, right: 8, top: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [`${cur}${v.toLocaleString()}`, "Value"]} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byCat.map((_, i) => <Cell key={i} fill="#0f766e" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* alerts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Bell size={15} className="text-amber-500" /> Replenishment alerts</h2>
            {alerts.length > 0 && <button onClick={() => go("purchasing")} className="text-xs font-medium text-teal-700 hover:underline">Raise PO</button>}
          </div>
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Everything is above its reorder point.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{p.name}</div>
                    <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums text-slate-700">{p.qty}<span className="text-slate-300">/{p.reorder}</span></span>
                    <StateChip state={stockState(p)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* recent activity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent stock activity</h2>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Movement</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((m) => {
                const p = product(m.productId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{p?.name ?? "—"}</div>
                      <div className="font-mono text-xs text-slate-400">{p?.sku}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 font-mono text-sm font-medium ${m.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.type === "in" ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
                        {m.type === "in" ? "+" : "−"}{m.qty}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{m.reason}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.ref || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">{m.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Inventory ----------------------------- */

function Inventory({ products, suppliers, cur, supplierName, onSave, onDelete, onMove }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);   // product or {} for new
  const [moving, setMoving] = useState(null);      // product to move

  const rows = useMemo(() => {
    return products
      .filter((p) => cat === "all" || p.category === cat)
      .filter((p) => (p.name + p.sku).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, q, cat]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">{products.length} SKUs tracked · {rows.length} shown</p>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800">
          <Plus size={16} /> Add product
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…" className={`${inputCls} pl-9`} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty icon={Boxes} title="No products match" body="Try a different search term, or add a new product to start tracking it."
          action={<button onClick={() => setEditing({})} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">Add product</button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const st = stockState(p);
                const pct = Math.min(100, p.reorder ? (p.qty / (p.reorder * 2)) * 100 : 100);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="font-mono text-xs text-slate-400">{p.sku} · {p.location}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.color && <Chip tone="teal">{p.color}</Chip>}
                        {p.size && p.size !== "N/A" && <Chip>{p.size}</Chip>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Chip>{p.category}</Chip></td>
                    <td className="px-4 py-3 text-slate-600">{supplierName(p.supplierId)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="min-w-[3.5rem] font-mono text-sm tabular-nums text-slate-800">{p.qty}<span className="text-slate-400"> {p.uom}</span></span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${STATE_STYLES[st].bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">reorder @ {p.reorder} {p.uom}</div>
                    </td>
                    <td className="px-4 py-3"><StateChip state={st} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700"><Money value={p.qty * p.unitCost} cur={cur} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setMoving(p)} title="Record movement" className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-50"><ArrowLeftRight size={15} /></button>
                        <button onClick={() => setEditing(p)} title="Edit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
                        <button onClick={() => onDelete(p.id)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ProductModal product={editing} suppliers={suppliers} onClose={() => setEditing(null)} onSave={(d) => { onSave(d); setEditing(null); }} />}
      {moving && <MovementModal preselect={moving} products={products} onClose={() => setMoving(null)} onMove={(m) => { onMove(m); setMoving(null); }} />}
    </div>
  );
}

function ProductModal({ product, suppliers, onClose, onSave }) {
  const isNew = !product.id;
  const [f, setF] = useState({
    id: product.id, sku: product.sku || "", name: product.name || "", category: product.category || CATEGORIES[0],
    supplierId: product.supplierId || suppliers[0]?.id || "", qty: product.qty ?? 0, reorder: product.reorder ?? 0,
    unitCost: product.unitCost ?? 0, unitPrice: product.unitPrice ?? 0, location: product.location || "",
    color: product.color || "", size: product.size || "N/A", uom: product.uom || "pc",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setNum = (k) => (e) => setF({ ...f, [k]: e.target.value === "" ? "" : Number(e.target.value) });
  const valid = f.name.trim() && f.sku.trim();

  return (
    <Modal title={isNew ? "Add product" : "Edit product"} subtitle={isNew ? "Create a new SKU to track" : product.sku} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Product name"><input className={inputCls} value={f.name} onChange={set("name")} placeholder="e.g. Shipping Box — Medium" /></Field>
        <Field label="SKU"><input className={`${inputCls} font-mono`} value={f.sku} onChange={set("sku")} placeholder="PKG-BOX-M" /></Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Preferred supplier">
          <select className={inputCls} value={f.supplierId} onChange={set("supplierId")}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Colour"><input className={inputCls} value={f.color} onChange={set("color")} placeholder="Maroon / Gold / Ivory" /></Field>
        <Field label="Size" hint="Use N/A for fabrics sold by length">
          <select className={inputCls} value={f.size} onChange={set("size")}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Unit of measure" hint="Pieces / sets for garments, metres / rolls for fabric">
          <select className={inputCls} value={f.uom} onChange={set("uom")}>{UOMS.map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
        <Field label={`Quantity on hand (${f.uom})`} hint={isNew ? "Opening stock" : "Adjust via Stock movements to keep an audit trail"}>
          <input type="number" min="0" className={inputCls} value={f.qty} onChange={setNum("qty")} />
        </Field>
        <Field label="Reorder point" hint="Alert triggers at or below this level">
          <input type="number" min="0" className={inputCls} value={f.reorder} onChange={setNum("reorder")} />
        </Field>
        <Field label="Unit cost"><input type="number" min="0" step="0.01" className={inputCls} value={f.unitCost} onChange={setNum("unitCost")} /></Field>
        <Field label="Unit price (sell)"><input type="number" min="0" step="0.01" className={inputCls} value={f.unitPrice} onChange={setNum("unitPrice")} /></Field>
        <Field label="Bin / location"><input className={`${inputCls} font-mono`} value={f.location} onChange={set("location")} placeholder="A1-03" /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!valid} onClick={() => onSave({ ...f, qty: Number(f.qty) || 0, reorder: Number(f.reorder) || 0, unitCost: Number(f.unitCost) || 0, unitPrice: Number(f.unitPrice) || 0 })}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">{isNew ? "Create product" : "Save changes"}</button>
      </div>
    </Modal>
  );
}

/* -------------------------- Movements ------------------------------ */

function MovementModal({ preselect, products, onClose, onMove }) {
  const [f, setF] = useState({
    productId: preselect?.id || products[0]?.id || "", type: "in", qty: 1,
    reason: IN_REASONS[0], ref: "", date: today(),
  });
  const reasons = f.type === "in" ? IN_REASONS : OUT_REASONS;
  const p = products.find((x) => x.id === f.productId);
  const overdraw = f.type === "out" && p && f.qty > p.qty;

  function switchType(t) { setF({ ...f, type: t, reason: (t === "in" ? IN_REASONS : OUT_REASONS)[0] }); }

  return (
    <Modal title="Record stock movement" subtitle="Every change writes a line to the movement ledger" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button onClick={() => switchType("in")} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium ${f.type === "in" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>
            <ArrowDownToLine size={15} /> Stock in
          </button>
          <button onClick={() => switchType("out")} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium ${f.type === "out" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}>
            <ArrowUpFromLine size={15} /> Stock out
          </button>
        </div>

        <Field label="Product">
          <select className={inputCls} value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
            {products.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.sku}</option>)}
          </select>
        </Field>
        {p && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Currently on hand: <span className="font-mono font-medium text-slate-700">{p.qty} {p.uom}</span> · will become <span className={`font-mono font-medium ${overdraw ? "text-rose-600" : "text-slate-700"}`}>{Math.max(0, f.type === "in" ? p.qty + Number(f.qty || 0) : p.qty - Number(f.qty || 0))} {p.uom}</span></div>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity"><input type="number" min="1" className={inputCls} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Reason">
          <select className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{reasons.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Reference" hint="PO / SO number, or a note"><input className={inputCls} value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="PO-1050 / SO-8891" /></Field>

        {overdraw && <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertTriangle size={14} /> This exceeds stock on hand — it will be floored at zero.</div>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!f.qty || f.qty < 1} onClick={() => onMove(f)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">Record movement</button>
      </div>
    </Modal>
  );
}

function Movements({ movements, products, product, cur, onMove }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const rows = movements.filter((m) => filter === "all" || m.type === filter);

  const inTotal = movements.filter((m) => m.type === "in").reduce((a, m) => a + m.qty, 0);
  const outTotal = movements.filter((m) => m.type === "out").reduce((a, m) => a + m.qty, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Stock movements</h1>
          <p className="text-sm text-slate-500">The full in/out ledger — {movements.length} entries</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
          <Plus size={16} /> Record movement
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrendingUp size={14} className="text-emerald-600" /> Total received</div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-600">+{inTotal.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrendingDown size={14} className="text-rose-600" /> Total issued</div>
          <div className="mt-1 font-mono text-xl font-semibold text-rose-600">−{outTotal.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {[["all", "All"], ["in", "Stock in"], ["out", "Stock out"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === v ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty icon={ArrowLeftRight} title="No movements yet" body="Record a stock-in or stock-out and it will appear here as a permanent ledger line." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Cost impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((m) => {
                const p = product(m.productId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.date}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p?.name ?? "—"}</div>
                      <div className="font-mono text-xs text-slate-400">{p?.sku}</div>
                    </td>
                    <td className="px-4 py-3">{m.type === "in" ? <Chip tone="emerald">In</Chip> : <Chip tone="rose">Out</Chip>}</td>
                    <td className={`px-4 py-3 font-mono font-medium ${m.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>{m.type === "in" ? "+" : "−"}{m.qty}</td>
                    <td className="px-4 py-3 text-slate-600">{m.reason}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.ref || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{p ? <Money value={m.qty * p.unitCost} cur={cur} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <MovementModal products={products} onClose={() => setOpen(false)} onMove={(m) => { onMove(m); setOpen(false); }} />}
    </div>
  );
}

/* --------------------------- Suppliers ----------------------------- */

function Suppliers({ suppliers, products, onSave, onDelete, go }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const rows = suppliers.filter((s) => (s.name + s.contact).toLowerCase().includes(q.toLowerCase()));
  const skuCount = (id) => products.filter((p) => p.supplierId === id).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">{suppliers.length} suppliers · {suppliers.filter((s) => s.status === "active").length} active</p>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
          <Plus size={16} /> Add supplier
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…" className={`${inputCls} pl-9`} />
      </div>

      {rows.length === 0 ? (
        <Empty icon={Truck} title="No suppliers found" body="Add a supplier to link it to products and raise purchase orders." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <div key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><Building2 size={18} /></div>
                  <div>
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.contact}</div>
                  </div>
                </div>
                <Chip tone={s.status === "active" ? "emerald" : "slate"}>{s.status}</Chip>
              </div>

              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd className="truncate pl-2 text-slate-700">{s.email}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Phone</dt><dd className="font-mono text-slate-700">{s.phone}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Lead time</dt><dd className="font-mono text-slate-700">{s.leadTime} days</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Terms</dt><dd className="text-slate-700">{s.terms}</dd></div>
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500"><span className="font-mono font-medium text-slate-700">{skuCount(s.id)}</span> SKUs supplied</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
                  <button onClick={() => onDelete(s.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <SupplierModal supplier={editing} onClose={() => setEditing(null)} onSave={(d) => { onSave(d); setEditing(null); }} />}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSave }) {
  const isNew = !supplier.id;
  const [f, setF] = useState({
    id: supplier.id, name: supplier.name || "", contact: supplier.contact || "", email: supplier.email || "",
    phone: supplier.phone || "", leadTime: supplier.leadTime ?? 7, terms: supplier.terms || "Net 30", status: supplier.status || "active",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim();

  return (
    <Modal title={isNew ? "Add supplier" : "Edit supplier"} subtitle={isNew ? "Create a vendor record" : supplier.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Company name"><input className={inputCls} value={f.name} onChange={set("name")} placeholder="Meridian Packaging Co." /></Field>
        <Field label="Contact person"><input className={inputCls} value={f.contact} onChange={set("contact")} placeholder="Ana Duarte" /></Field>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={set("email")} placeholder="ana@supplier.com" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} placeholder="+44 20 …" /></Field>
        <Field label="Lead time (days)" hint="Used to plan reorders"><input type="number" min="0" className={inputCls} value={f.leadTime} onChange={(e) => setF({ ...f, leadTime: Number(e.target.value) })} /></Field>
        <Field label="Payment terms">
          <select className={inputCls} value={f.terms} onChange={set("terms")}>{["Net 15", "Net 30", "Net 45", "Net 60", "On receipt"].map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!valid} onClick={() => onSave(f)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">{isNew ? "Create supplier" : "Save changes"}</button>
      </div>
    </Modal>
  );
}

/* -------------------------- Purchasing ----------------------------- */

const PO_STATUS = {
  ordered: { label: "Ordered", tone: "teal" },
  partial: { label: "Partially received", tone: "amber" },
  received: { label: "Received", tone: "emerald" },
};

function Purchasing({ pos, suppliers, products, cur, supplierName, product, onCreate, onReceive }) {
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState(null);

  const sorted = [...pos].sort((a, b) => (b.created > a.created ? 1 : -1));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Purchase orders</h1>
          <p className="text-sm text-slate-500">Raise orders to suppliers and receive stock against them</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
          <Plus size={16} /> New purchase order
        </button>
      </div>

      {sorted.length === 0 ? (
        <Empty icon={ClipboardList} title="No purchase orders" body="Create a PO to a supplier. Receiving against it automatically records stock-in movements."
          action={<button onClick={() => setCreating(true)} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">New purchase order</button>} />
      ) : (
        <div className="space-y-4">
          {sorted.map((po) => {
            const total = po.lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
            const st = PO_STATUS[po.status];
            const fullyReceived = po.status === "received";
            return (
              <div key={po.id} className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm font-semibold text-slate-900">{po.number}</div>
                    <Chip tone={st.tone}>{st.label}</Chip>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{supplierName(po.supplierId)}</span>
                    <span>Expected <span className="font-mono text-slate-700">{po.expected}</span></span>
                    <span className="font-mono font-medium text-slate-800"><Money value={total} cur={cur} /></span>
                    {!fullyReceived && <button onClick={() => setReceiving(po)} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800"><ArrowDownToLine size={13} /> Receive</button>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {po.lines.map((l, i) => {
                        const p = product(l.productId);
                        const pct = l.qty ? (l.received / l.qty) * 100 : 0;
                        return (
                          <tr key={i}>
                            <td className="px-5 py-2.5">
                              <div className="font-medium text-slate-700">{p?.name ?? "—"}</div>
                              <div className="font-mono text-xs text-slate-400">{p?.sku}</div>
                            </td>
                            <td className="px-5 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-500">{l.received}/{l.qty}</span>
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-teal-600" style={{ width: `${pct}%` }} /></div>
                              </div>
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-xs text-slate-500"><Money value={l.qty * l.unitCost} cur={cur} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <POModal suppliers={suppliers} products={products} cur={cur} onClose={() => setCreating(false)} onCreate={(po) => { onCreate(po); setCreating(false); }} />}
      {receiving && <ReceiveModal po={receiving} product={product} cur={cur} onClose={() => setReceiving(null)} onReceive={onReceive} />}
    </div>
  );
}

function POModal({ suppliers, products, cur, onClose, onCreate }) {
  const [supplierId, setSupplierId] = useState(suppliers.find((s) => s.status === "active")?.id || suppliers[0]?.id || "");
  const [expected, setExpected] = useState(today());
  const [lines, setLines] = useState([]);

  const supplierProducts = products.filter((p) => p.supplierId === supplierId);

  function addLine() {
    const p = supplierProducts[0] || products[0];
    if (!p) return;
    setLines([...lines, { productId: p.id, qty: Math.max(1, p.reorder), received: 0, unitCost: p.unitCost }]);
  }
  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
  const valid = supplierId && lines.length > 0 && lines.every((l) => l.qty > 0);

  return (
    <Modal title="New purchase order" subtitle="Raise an order to replenish stock" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier">
            <select className={inputCls} value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setLines([]); }}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Expected delivery"><input type="date" className={inputCls} value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
        </div>

        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</span>
            <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><Plus size={13} /> Add line</button>
          </div>
          {lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No lines yet. Add a product to order.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 px-4 py-3">
                  <div className="col-span-6">
                    <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Product</span>
                    <select className={`${inputCls} py-1.5`} value={l.productId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); updateLine(i, { productId: e.target.value, unitCost: p?.unitCost ?? l.unitCost }); }}>
                      {(supplierProducts.length ? supplierProducts : products).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Qty</span>
                    <input type="number" min="1" className={`${inputCls} py-1.5`} value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3">
                    <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Unit cost</span>
                    <input type="number" min="0" step="0.01" className={`${inputCls} py-1.5`} value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-1 pb-1">
                    <button onClick={() => removeLine(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">Order total</span>
          <span className="font-mono text-lg font-semibold text-slate-900"><Money value={total} cur={cur} /></span>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!valid} onClick={() => onCreate({ supplierId, expected, lines })} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">Create order</button>
      </div>
    </Modal>
  );
}

function ReceiveModal({ po, product, cur, onClose, onReceive }) {
  const [amounts, setAmounts] = useState(po.lines.map((l) => Math.max(0, l.qty - l.received)));

  function receiveAll() {
    po.lines.forEach((l, i) => { if (amounts[i] > 0) onReceive(po.id, i, amounts[i]); });
    onClose();
  }

  return (
    <Modal title={`Receive ${po.number}`} subtitle="Confirm quantities arriving into the room" onClose={onClose} wide>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Ordered</th>
              <th className="px-4 py-2.5 font-medium">Already in</th>
              <th className="px-4 py-2.5 font-medium">Receiving now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {po.lines.map((l, i) => {
              const p = product(l.productId);
              const remaining = l.qty - l.received;
              return (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{p?.name ?? "—"}</div>
                    <div className="font-mono text-xs text-slate-400">{p?.sku}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{l.qty}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{l.received}</td>
                  <td className="px-4 py-3">
                    <input type="number" min="0" max={remaining} value={amounts[i]}
                      onChange={(e) => setAmounts(amounts.map((a, idx) => idx === i ? Math.min(remaining, Math.max(0, Number(e.target.value))) : a))}
                      className={`${inputCls} w-24 py-1.5`} disabled={remaining <= 0} />
                    {remaining <= 0 && <span className="ml-2 text-xs text-emerald-600">Complete</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Check size={13} /> Receiving writes stock-in movements and updates quantities automatically.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={receiveAll} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Confirm receipt</button>
      </div>
    </Modal>
  );
}

/* ---------------------------- Billing ------------------------------ */

function Billing({ invoices, products, product, cur, shop, onShop, metrics, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editingShop, setEditingShop] = useState(false);

  const fmt = (n) => cur + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const salesTotal = invoices.reduce((a, i) => a + invoiceTotals(i).grand, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500">Ring up a sale — stock is deducted automatically when you bill</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditingShop(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Store size={15} /> Shop details
          </button>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
            <Plus size={16} /> New sale
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IndianRupee size={14} className="text-teal-700" /> Sales today</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{fmt(metrics.salesToday)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Receipt size={14} className="text-slate-400" /> Invoices</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{invoices.length}</div>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><ShoppingCart size={14} className="text-slate-400" /> Total billed</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{fmt(salesTotal)}</div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Empty icon={Receipt} title="No invoices yet" body="Ring up your first sale. Each bill issues stock out and appears here."
          action={<button onClick={() => setCreating(true)} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">New sale</button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const t = invoiceTotals(inv);
                const items = inv.lines.reduce((a, l) => a + l.qty, 0);
                return (
                  <tr key={inv.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setViewing(inv)}>
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{inv.number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.date}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.customer || "Walk-in"}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.lines.length} lines</td>
                    <td className="px-4 py-3"><Chip>{inv.payment}</Chip></td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">{fmt(t.grand)}</td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">View <ChevronRight size={13} /></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewInvoiceModal products={products} cur={cur} onClose={() => setCreating(false)}
        onSave={(inv) => { const rec = onCreate(inv); setCreating(false); setViewing(rec); }} />}
      {viewing && <InvoiceView invoice={viewing} product={product} cur={cur} shop={shop} onClose={() => setViewing(null)} onSendWhatsApp={() => {
        const customer = customers.find((item) => item.name === viewing.customer || item.whatsapp === viewing.phone) || customers[0];
        sendMockWhatsAppMessage({
          customerId: customer?.id,
          invoiceId: viewing?.id,
          orderId: viewing?.id,
          customerName: customer?.primaryContact || customer?.name || viewing.customer || "Customer",
          companyName: customer?.companyName || customer?.name || viewing.customer || "Business",
          phone: customer?.whatsapp || viewing.phone || "+91 00000 00000",
          invoiceNumber: viewing.number,
          orderNumber: viewing.number,
          template: "Invoice delivery",
        });
      }} />}
      {editingShop && <ShopModal shop={shop} onClose={() => setEditingShop(false)} onSave={(s) => { onShop(s); setEditingShop(false); }} />}
    </div>
  );
}

function NewInvoiceModal({ products, cur, onClose, onSave }) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState(PAYMENT_MODES[0]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [lines, setLines] = useState([]);

  const fmt = (n) => cur + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prod = (id) => products.find((p) => p.id === id);

  function addLine() {
    const p = products[0];
    if (!p) return;
    setLines([...lines, { productId: p.id, qty: 1, price: p.unitPrice || 0 }]);
  }
  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  const draft = { lines, discountPct: Number(discountPct) || 0, taxRate: Number(taxRate) || 0 };
  const t = invoiceTotals(draft);
  const valid = lines.length > 0 && lines.every((l) => l.qty > 0 && l.price >= 0);

  return (
    <Modal title="New sale" subtitle="Add items, then generate the bill" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Customer name"><input className={inputCls} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" /></Field>
          <Field label="Phone"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></Field>
          <Field label="Payment mode">
            <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value)}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</span>
            <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><Plus size={13} /> Add item</button>
          </div>
          {lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No items yet. Add a fabric or garment to bill.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {lines.map((l, i) => {
                const p = prod(l.productId);
                const step = p?.uom === "metre" ? 0.5 : 1;
                const short = p && l.qty > p.qty;
                return (
                  <div key={i} className="grid grid-cols-12 items-end gap-2 px-4 py-3">
                    <div className="col-span-5">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Item</span>
                      <select className={`${inputCls} py-1.5`} value={l.productId} onChange={(e) => { const np = prod(e.target.value); updateLine(i, { productId: e.target.value, price: np?.unitPrice ?? l.price }); }}>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>)}
                      </select>
                      {p && <div className="mt-1 font-mono text-[10px] text-slate-400">in stock: {p.qty} {p.uom} {short && <span className="text-rose-600">· exceeds stock</span>}</div>}
                    </div>
                    <div className="col-span-2">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Qty {p ? `(${p.uom})` : ""}</span>
                      <input type="number" min="0" step={step} className={`${inputCls} py-1.5`} value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <span className="mb-1 block text-[10px] font-medium uppercase text-slate-400">Rate</span>
                      <input type="number" min="0" step="1" className={`${inputCls} py-1.5`} value={l.price} onChange={(e) => updateLine(i, { price: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2 pb-2 text-right">
                      <span className="font-mono text-sm text-slate-700">{fmt(l.qty * l.price)}</span>
                    </div>
                    <div className="col-span-1 pb-1">
                      <button onClick={() => removeLine(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount %"><input type="number" min="0" max="100" className={inputCls} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></Field>
            <Field label="GST rate %" hint="Set your applicable rate"><input type="number" min="0" className={inputCls} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></Field>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <Row label="Subtotal" value={fmt(t.subtotal)} />
            {t.discountAmt > 0 && <Row label={`Discount (${discountPct}%)`} value={"− " + fmt(t.discountAmt)} />}
            <Row label="Taxable value" value={fmt(t.taxable)} />
            <Row label={`CGST (${(taxRate / 2)}%)`} value={fmt(t.cgst)} muted />
            <Row label={`SGST (${(taxRate / 2)}%)`} value={fmt(t.sgst)} muted />
            {Math.abs(t.roundOff) >= 0.005 && <Row label="Round off" value={(t.roundOff >= 0 ? "+ " : "− ") + fmt(Math.abs(t.roundOff))} muted />}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Grand total</span>
              <span className="font-mono text-lg font-semibold text-slate-900">{fmt(t.grand)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!valid} onClick={() => onSave({ customer: customer.trim() || "Walk-in", phone: phone.trim(), payment, discountPct: Number(discountPct) || 0, taxRate: Number(taxRate) || 0, lines })}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">
          <Receipt size={16} /> Generate bill
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={muted ? "text-slate-400" : "text-slate-500"}>{label}</span>
      <span className={`font-mono ${muted ? "text-slate-500" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function InvoiceView({ invoice, product, cur, shop, onClose, onSendWhatsApp }) {
  const t = invoiceTotals(invoice);
  const fmt = (n) => cur + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="no-print flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{invoice.number}</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onSendWhatsApp?.()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"><MessageCircle size={15} /> Send via WhatsApp</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"><Printer size={15} /> Print</button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        <div id="print-invoice" className="px-6 py-6 text-slate-800">
          {/* Shop header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">{shop.name}</div>
              <div className="text-xs text-slate-500">{shop.line1}</div>
              <div className="text-xs text-slate-500">{shop.city}</div>
              <div className="text-xs text-slate-500">{shop.phone}</div>
              {shop.gstin && <div className="mt-0.5 font-mono text-xs text-slate-500">GSTIN: {shop.gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-teal-700">Tax Invoice</div>
              <div className="mt-1 font-mono text-sm font-medium text-slate-800">{invoice.number}</div>
              <div className="font-mono text-xs text-slate-500">{invoice.date}</div>
            </div>
          </div>

          {/* Customer */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div>
              <span className="text-slate-400">Billed to</span>
              <div className="text-sm font-medium text-slate-800">{invoice.customer || "Walk-in"}</div>
              {invoice.phone && <div className="text-slate-500">{invoice.phone}</div>}
            </div>
            <div className="text-right">
              <span className="text-slate-400">Payment</span>
              <div className="text-sm font-medium text-slate-800">{invoice.payment}</div>
            </div>
          </div>

          {/* Lines */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="py-2 px-2 text-right font-medium">Qty</th>
                <th className="py-2 px-2 text-right font-medium">Rate</th>
                <th className="py-2 pl-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l, i) => {
                const p = product(l.productId);
                return (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-800">{p?.name ?? "—"}</div>
                      <div className="font-mono text-[11px] text-slate-400">{p?.sku}{p?.color ? " · " + p.color : ""}{p?.size && p.size !== "N/A" ? " · " + p.size : ""}</div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">{l.qty} {p?.uom}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">{fmt(l.price)}</td>
                    <td className="py-2 pl-2 text-right font-mono text-slate-800">{fmt(l.qty * l.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto mt-4 w-full max-w-xs text-sm">
            <Row label="Subtotal" value={fmt(t.subtotal)} />
            {t.discountAmt > 0 && <Row label={`Discount (${invoice.discountPct}%)`} value={"− " + fmt(t.discountAmt)} />}
            <Row label="Taxable value" value={fmt(t.taxable)} />
            <Row label={`CGST (${invoice.taxRate / 2}%)`} value={fmt(t.cgst)} muted />
            <Row label={`SGST (${invoice.taxRate / 2}%)`} value={fmt(t.sgst)} muted />
            {Math.abs(t.roundOff) >= 0.005 && <Row label="Round off" value={(t.roundOff >= 0 ? "+ " : "− ") + fmt(Math.abs(t.roundOff))} muted />}
            <div className="mt-2 flex items-center justify-between border-t-2 border-slate-800 pt-2">
              <span className="font-semibold">Grand total</span>
              <span className="font-mono text-base font-bold">{fmt(t.grand)}</span>
            </div>
          </div>

          <p className="mt-6 border-t border-slate-100 pt-3 text-center text-xs text-slate-400">Thank you for shopping with {shop.name} · Goods once sold may be exchanged within store policy.</p>
        </div>
      </div>
    </div>
  );
}

function ShopModal({ shop, onClose, onSave }) {
  const [f, setF] = useState({ ...shop });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Shop details" subtitle="Printed at the top of every invoice" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Shop name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Address line"><input className={inputCls} value={f.line1} onChange={set("line1")} /></Field>
        <Field label="City / PIN"><input className={inputCls} value={f.city} onChange={set("city")} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
          <Field label="GSTIN" hint="Optional"><input className={`${inputCls} font-mono`} value={f.gstin} onChange={set("gstin")} placeholder="09ABCDE1234F1Z5" /></Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={() => onSave(f)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Save details</button>
      </div>
    </Modal>
  );
}

/* ------------------------- Wholesale CRM ---------------------------- */

function CRM({ leads, onSave, onDelete, onTouch, onStage, onConvert, go }) {
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [openLead, setOpenLead] = useState(null);

  const active = leads.filter((l) => !["Converted", "Dropped"].includes(l.stage));
  const overdue = active.filter((l) => l.nextFollowUp && l.nextFollowUp <= today());

  const rows = leads
    .filter((l) => stageFilter === "all" || l.stage === stageFilter)
    .filter((l) => (l.name + l.contact + l.city + l.dealsIn).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.nextFollowUp || "9999") < (b.nextFollowUp || "9999") ? -1 : 1);

  const current = openLead ? leads.find((l) => l.id === openLead) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Wholesale CRM</h1>
          <p className="text-sm text-slate-500">Source new wholesalers, track every conversation, convert the good ones into suppliers</p>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
          <Plus size={16} /> Add lead
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Contact size={14} className="text-teal-700" /> Active leads</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{active.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarClock size={14} className={overdue.length ? "text-rose-600" : "text-slate-400"} /> Follow-ups due</div>
          <div className={`mt-1 font-mono text-xl font-semibold ${overdue.length ? "text-rose-600" : "text-slate-900"}`}>{overdue.length}</div>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><UserPlus size={14} className="text-emerald-600" /> Converted to suppliers</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-900">{leads.filter((l) => l.stage === "Converted").length}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, or what they deal in…" className={`${inputCls} pl-9`} />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">All stages</option>
          {LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty icon={Contact} title="No leads here" body="Add a wholesaler you met at a market, exhibition, or online, and start tracking the conversation."
          action={<button onClick={() => setEditing({})} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">Add lead</button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Wholesaler</th>
                <th className="px-4 py-3 font-medium">Deals in</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Last contact</th>
                <th className="px-4 py-3 font-medium">Next follow-up</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((l) => {
                const last = l.touches[0];
                const isOverdue = !["Converted", "Dropped"].includes(l.stage) && l.nextFollowUp && l.nextFollowUp <= today();
                return (
                  <tr key={l.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpenLead(l.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{l.name}</div>
                      <div className="text-xs text-slate-400">{l.contact} · {l.city}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate text-slate-600">{l.dealsIn}</td>
                    <td className="px-4 py-3"><Chip tone={STAGE_TONES[l.stage]}>{l.stage}</Chip></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {last ? <span><span className="font-medium text-slate-600">{last.type}</span> · <span className="font-mono">{last.date}</span></span> : <span className="text-slate-300">No contact yet</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.nextFollowUp
                        ? <span className={`font-mono text-xs ${isOverdue ? "font-semibold text-rose-600" : "text-slate-600"}`}>{l.nextFollowUp}{isOverdue && " · due"}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">Open <ChevronRight size={13} /></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <LeadModal lead={editing} onClose={() => setEditing(null)} onSave={(d) => { onSave(d); setEditing(null); }} />}
      {current && (
        <LeadDetail lead={current} onClose={() => setOpenLead(null)}
          onEdit={() => { setEditing(current); }}
          onDelete={() => { onDelete(current.id); setOpenLead(null); }}
          onTouch={(t) => onTouch(current.id, t)}
          onStage={(s) => onStage(current.id, s)}
          onConvert={() => { onConvert(current); }}
          go={go} />
      )}
    </div>
  );
}

function LeadModal({ lead, onClose, onSave }) {
  const isNew = !lead.id;
  const [f, setF] = useState({
    id: lead.id, name: lead.name || "", contact: lead.contact || "", phone: lead.phone || "", email: lead.email || "",
    city: lead.city || "", dealsIn: lead.dealsIn || "", source: lead.source || LEAD_SOURCES[0],
    stage: lead.stage || LEAD_STAGES[0], nextFollowUp: lead.nextFollowUp || "", touches: lead.touches || [],
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim();

  return (
    <Modal title={isNew ? "Add wholesale lead" : "Edit lead"} subtitle={isNew ? "A wholesaler you want to start buying from" : lead.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Business name"><input className={inputCls} value={f.name} onChange={set("name")} placeholder="Kanchipuram Silks Direct" /></Field>
        <Field label="Contact person"><input className={inputCls} value={f.contact} onChange={set("contact")} placeholder="S. Meenakshi" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} placeholder="+91 …" /></Field>
        <Field label="Email" hint="Optional"><input className={inputCls} value={f.email} onChange={set("email")} /></Field>
        <Field label="City / market"><input className={inputCls} value={f.city} onChange={set("city")} placeholder="Surat / Ludhiana / Chandni Chowk" /></Field>
        <Field label="Deals in" hint="What you'd buy from them"><input className={inputCls} value={f.dealsIn} onChange={set("dealsIn")} placeholder="Silk sarees, bridal lehengas…" /></Field>
        <Field label="Source">
          <select className={inputCls} value={f.source} onChange={set("source")}>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Stage">
          <select className={inputCls} value={f.stage} onChange={set("stage")}>{LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Next follow-up" hint="You'll get a due badge on this date"><input type="date" className={inputCls} value={f.nextFollowUp} onChange={set("nextFollowUp")} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button disabled={!valid} onClick={() => onSave(f)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">{isNew ? "Add lead" : "Save changes"}</button>
      </div>
    </Modal>
  );
}

function LeadDetail({ lead, onClose, onEdit, onDelete, onTouch, onStage, onConvert, go }) {
  const [type, setType] = useState("Call");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const converted = lead.stage === "Converted";
  const dropped = lead.stage === "Dropped";

  function submitTouch() {
    if (!note.trim()) return;
    onTouch({ type, note: note.trim(), date: today(), nextFollowUp: followUp || undefined });
    setNote(""); setFollowUp("");
  }

  return (
    <Modal title={lead.name} subtitle={`${lead.contact}${lead.city ? " · " + lead.city : ""}${lead.dealsIn ? " · " + lead.dealsIn : ""}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* header row: stage + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Stage</span>
            <select value={lead.stage} onChange={(e) => onStage(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
              {LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {!converted && !dropped && (
              <button onClick={() => { onConvert(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                <UserPlus size={14} /> Convert to supplier
              </button>
            )}
            {converted && (
              <button onClick={() => go("suppliers")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                <Check size={14} /> In supplier book — view
              </button>
            )}
            <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
          </div>
        </div>

        {/* contact strip */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          {lead.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /><span className="font-mono">{lead.phone}</span></span>}
          {lead.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} className="text-slate-400" />{lead.email}</span>}
          {lead.source && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" />{lead.source}</span>}
          {lead.nextFollowUp && !converted && !dropped && (
            <span className={`inline-flex items-center gap-1.5 ${lead.nextFollowUp <= today() ? "font-semibold text-rose-600" : ""}`}>
              <CalendarClock size={13} className={lead.nextFollowUp <= today() ? "text-rose-500" : "text-slate-400"} />
              Follow up <span className="font-mono">{lead.nextFollowUp}</span>
            </span>
          )}
        </div>

        {/* log a touch */}
        <div className="rounded-xl border border-slate-200 p-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Log contact</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} sm:col-span-1`}>
              {TOUCH_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? e.g. shared rate card, agreed sample dispatch…" className={`${inputCls} sm:col-span-3`}
              onKeyDown={(e) => e.key === "Enter" && submitTouch()} />
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <Field label="Set next follow-up (optional)"><input type="date" className={inputCls} value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></Field>
            <button onClick={submitTouch} disabled={!note.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">Log it</button>
          </div>
        </div>

        {/* timeline */}
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation history</span>
          {lead.touches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">No contact logged yet. The first call or WhatsApp goes here.</p>
          ) : (
            <ol className="space-y-0">
              {lead.touches.map((t, i) => {
                const Icon = TOUCH_ICONS[t.type] || StickyNote;
                return (
                  <li key={t.id} className="relative flex gap-3 pb-4 pl-1">
                    {i < lead.touches.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-slate-200" />}
                    <span className="relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-600/20"><Icon size={13} /></span>
                    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">{t.type}</span>
                        <span className="font-mono text-[11px] text-slate-400">{t.date}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{t.note}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
