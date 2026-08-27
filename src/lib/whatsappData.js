export const WHATSAPP_TABS = [
  "Overview",
  "Customers",
  "Conversations",
  "Campaigns",
  "Templates",
  "Automations",
  "Analytics",
  "Settings",
];

export const CUSTOMER_SEGMENTS = [
  { id: "all", label: "All business customers" },
  { id: "new", label: "New accounts" },
  { id: "repeat", label: "Repeat accounts" },
  { id: "high-value", label: "High-value accounts" },
  { id: "high-volume", label: "High-volume buyers" },
  { id: "outstanding", label: "Customers with outstanding payments" },
  { id: "overdue", label: "Overdue accounts" },
  { id: "inactive-30", label: "No order in 30 days" },
  { id: "inactive-60", label: "No order in 60 days" },
  { id: "inactive-90", label: "No order in 90 days" },
  { id: "product", label: "Frequently buys a specific product" },
];

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "{{contact_name}}",
  "{{company_name}}",
  "{{invoice_number}}",
  "{{invoice_amount}}",
  "{{due_date}}",
  "{{order_number}}",
  "{{order_total}}",
  "{{product_name}}",
  "{{discount}}",
  "{{store_name}}",
  "{{invoice_link}}",
];

export const WHATSAPP_TEMPLATES = [
  {
    id: "tpl_invoice",
    name: "Invoice delivery",
    category: "Transactional",
    content: "Hi {{contact_name}},\n\nYour invoice from {{company_name}} is ready.\n\nInvoice: {{invoice_number}}\nAmount: ₹{{invoice_amount}}\nDue date: {{due_date}}\n\n[View Invoice]",
    variables: ["{{contact_name}}", "{{company_name}}", "{{invoice_number}}", "{{invoice_amount}}", "{{due_date}}"],
  },
  {
    id: "tpl_payment_reminder",
    name: "Payment reminder",
    category: "Collections",
    content: "Hi {{contact_name}},\n\nThis is a reminder that Invoice {{invoice_number}} for ₹{{invoice_amount}} is due on {{due_date}}.\n\nPlease confirm payment or let us know if you need a revised statement.",
    variables: ["{{contact_name}}", "{{invoice_number}}", "{{invoice_amount}}", "{{due_date}}"],
  },
  {
    id: "tpl_reorder",
    name: "Reorder reminder",
    category: "Reorder",
    content: "Hi {{contact_name}},\n\nYou usually reorder {{product_name}} around this time. We can prepare your next order for dispatch.\n\nWould you like us to send a fresh quote?",
    variables: ["{{contact_name}}", "{{product_name}}"],
  },
  {
    id: "tpl_order_status",
    name: "Order status update",
    category: "Operations",
    content: "Hi {{contact_name}},\n\nOrder {{order_number}} has been dispatched. Please expect delivery updates from our logistics team.\n\nThank you for your business.",
    variables: ["{{contact_name}}", "{{order_number}}"],
  },
];

