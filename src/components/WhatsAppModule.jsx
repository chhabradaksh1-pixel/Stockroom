import React, { useMemo, useState } from "react";
import {
  MessageCircle, Users, MessagesSquare, Megaphone, FileText, Sparkles,
  BarChart3, Settings, Send, ArrowRight, Clock3, CheckCheck, AlertCircle,
  PhoneCall, Mail, CircleDashed, X
} from "lucide-react";
import { WHATSAPP_TABS, WHATSAPP_TEMPLATE_VARIABLES } from "../lib/whatsappData";

const tabIcons = {
  Overview: LayoutDashboardIcon,
  Customers: Users,
  Conversations: MessagesSquare,
  Campaigns: Megaphone,
  Templates: FileText,
  Automations: Sparkles,
  Analytics: BarChart3,
  Settings: Settings,
};

function LayoutDashboardIcon(props) {
  return <MessageCircle {...props} />;
}

function StatusChip({ status }) {
  const map = {
    Sending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    Sent: "bg-teal-50 text-teal-700 ring-teal-600/20",
    Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
    Scheduled: "bg-slate-100 text-slate-700 ring-slate-500/20",
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Draft: "bg-slate-100 text-slate-700 ring-slate-500/20",
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${map[status] || "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>
      {status}
    </span>
  );
}

function MetricCard({ label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}><MessageCircle size={16} /></span>
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function CustomerCard({ customer, onSelect }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{customer.companyName || customer.name}</div>
          <div className="mt-1 text-xs text-slate-500">{customer.customerType || "Business account"}</div>
        </div>
        <StatusChip status={customer.outstandingAmount > 0 ? "Active" : "Draft"} />
      </div>

      <dl className="mt-4 space-y-2 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-2"><dt className="text-slate-400">Primary contact</dt><dd>{customer.primaryContact || customer.name}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-slate-400">WhatsApp</dt><dd className="font-mono">{customer.whatsapp}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-slate-400">Orders</dt><dd className="font-mono">{customer.totalOrders || 0}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-slate-400">Total purchases</dt><dd className="font-mono">₹{Number(customer.totalPurchases || customer.totalAmountSpent || 0).toLocaleString()}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-slate-400">Outstanding</dt><dd className="font-mono text-amber-700">₹{Number(customer.outstandingAmount || 0).toLocaleString()}</dd></div>
      </dl>

      <button onClick={() => onSelect(customer)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
        View account <ArrowRight size={15} />
      </button>
    </div>
  );
}

function CustomerProfile({ customer, invoices = [], whatsapp = { messages: [] }, onSendInvoice }) {
  if (!customer) return null;

  const accountValue = Number(customer.totalPurchases || customer.totalAmountSpent || 0);
  const outstanding = Number(customer.outstandingAmount || 0);
  const credit = Number(customer.creditLimit || 0);

  const customerInvoices = invoices.filter((invoice) => {
    const variants = [customer.companyName, customer.name, customer.primaryContact].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    const invoiceCustomer = String(invoice.customer || "").trim().toLowerCase();
    const invoicePhone = String(invoice.phone || "").replace(/\s+/g, "");
    const customerPhone = String(customer.whatsapp || "").replace(/\s+/g, "");
    return variants.includes(invoiceCustomer) || (invoicePhone && customerPhone && invoicePhone === customerPhone);
  });

  const whatsappEvents = (whatsapp.messages || []).filter((message) => {
    const company = String(message.companyName || message.customerName || "").trim().toLowerCase();
    const customerName = String(customer.companyName || customer.name || "").trim().toLowerCase();
    const primaryContact = String(customer.primaryContact || "").trim().toLowerCase();
    return company === customerName || company === primaryContact || (message.customerPhone && message.customerPhone === customer.whatsapp);
  });

  const timelineEntries = [...(customer.timeline || []).filter((entry) => !String(entry.event || "").toLowerCase().includes("via whatsapp") && !String(entry.type || "").toLowerCase().includes("whatsapp")), ...whatsappEvents.map((message) => ({
    id: `wa_event_${message.id}`,
    date: String(message.createdAt || "").slice(0, 10),
    time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    event: message.eventText || `Invoice ${message.invoiceNumber || message.orderNumber || "—"} sent via WhatsApp`,
    type: "WhatsApp",
  }))].sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")).getTime() - new Date(a.date + "T" + (a.time || "00:00")).getTime());

  const totalInvoiceValue = customerInvoices.reduce((sum, invoice) => sum + invoice.lines.reduce((lineTotal, line) => lineTotal + (Number(line.qty) || 0) * (Number(line.price) || 0), 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Business account</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{customer.companyName || customer.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{customer.primaryContact || "Primary contact not specified"}</p>
        </div>
        <StatusChip status={customer.customerType || "Business account"} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="text-slate-400">Total orders</div>
          <div className="mt-1 font-mono text-slate-700">{customer.totalOrders || customerInvoices.length || 0}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="text-slate-400">Total purchase value</div>
          <div className="mt-1 font-mono text-slate-700">₹{Number(accountValue || totalInvoiceValue || 0).toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="text-slate-400">Outstanding</div>
          <div className="mt-1 font-mono text-amber-700">₹{outstanding.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="text-slate-400">Payment terms</div>
          <div className="mt-1 text-slate-700">{customer.paymentTerms || "Net 30"}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Account overview</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-400">Primary contact</div>
              <div className="mt-1 text-slate-700">{customer.primaryContact || customer.name}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-400">WhatsApp</div>
              <div className="mt-1 font-mono text-slate-700">{customer.whatsapp}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-400">Email</div>
              <div className="mt-1 text-slate-700">{customer.email || "Not provided"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-400">Last order</div>
              <div className="mt-1 font-mono text-slate-700">{customer.lastOrderDate || customerInvoices[0]?.date || "—"}</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900">Account insights</h4>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-400">Avg order value</div>
              <div className="mt-1 font-mono text-slate-800">₹{Number(customer.averageOrderValue || (customerInvoices.length ? totalInvoiceValue / customerInvoices.length : 0) || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-400">Credit limit</div>
              <div className="mt-1 font-mono text-slate-800">₹{credit.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-400">Notes</div>
              <div className="mt-1 text-slate-700">{customer.accountNotes || "No notes recorded."}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-900">Customer timeline</h4>
        <div className="mt-3 space-y-3">
          {timelineEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No timeline events yet.</div>
          ) : timelineEntries.map((entry) => (
            <div key={entry.id} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-wide text-slate-400">{entry.date}{entry.time ? ` · ${entry.time}` : ""}</div>
                <div className="mt-1 text-sm text-slate-700">{entry.event}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-900">Order history</h4>
        <div className="mt-3 space-y-3">
          {customerInvoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No orders or invoices are currently linked for this account.</div>
          ) : customerInvoices.map((invoice) => {
            const itemCount = (invoice.lines || []).reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
            const total = (invoice.lines || []).reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0);
            const productSummary = (invoice.lines || []).map((line) => `${line.qty} × ${line.productId || "Item"}`).join(", ");
            return (
              <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{invoice.number}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{invoice.date}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={invoice.payment ? "Delivered" : "Open"} />
                    <StatusChip status={invoice.number ? "Invoice available" : "No invoice"} />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-slate-400">Products / items</div>
                    <div className="mt-1 text-slate-700">{productSummary || "—"}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-slate-400">Quantity</div>
                    <div className="mt-1 font-mono text-slate-700">{itemCount}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-slate-400">Total</div>
                    <div className="mt-1 font-mono text-slate-700">₹{Number(total || 0).toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-slate-400">Invoice status</div>
                    <div className="mt-1 text-slate-700">{invoice.number ? "Available" : "Not created"}</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button onClick={() => onSendInvoice?.(invoice, customer)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    <Send size={15} /> Send Invoice via WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({ analytics, messages, campaigns, customers }) {
  const recentMessages = messages.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Messages sent" value={analytics.messagesSent} hint="Outbound B2B customer updates" tone="teal" />
        <MetricCard label="Invoices sent" value={analytics.invoicesSent || 296} hint="Invoice delivery messages" tone="emerald" />
        <MetricCard label="Payment reminders" value={analytics.paymentReminders || 108} hint="Due/overdue reminders" tone="amber" />
        <MetricCard label="Failed" value={analytics.failed} hint="Message delivery issues" tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent B2B account activity</h3>
            <button className="text-xs font-medium text-teal-700 hover:underline">View all</button>
          </div>
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <div key={message.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div>
                  <div className="font-medium text-slate-800">{message.companyName || message.customerName}</div>
                  <div className="font-mono text-[11px] text-slate-500">{message.orderNumber}</div>
                </div>
                <div className="text-right">
                  <StatusChip status={message.status} />
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{new Date(message.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">B2B campaigns</h3>
          <div className="mt-4 space-y-3">
            {campaigns.slice(0, 3).map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-800">{campaign.name}</div>
                  <StatusChip status={campaign.status} />
                </div>
                <div className="mt-2 text-xs text-slate-500">{campaign.type} · {campaign.audience}</div>
                <div className="mt-2 font-mono text-xs text-slate-600">{campaign.sent} sent · {campaign.engagement}% engagement</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><PhoneCall size={15} className="text-teal-700" /> Business accounts</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900">{customers.length}</div>
          <p className="mt-1 text-xs text-slate-400">Accounts ready for order, invoice and payment WhatsApp flows</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Send size={15} className="text-amber-600" /> Campaign engagement</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900">{analytics.campaignEngagement}%</div>
          <p className="mt-1 text-xs text-slate-400">Average engagement on account communication campaigns</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CheckCheck size={15} className="text-emerald-600" /> account engagement</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-slate-900">{analytics.customerEngagement}%</div>
          <p className="mt-1 text-xs text-slate-400">Active response rate from business customers</p>
        </div>
      </div>
    </div>
  );
}

function CustomersPanel({ customers, invoices, whatsapp, onSelect, onSendInvoice }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(customers[0] || null);

  const rows = useMemo(() => {
    return customers.filter((customer) => {
      const haystack = `${customer.companyName || customer.name} ${customer.primaryContact || ""} ${customer.whatsapp || ""} ${customer.email || ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [customers, query]);

  const current = selected && rows.some((customer) => customer.id === selected.id) ? selected : rows[0] || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Customers</h3>
          <p className="text-sm text-slate-500">{customers.length} business accounts linked to StockRoom orders and invoices</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search business account or phone…" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <div className="grid gap-4">
          {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">No customer matches.</div> : rows.map((customer) => <CustomerCard key={customer.id} customer={customer} onSelect={(item) => { setSelected(item); onSelect(item); }} />)}
        </div>
        <CustomerProfile customer={current} invoices={invoices} whatsapp={whatsapp} onSendInvoice={onSendInvoice} />
      </div>
    </div>
  );
}

function ConversationsPanel({ whatsapp }) {
  const messages = whatsapp?.messages || [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Conversations</h3>
        <p className="mt-1 text-sm text-slate-500">A single feed of StockRoom customer invoice events and WhatsApp messages.</p>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 text-center">No WhatsApp events yet.</div>
        ) : messages.map((message) => (
          <div key={message.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="font-medium text-slate-800">{message.companyName || message.customerName}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{message.invoiceNumber || message.orderNumber || "Order"}</div>
            </div>
            <div className="text-right">
              <StatusChip status={message.status || "Sent"} />
              <div className="mt-1 font-mono text-[10px] text-slate-400">{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatesPanel() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">B2B WhatsApp templates</h3>
        <p className="mt-1 text-sm text-slate-500">Reusable templates for invoices, payment reminders, order status, reorder prompts, and business updates.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {WHATSAPP_TEMPLATE_VARIABLES.map((variable) => (
          <div key={variable} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{variable}</div>
        ))}
      </div>

      <div className="space-y-3">
        {["Invoice delivery", "Payment reminder", "Reorder reminder", "Order status update"].map((template) => (
          <div key={template} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-800">{template}</div>
              <StatusChip status="Active" />
            </div>
            <p className="mt-2 text-sm text-slate-500">Hi {{contact_name}}, your invoice from {{company_name}} is ready. Invoice {{invoice_number}} of ₹{{invoice_amount}} is due on {{due_date}}.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">WhatsApp setup</h3>
        <p className="mt-1 text-sm text-slate-500">Frontend-ready configuration for a secure backend integration later.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Connection status</div>
          <div className="mt-2 flex items-center gap-2">
            <StatusChip status={settings.connected ? "Active" : "Draft"} />
            <span className="font-mono text-sm text-slate-700">{settings.connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Business account</div>
          <div className="mt-2 font-mono text-sm text-slate-700">{settings.businessName}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone Number ID</div>
          <div className="mt-2 font-mono text-sm text-slate-400">{settings.phoneNumberId || "Not configured"}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Business Account ID</div>
          <div className="mt-2 font-mono text-sm text-slate-400">{settings.businessAccountId || "Not configured"}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        The frontend intentionally avoids storing real tokens or secrets here. This keeps the UI ready for secure server-side setup through a backend or environment-based secrets manager. 
      </div>
    </div>
  );
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function resolveTemplateVariables(template, values) {
  return Object.entries(values).reduce((acc, [key, value]) => {
    const token = `{{${key}}}`;
    return acc.replaceAll(token, String(value ?? ""));
  }, template);
}

export function WhatsAppModule({ customers, invoices, whatsapp, shop, products, onSelectCustomer, onSendInvoice }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0] || null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const storeName = shop?.name || whatsapp?.settings?.businessName || "Rudrani Collection";

  const metrics = useMemo(() => ({
    messagesSent: whatsapp?.analytics?.messagesSent ?? 0,
    delivered: whatsapp?.analytics?.delivered ?? 0,
    read: whatsapp?.analytics?.read ?? 0,
    failed: whatsapp?.analytics?.failed ?? 0,
    campaignEngagement: whatsapp?.analytics?.campaignEngagement ?? 0,
    customerEngagement: whatsapp?.analytics?.customerEngagement ?? 0,
  }), [whatsapp]);

  const panelProps = {
    analytics: metrics,
    messages: whatsapp?.messages ?? [],
    campaigns: whatsapp?.campaigns ?? [],
    customers,
    invoices,
    onSelect: (customer) => {
      setSelectedCustomer(customer);
      if (onSelectCustomer) onSelectCustomer(customer);
    },
  };

  const renderPanel = () => {
    switch (activeTab) {
      case "Overview":
        return <OverviewPanel {...panelProps} />;
      case "Customers":
        return <CustomersPanel customers={customers} invoices={invoices} whatsapp={whatsapp} onSelect={panelProps.onSelect} onSendInvoice={(invoice, customer) => {
          setInvoicePreview({ invoice, customer });
        }} />;
      case "Conversations":
        return <ConversationsPanel whatsapp={whatsapp} />;
      case "Campaigns":
        return <PlaceholderPanel title="Campaigns" subtitle="Plan, preview, schedule, and monitor customer campaigns in this workspace." icon={Megaphone} />;
      case "Templates":
        return <TemplatesPanel />;
      case "Automations":
        return <PlaceholderPanel title="Automations" subtitle="Repeat-customer rules and event triggers for thank-yous, reengagement, and invoice follow-ups." icon={Sparkles} />;
      case "Analytics":
        return <PlaceholderPanel title="Analytics" subtitle="Detailed channel performance, open rates, and campaign tracking will live here." icon={BarChart3} />;
      case "Settings":
        return <SettingsPanel settings={whatsapp?.settings ?? {}} />;
      default:
        return <OverviewPanel {...panelProps} />;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">WhatsApp</h1>
          <p className="text-sm text-slate-500">Business customer communication for order updates, invoices, payment follow-ups, and reorder prompts.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <nav className="flex min-w-max gap-2">
          {WHATSAPP_TABS.map((tab) => {
            const Icon = tabIcons[tab] || MessageCircle;
            const active = sameTab(tab, activeTab);
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon size={15} /> {tab}
              </button>
            );
          })}
        </nav>
      </div>

      {renderPanel()}

      {invoicePreview && (() => {
        const invoice = invoicePreview.invoice;
        const customer = invoicePreview.customer;
        const contactName = String(customer?.primaryContact || customer?.name || "Customer").trim();
        const firstName = contactName.split(/\s+/)[0] || "Customer";
        const invoiceNumber = invoice?.number || "—";
        const invoiceAmount = Number((invoice?.lines || []).reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0));
        const invoiceDate = formatDisplayDate(invoice?.date || "");
        const dueDate = invoice?.dueDate ? formatDisplayDate(invoice.dueDate) : "";
        const paymentTerms = invoice?.paymentTerms || customer?.paymentTerms || "";
        const businessName = storeName;
        const resolvedMessage = resolveTemplateVariables(
          "Hi {{contact_name}},\n\nYour invoice from {{business_name}} is ready.\n\nInvoice: {{invoice_number}}\nAmount: ₹{{invoice_amount}}\n{{due_date_line}}\nYour invoice is attached below.\n\nThank you for your business,\n{{business_name}}",
          {
            contact_name: firstName,
            invoice_number: invoiceNumber,
            business_name: businessName,
            invoice_amount: invoiceAmount.toLocaleString(),
            due_date_line: dueDate ? `Due date: ${dueDate}\n` : paymentTerms ? `Due date: ${paymentTerms}\n` : "",
          },
        ).replace(/\n{3,}/g, "\n\n").trim();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Send Invoice via WhatsApp</div>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{businessName}</h3>
                </div>
                <button onClick={() => setInvoicePreview(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-700">Invoice {invoiceNumber}</div>
                <div className="mt-2 text-sm text-slate-600">Amount: ₹{invoiceAmount.toLocaleString()}</div>
                {invoiceDate && <div className="mt-1 text-sm text-slate-600">Invoice date: {invoiceDate}</div>}
                {dueDate && <div className="mt-1 text-sm text-slate-600">Due date: {dueDate}</div>}
                {!dueDate && !paymentTerms && (
                  <div className="mt-2 text-xs text-amber-700">No due-date/payment-term data is stored for this invoice yet. This data needs to be added to the invoice/customer model.</div>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">PDF</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{invoiceNumber}.pdf</div>
                    <div className="text-xs text-slate-500">Invoice</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Message preview</div>
                <div className="whitespace-pre-line rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">{resolvedMessage}</div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setInvoicePreview(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => {
                  setSendingInvoiceId(invoice?.id || "");
                  onSendInvoice?.(invoice, customer);
                  window.setTimeout(() => setSendingInvoiceId(null), 1200);
                }} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
                  <Send size={15} /> {sendingInvoiceId === (invoice?.id || "") ? "Sending..." : "Send via WhatsApp"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function sameTab(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}