export const seedCustomers = [
  {
    id: "cust_1",
    companyName: "Aurum Retail Pvt. Ltd.",
    name: "Aurum Retail Pvt. Ltd.",
    primaryContact: "Priya Sharma",
    contactPersons: ["Priya Sharma", "Rohan Mehta"],
    whatsapp: "+91 98765 43210",
    email: "accounts@aurumretail.in",
    gstin: "27AABCA1234F1Z5",
    billingAddress: "14 Market Lane, Mumbai 400001",
    shippingAddress: "14 Market Lane, Mumbai 400001",
    customerType: "Retailer",
    paymentTerms: "Net 30",
    creditLimit: 150000,
    outstandingAmount: 46500,
    totalPurchases: 40982,
    totalOrders: 2,
    averageOrderValue: 20491,
    lastOrderDate: "2026-08-15",
    frequentlyPurchasedProducts: ["Bridal Lehenga — Zardozi", "Banarasi Silk Saree"],
    accountNotes: "Valued account; prefers WhatsApp for invoices and dispatch updates.",
    segment: "repeat",
    purchaseHistory: [
      { id: "ord_1", orderNumber: "INV-0001", date: "2026-08-15", amount: 21999, status: "Delivered", product: "Bridal Lehenga — Zardozi", type: "Invoice" },
      { id: "ord_2", orderNumber: "INV-0020", date: "2026-08-05", amount: 18983, status: "Paid", product: "Banarasi Silk Saree", type: "Invoice" },
    ],
    timeline: [
      { id: "tl_1", date: "2026-08-24", event: "Invoice INV-1024 sent via WhatsApp", type: "Invoice" },
      { id: "tl_2", date: "2026-08-22", event: "Order #1042 confirmed", type: "Order" },
      { id: "tl_3", date: "2026-08-15", event: "Payment received — ₹45,000", type: "Payment" },
      { id: "tl_4", date: "2026-08-12", event: "Quotation QT-182 sent", type: "Quotation" },
    ],
  },
  {
    id: "cust_2",
    companyName: "Veda Boutique Co.",
    name: "Veda Boutique Co.",
    primaryContact: "Ananya Iyer",
    contactPersons: ["Ananya Iyer"],
    whatsapp: "+91 98100 25376",
    email: "ops@vedaboutique.co",
    gstin: "29ABCDE1234F1Z0",
    billingAddress: "22 Regent Street, Bengaluru 560001",
    shippingAddress: "22 Regent Street, Bengaluru 560001",
    customerType: "Dealer",
    paymentTerms: "Advance",
    creditLimit: 80000,
    outstandingAmount: 0,
    totalPurchases: 6499,
    totalOrders: 1,
    averageOrderValue: 6499,
    lastOrderDate: "2026-08-09",
    frequentlyPurchasedProducts: ["Anarkali Gown — Sequin"],
    accountNotes: "New account onboarding flow; first order delivered successfully.",
    segment: "new",
    purchaseHistory: [
      { id: "ord_3", orderNumber: "INV-0018", date: "2026-08-09", amount: 6499, status: "Delivered", product: "Anarkali Gown — Sequin", type: "Invoice" },
    ],
    timeline: [
      { id: "tl_5", date: "2026-08-09", event: "Order confirmed and invoice sent", type: "Order" },
      { id: "tl_6", date: "2026-08-09", event: "WhatsApp confirmation sent", type: "WhatsApp" },
    ],
  },
  {
    id: "cust_3",
    companyName: "Northline Distributors",
    name: "Northline Distributors",
    primaryContact: "Kavya Nair",
    contactPersons: ["Kavya Nair", "Sameer Jain"],
    whatsapp: "+91 99887 44567",
    email: "procurement@northline.in",
    gstin: "19AAACN1122C1Z8",
    billingAddress: "8 Industrial Park, Kolkata 700010",
    shippingAddress: "8 Industrial Park, Kolkata 700010",
    customerType: "Distributor",
    paymentTerms: "Net 45",
    creditLimit: 300000,
    outstandingAmount: 125000,
    totalPurchases: 68450,
    totalOrders: 5,
    averageOrderValue: 13690,
    lastOrderDate: "2026-07-22",
    frequentlyPurchasedProducts: ["Micro Velvet Fabric", "Raw Silk Fabric", "Bridal Lehenga — Zardozi"],
    accountNotes: "High-volume purchase history. Needs proactive payment reminders and reorder notifications.",
    segment: "high-volume",
    purchaseHistory: [
      { id: "ord_4", orderNumber: "INV-0007", date: "2026-07-22", amount: 24800, status: "Shipped", product: "Micro Velvet Fabric", type: "Order" },
      { id: "ord_5", orderNumber: "INV-0006", date: "2026-06-11", amount: 19650, status: "Paid", product: "Bridal Lehenga — Zardozi", type: "Invoice" },
      { id: "ord_6", orderNumber: "INV-0005", date: "2026-05-28", amount: 24000, status: "Paid", product: "Raw Silk Fabric", type: "Invoice" },
    ],
    timeline: [
      { id: "tl_7", date: "2026-08-24", event: "Payment reminder sent for overdue invoice", type: "Reminder" },
      { id: "tl_8", date: "2026-07-22", event: "Order shipped — dispatch update sent on WhatsApp", type: "Delivery" },
    ],
  },
  {
    id: "cust_4",
    companyName: "Sundar Stores",
    name: "Sundar Stores",
    primaryContact: "Rohit Menon",
    contactPersons: ["Rohit Menon", "Nisha Verma"],
    whatsapp: "+91 97395 70001",
    email: "billing@sundarstores.in",
    gstin: "03AABCS5555F1Z2",
    billingAddress: "B-12 City Market, Jaipur 302001",
    shippingAddress: "B-12 City Market, Jaipur 302001",
    customerType: "Retailer",
    paymentTerms: "Net 15",
    creditLimit: 120000,
    outstandingAmount: 98000,
    totalPurchases: 21980,
    totalOrders: 3,
    averageOrderValue: 7327,
    lastOrderDate: "2026-06-15",
    frequentlyPurchasedProducts: ["Banarasi Silk Saree", "Zari Border Roll (9m)"],
    accountNotes: "Account inactive for 90 days; reorder reminder recommended.",
    segment: "inactive-90",
    purchaseHistory: [
      { id: "ord_7", orderNumber: "INV-0010", date: "2026-06-15", amount: 12980, status: "Paid", product: "Banarasi Silk Saree", type: "Invoice" },
      { id: "ord_8", orderNumber: "INV-0009", date: "2026-05-19", amount: 9000, status: "Paid", product: "Zari Border Roll (9m)", type: "Invoice" },
    ],
    timeline: [
      { id: "tl_9", date: "2026-08-24", event: "Reorder reminder recommended — customer inactive 90 days", type: "Reorder" },
      { id: "tl_10", date: "2026-06-15", event: "Invoice delivered via WhatsApp", type: "Invoice" },
    ],
  },
];

export function getDefaultWhatsAppState() {
  return {
    messages: [
      { id: "wa_msg_1", companyName: "Aurum Retail Pvt. Ltd.", customerName: "Priya Sharma", customerPhone: "+91 98765 43210", orderNumber: "INV-0001", status: "Delivered", template: "Invoice delivery", createdAt: "2026-08-15T11:10:00" },
      { id: "wa_msg_2", companyName: "Veda Boutique Co.", customerName: "Ananya Iyer", customerPhone: "+91 98100 25376", orderNumber: "INV-0018", status: "Sent", template: "Order confirmation", createdAt: "2026-08-09T09:15:00" },
      { id: "wa_msg_3", companyName: "Northline Distributors", customerName: "Kavya Nair", customerPhone: "+91 99887 44567", orderNumber: "INV-0006", status: "Failed", template: "Payment reminder", createdAt: "2026-07-22T13:40:00" },
    ],
    campaigns: [
      { id: "cmp_1", name: "August Bulk Purchase Offer", type: "Bulk pricing", audience: "High-volume buyers", status: "Scheduled", sent: 82, engagement: 24, scheduledFor: "2026-08-27" },
      { id: "cmp_2", name: "New Product Catalogue", type: "New stock available", audience: "All business customers", status: "Sent", sent: 314, engagement: 41, scheduledFor: "2026-08-20" },
      { id: "cmp_3", name: "Reorder reminder", type: "Reorder", audience: "Inactive 60 days", status: "Draft", sent: 0, engagement: 0, scheduledFor: "2026-08-30" },
    ],
    templates: WHATSAPP_TEMPLATES,
    automations: [
      { id: "aut_1", name: "Invoice due soon", trigger: "Invoice due in 3 days", action: "Send payment reminder via WhatsApp", enabled: true },
      { id: "aut_2", name: "Order dispatched", trigger: "Order marked dispatched", action: "Send dispatch update via WhatsApp", enabled: true },
      { id: "aut_3", name: "Reorder reminder", trigger: "Customer inactive for 30 days", action: "Send reorder prompt", enabled: true },
      { id: "aut_4", name: "Payment confirmation", trigger: "Payment received", action: "Send payment acknowledgment", enabled: false },
    ],
    analytics: {
      messagesSent: 642,
      delivered: 589,
      read: 416,
      failed: 24,
      campaignsSent: 11,
      campaignEngagement: 31,
      customerEngagement: 48,
      paymentReminders: 108,
      invoicesSent: 296,
      ordersConfirmed: 84,
    },
    settings: {
      businessName: "Rudrani Collection",
      connected: false,
      phoneNumberId: "",
      businessAccountId: "",
      accessToken: "",
      webhookEnabled: false,
      apiMode: "sandbox",
    },
    customerSegments: CUSTOMER_SEGMENTS,
  };
}

function normalizeCustomerName(name) {
  return String(name || "").trim().toLowerCase();
}

export function syncCustomersFromInvoices(invoiceList, existingCustomers = []) {
  const byName = new Map();

  existingCustomers.forEach((customer) => {
    const key = normalizeCustomerName(customer.companyName || customer.name || "");
    byName.set(key, {
      ...customer,
      purchaseHistory: Array.isArray(customer.purchaseHistory) ? customer.purchaseHistory : [],
      timeline: Array.isArray(customer.timeline) ? customer.timeline : [],
    });
  });

  invoiceList.forEach((invoice) => {
    const businessName = String(invoice.customer || "Walk-in").trim() || "Walk-in";
    const key = normalizeCustomerName(businessName);
    const previous = byName.get(key);
    const amount = Number(invoiceTotals(invoice).grand || 0);

    if (!previous) {
      byName.set(key, {
        id: `cust_${Math.random().toString(36).slice(2, 8)}`,
        companyName: businessName,
        name: businessName,
        primaryContact: String(invoice.customer || "Walk-in").trim() || "Walk-in",
        contactPersons: [String(invoice.customer || "Walk-in").trim() || "Walk-in"],
        whatsapp: invoice.phone || "",
        email: "",
        gstin: "",
        billingAddress: "",
        shippingAddress: "",
        customerType: "Retailer",
        paymentTerms: "Net 30",
        creditLimit: 100000,
        outstandingAmount: 0,
        totalPurchases: amount,
        totalOrders: 1,
        averageOrderValue: amount,
        lastOrderDate: invoice.date,
        frequentlyPurchasedProducts: invoice.lines?.map((line) => line.productId || "Order") || ["Order"],
        accountNotes: "Created from invoice history; ready for B2B WhatsApp follow-up.",
        segment: "new",
        purchaseHistory: [{
          id: `ord_${Math.random().toString(36).slice(2, 8)}`,
          orderNumber: invoice.number,
          date: invoice.date,
          amount,
          status: "Delivered",
          product: invoice.lines?.[0]?.productId || "Order",
          type: "Invoice",
        }],
        timeline: [{
          id: `tl_${Math.random().toString(36).slice(2, 8)}`,
          date: invoice.date,
          event: `Invoice ${invoice.number} generated and ready for WhatsApp delivery`,
          type: "Invoice",
        }],
      });
      return;
    }

    const purchaseEntry = {
      id: `ord_${Math.random().toString(36).slice(2, 8)}`,
      orderNumber: invoice.number,
      date: invoice.date,
      amount,
      status: "Delivered",
      product: invoice.lines?.[0]?.productId || previous.purchaseHistory?.[0]?.product || "Order",
      type: "Invoice",
    };

    const nextTotalOrders = (Number(previous.totalOrders) || 0) + 1;
    const nextTotalPurchases = (Number(previous.totalPurchases) || 0) + amount;

    byName.set(key, {
      ...previous,
      companyName: previous.companyName || businessName,
      name: previous.name || businessName,
      primaryContact: previous.primaryContact || String(invoice.customer || "Walk-in").trim() || "Walk-in",
      whatsapp: previous.whatsapp || invoice.phone || "",
      totalOrders: nextTotalOrders,
      totalPurchases: nextTotalPurchases,
      averageOrderValue: Math.round(nextTotalPurchases / nextTotalOrders),
      lastOrderDate: invoice.date,
      customerType: nextTotalOrders > 1 ? "Repeat account" : "New account",
      segment: nextTotalOrders > 1 ? "repeat" : "new",
      purchaseHistory: [purchaseEntry, ...(previous.purchaseHistory || [])].slice(0, 6),
      timeline: [{
        id: `tl_${Math.random().toString(36).slice(2, 8)}`,
        date: invoice.date,
        event: `Invoice ${invoice.number} generated and sent to account`,
        type: "Invoice",
      }, ...(previous.timeline || [])].slice(0, 6),
    });
  });

  return Array.from(byName.values()).sort((a, b) => (a.companyName || a.name).localeCompare(b.companyName || b.name));
}

function invoiceTotals(inv) {
  const subtotal = (inv.lines || []).reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0);
  const discountAmt = subtotal * ((Number(inv.discountPct) || 0) / 100);
  const taxable = subtotal - discountAmt;
  const gst = taxable * ((Number(inv.taxRate) || 0) / 100);
  return { subtotal, discountAmt, taxable, gst, grand: Math.round(taxable + gst) };
}
