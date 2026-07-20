/* Paradise Lawn Care Invoice App - Version 1.2 Development */

const STORAGE_KEY = "paradise_invoices_v1_2";
const LAST_MONTH_KEY = "pl_last_month";
const JOB_SEQUENCE_KEY = "pl_job_sequence";
const maxServiceRows = 20;
const startingServiceRows = 5;

let serviceRowCount = 0;
let activeInvoiceId = null;

function byId(id) {
  return document.getElementById(id);
}

function cleanMoney(value) {
  return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function formatMoney(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function normalizeService(value) {
  const service = String(value || "Select");
  return ["Mow", "Weed Eat", "Edge", "Blow"].includes(service) ? "Full Service" : service;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}/${parts[0].slice(-2)}`;
}

function getMonthCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return yy + mm;
}

function generateJobNumber() {
  const monthCode = getMonthCode();
  const savedMonth = localStorage.getItem(LAST_MONTH_KEY);
  let sequence = Number(localStorage.getItem(JOB_SEQUENCE_KEY)) || 0;

  if (savedMonth !== monthCode) sequence = 0;

  sequence += 1;
  localStorage.setItem(LAST_MONTH_KEY, monthCode);
  localStorage.setItem(JOB_SEQUENCE_KEY, String(sequence));

  return `PL-${monthCode}-${String(sequence).padStart(5, "0")}`;
}

function getSavedInvoices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to read saved invoices:", error);
    return [];
  }
}

function storeInvoices(invoices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

function createServiceRow(data = {}) {
  if (serviceRowCount >= maxServiceRows) {
    alert("Maximum of 20 service lines reached.");
    return;
  }

  serviceRowCount += 1;
  const row = document.createElement("div");
  row.className = "service-row";
  row.innerHTML = `
    <input type="date" class="service-date" aria-label="Service date">
    <input type="text" class="service-address" placeholder="Service Address" aria-label="Service address">
    <select class="service-select" aria-label="Service performed">
      <option>Select</option>
      <option>Full Service</option>
      <option>Hedge Trim</option>
      <option>Debris Removal</option>
      <option>Land Clearing</option>
    </select>
    <input class="amount" type="text" inputmode="decimal" placeholder="$0.00" aria-label="Service amount">
  `;

  byId("serviceRows").appendChild(row);

  row.querySelector(".service-date").value = data.date || "";
  row.querySelector(".service-address").value = data.address || "";
  row.querySelector(".service-select").value = normalizeService(data.service);
  row.querySelector(".amount").value = data.amount ? formatMoney(data.amount) : "";

  const amountField = row.querySelector(".amount");
  amountField.addEventListener("input", calculateTotals);
  amountField.addEventListener("blur", () => formatAmountField(amountField));
}

function addServiceRow() {
  createServiceRow();
}

function resetServiceRows(rows = []) {
  byId("serviceRows").innerHTML = "";
  serviceRowCount = 0;

  const minimumRows = Math.max(startingServiceRows, rows.length);
  for (let index = 0; index < minimumRows; index += 1) {
    createServiceRow(rows[index] || {});
  }
}

function calculateTotals() {
  let subtotal = 0;
  document.querySelectorAll(".amount").forEach((field) => {
    subtotal += cleanMoney(field.value);
  });

  const taxRate = Number(byId("taxRate").value);
  const paymentRate = Number(byId("paymentMethod").value);
  const taxedTotal = subtotal + subtotal * taxRate;
  const cardFee = taxedTotal * paymentRate;
  const total = taxedTotal + cardFee;

  byId("subtotal").textContent = formatMoney(subtotal);
  byId("total").textContent = formatMoney(total);
  return { subtotal, total };
}

function formatAmountField(field) {
  const value = cleanMoney(field.value);
  field.value = value > 0 ? formatMoney(value) : "";
  calculateTotals();
}

function collectServiceRows() {
  return Array.from(document.querySelectorAll(".service-row"))
    .map((row) => ({
      date: row.querySelector(".service-date").value,
      address: row.querySelector(".service-address").value.trim(),
      service: row.querySelector(".service-select").value,
      amount: cleanMoney(row.querySelector(".amount").value)
    }))
    .filter((row) => row.date || row.address || row.service !== "Select" || row.amount > 0);
}

function collectInvoice() {
  const totals = calculateTotals();
  const paymentSelect = byId("paymentMethod");
  const taxSelect = byId("taxRate");

  return {
    id: activeInvoiceId || crypto.randomUUID(),
    jobNumber: byId("jobNumber").value,
    invoiceDate: byId("todayDate").value,
    dueDate: byId("dueDate").value,
    businessName: byId("businessName").value.trim(),
    clientName: byId("clientName").value.trim(),
    billingAddress: byId("billingAddress").value.trim(),
    cityStateZip: byId("cityStateZip").value.trim(),
    phone: byId("phone").value.trim(),
    email: byId("email").value.trim(),
    services: collectServiceRows(),
    taxRate: taxSelect.value,
    taxLabel: taxSelect.options[taxSelect.selectedIndex].text,
    paymentRate: paymentSelect.value,
    paymentMethod: paymentSelect.options[paymentSelect.selectedIndex].text,
    notes: byId("notes").value.trim(),
    subtotal: totals.subtotal,
    total: totals.total,
    isDemo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function persistInvoice(showConfirmation = true) {
  const invoice = collectInvoice();
  if (!invoice.clientName && !invoice.businessName) {
    alert("Please enter a client name or business name before saving.");
    return null;
  }

  const invoices = getSavedInvoices();
  const existingIndex = invoices.findIndex((item) => item.id === invoice.id || item.jobNumber === invoice.jobNumber);

  if (existingIndex >= 0) {
    invoice.id = invoices[existingIndex].id;
    invoice.createdAt = invoices[existingIndex].createdAt || invoice.createdAt;
    invoice.isDemo = Boolean(invoices[existingIndex].isDemo);
    invoices[existingIndex] = invoice;
  } else {
    invoices.push(invoice);
  }

  storeInvoices(invoices);
  activeInvoiceId = invoice.id;
  showEditingBanner(invoice.jobNumber);
  renderInvoiceList();
  if (showConfirmation) {
    alert(existingIndex >= 0 ? "Invoice updated successfully." : "Invoice saved successfully.");
  }
  return invoice;
}

function saveInvoice() {
  persistInvoice(true);
}

function longDisplayDate(value) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function safePdfFilenamePart(value) {
  return String(value || "Invoice")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Invoice";
}

function buildInvoicePrintHtml(invoice) {
  const taxRate = Number(invoice.taxRate || 0);
  const paymentRate = Number(invoice.paymentRate || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const taxAmount = subtotal * taxRate;
  const cardFee = (subtotal + taxAmount) * paymentRate;
  const customerName = invoice.businessName || invoice.clientName || "Customer";
  const logoUrl = new URL("images/logo.png", document.baseURI).href;
  const grassUrl = new URL("images/grass.png", document.baseURI).href;

  const serviceRows = (invoice.services || []).map((service) => `
    <tr>
      <td>${escapeHtml(longDisplayDate(service.date))}</td>
      <td>${escapeHtml(service.address || "")}</td>
      <td>${escapeHtml(normalizeService(service.service) === "Select" ? "" : normalizeService(service.service))}</td>
      <td class="money">${formatMoney(service.amount)}</td>
    </tr>
  `).join("") || '<tr><td colspan="4" class="empty-service">No service lines entered.</td></tr>';

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(invoice.jobNumber)}-${escapeHtml(safePdfFilenamePart(customerName))}</title>
    <style>
      @page { size: letter; margin: 0.42in; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #202620; font-family: Arial, Helvetica, sans-serif; font-size: 11px; background: #fff; }
      .invoice { min-height: 9.9in; border: 2px solid #2f7d32; border-radius: 10px; overflow: hidden; }
      .header { position: relative; display: grid; grid-template-columns: 145px 1fr 175px; align-items: center; min-height: 145px; padding: 16px 18px 12px; border-bottom: 5px solid #2f7d32; overflow: hidden; }
      .logo { width: 132px; max-height: 115px; object-fit: contain; }
      .company { position: relative; z-index: 2; }
      .company h1 { margin: 0 0 3px; color: #2f7d32; font-size: 25px; }
      .tagline { margin: 0 0 10px; color: #f07c00; font-size: 14px; font-weight: bold; }
      .company p { margin: 3px 0; font-size: 10.5px; }
      .grass { position: absolute; right: -18px; bottom: -18px; width: 250px; opacity: 0.95; }
      .invoice-title { position: relative; z-index: 2; align-self: start; text-align: right; }
      .invoice-title h2 { margin: 0; color: #2f7d32; font-size: 29px; letter-spacing: 1.5px; }
      .job-number { margin-top: 5px; color: #f07c00; font-size: 13px; font-weight: bold; }
      .content { padding: 15px 18px 18px; }
      .top-grid { display: grid; grid-template-columns: 1.45fr 0.85fr; gap: 22px; }
      .section-title { margin: 0 0 7px; padding-bottom: 4px; color: #2f7d32; border-bottom: 2px solid #d7e8d7; font-size: 13px; text-transform: uppercase; letter-spacing: 0.7px; }
      .bill-to strong { display: block; margin-bottom: 3px; font-size: 13px; }
      .bill-to p { margin: 2px 0; line-height: 1.35; }
      .dates { width: 100%; border-collapse: collapse; }
      .dates th, .dates td { padding: 4px 0 4px 10px; text-align: right; }
      .dates th { color: #536153; }
      .services { width: 100%; margin-top: 16px; border-collapse: collapse; table-layout: fixed; }
      .services th { padding: 8px 7px; color: white; background: #2f7d32; text-align: left; font-size: 10px; text-transform: uppercase; }
      .services td { min-height: 28px; padding: 7px; border-bottom: 1px solid #d7e8d7; vertical-align: top; word-wrap: break-word; }
      .services tbody tr:nth-child(even) { background: #f6faf6; }
      .services th:nth-child(1) { width: 15%; }
      .services th:nth-child(2) { width: 42%; }
      .services th:nth-child(3) { width: 27%; }
      .services th:nth-child(4) { width: 16%; text-align: right; }
      .money { text-align: right; white-space: nowrap; }
      .empty-service { color: #777; text-align: center; font-style: italic; }
      .bottom-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 26px; margin-top: 16px; }
      .notes { min-height: 80px; padding: 9px; border: 1px solid #d7e8d7; border-radius: 6px; white-space: pre-wrap; line-height: 1.4; }
      .payment { margin: 10px 0 0; color: #536153; }
      .totals { width: 100%; border-collapse: collapse; }
      .totals td { padding: 5px 0 5px 10px; }
      .totals td:last-child { text-align: right; font-weight: bold; }
      .grand-total td { padding-top: 9px; color: #2f7d32; border-top: 2px solid #2f7d32; font-size: 16px; font-weight: bold; }
      .thank-you { margin: 18px 0 0; color: #f07c00; text-align: center; font-size: 14px; font-weight: bold; }
      .print-help { padding: 10px; color: white; background: #334733; text-align: center; font-size: 13px; }
      .print-help button { margin-left: 10px; padding: 7px 14px; color: white; background: #2f7d32; border: 1px solid white; border-radius: 5px; font-weight: bold; cursor: pointer; }
      @media print {
        .print-help { display: none; }
        .invoice { min-height: auto; }
      }
    </style>
  </head>
  <body>
    <div class="print-help">Choose <strong>Save as PDF</strong> in the print window. <button onclick="window.print()">Print / Save PDF</button></div>
    <main class="invoice">
      <header class="header">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="Paradise Lawn Care logo">
        <div class="company">
          <h1>Paradise Lawn Care, LLC</h1>
          <p class="tagline">We Make Your Lawn Paradise Perfect.</p>
          <p>772-323-9401 &nbsp; | &nbsp; ParadiseLawncare772@gmail.com</p>
          <p>5685 SE Ault Ave., Suite 1, Stuart, FL 34997</p>
        </div>
        <img class="grass" src="${escapeHtml(grassUrl)}" alt="">
        <div class="invoice-title">
          <h2>INVOICE</h2>
          <div class="job-number">${escapeHtml(invoice.jobNumber)}</div>
        </div>
      </header>
      <div class="content">
        <section class="top-grid">
          <div class="bill-to">
            <h3 class="section-title">Bill To</h3>
            ${invoice.businessName ? `<strong>${escapeHtml(invoice.businessName)}</strong>` : ""}
            ${invoice.clientName ? `<p>${escapeHtml(invoice.clientName)}</p>` : ""}
            ${invoice.billingAddress ? `<p>${escapeHtml(invoice.billingAddress)}</p>` : ""}
            ${invoice.cityStateZip ? `<p>${escapeHtml(invoice.cityStateZip)}</p>` : ""}
            ${invoice.phone ? `<p>${escapeHtml(invoice.phone)}</p>` : ""}
            ${invoice.email ? `<p>${escapeHtml(invoice.email)}</p>` : ""}
          </div>
          <table class="dates">
            <tr><th>Invoice Date</th><td>${escapeHtml(longDisplayDate(invoice.invoiceDate))}</td></tr>
            <tr><th>Due Date</th><td>${escapeHtml(longDisplayDate(invoice.dueDate))}</td></tr>
            <tr><th>Payment</th><td>${escapeHtml(invoice.paymentMethod || "")}</td></tr>
          </table>
        </section>
        <table class="services">
          <thead><tr><th>Date</th><th>Service Address</th><th>Service</th><th>Amount</th></tr></thead>
          <tbody>${serviceRows}</tbody>
        </table>
        <section class="bottom-grid">
          <div>
            <h3 class="section-title">Notes</h3>
            <div class="notes">${escapeHtml(invoice.notes || "Thank you for choosing Paradise Lawn Care.")}</div>
            <p class="payment"><strong>Payment Method:</strong> ${escapeHtml(invoice.paymentMethod || "Not selected")}</p>
          </div>
          <table class="totals">
            <tr><td>Subtotal</td><td>${formatMoney(subtotal)}</td></tr>
            ${taxRate > 0 ? `<tr><td>Tax (${(taxRate * 100).toFixed(1)}%)</td><td>${formatMoney(taxAmount)}</td></tr>` : ""}
            ${paymentRate > 0 ? `<tr><td>Card Fee (${(paymentRate * 100).toFixed(1)}%)</td><td>${formatMoney(cardFee)}</td></tr>` : ""}
            <tr class="grand-total"><td>Total</td><td>${formatMoney(invoice.total)}</td></tr>
          </table>
        </section>
        <p class="thank-you">Thank you for allowing us to make your lawn Paradise Perfect!</p>
      </div>
    </main>
  </body>
  </html>`;
}

function saveAndCreatePDF() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups for this page so the invoice PDF can open.");
    return;
  }

  const invoice = persistInvoice(false);
  if (!invoice) {
    printWindow.close();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildInvoicePrintHtml(invoice));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 650);
}

function clearInvoiceFields() {
  ["dueDate", "businessName", "clientName", "billingAddress", "cityStateZip", "phone", "email", "notes"].forEach((id) => {
    byId(id).value = "";
  });
  byId("taxRate").selectedIndex = 0;
  byId("paymentMethod").selectedIndex = 0;
  resetServiceRows();
  calculateTotals();
}

function newInvoice() {
  if (!confirm("Start a new invoice? Any unsaved changes will be cleared.")) return;

  activeInvoiceId = null;
  clearInvoiceFields();
  byId("jobNumber").value = generateJobNumber();
  byId("todayDate").value = getLocalDateString();
  hideEditingBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrentInvoice() {
  if (!confirm("Clear the current invoice? The job number will not change.")) return;
  clearInvoiceFields();
  byId("todayDate").value = getLocalDateString();
}

function showEditingBanner(jobNumber) {
  byId("editingJobNumber").textContent = jobNumber;
  byId("editingBanner").hidden = false;
}

function hideEditingBanner() {
  byId("editingBanner").hidden = true;
  byId("editingJobNumber").textContent = "";
}

function loadInvoice(invoiceId) {
  const invoice = getSavedInvoices().find((item) => item.id === invoiceId);
  if (!invoice) {
    alert("That invoice could not be found.");
    renderInvoiceList();
    return;
  }

  activeInvoiceId = invoice.id;
  byId("jobNumber").value = invoice.jobNumber || "";
  byId("todayDate").value = invoice.invoiceDate || "";
  byId("dueDate").value = invoice.dueDate || "";
  byId("businessName").value = invoice.businessName || "";
  byId("clientName").value = invoice.clientName || "";
  byId("billingAddress").value = invoice.billingAddress || "";
  byId("cityStateZip").value = invoice.cityStateZip || "";
  byId("phone").value = invoice.phone || "";
  byId("email").value = invoice.email || "";
  byId("taxRate").value = String(invoice.taxRate ?? "0");
  byId("paymentMethod").value = String(invoice.paymentRate ?? "0");
  byId("notes").value = invoice.notes || "";
  resetServiceRows(invoice.services || []);
  calculateTotals();
  showEditingBanner(invoice.jobNumber);
  closeInvoiceFinder();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteInvoice(event, invoiceId) {
  event.stopPropagation();
  const invoices = getSavedInvoices();
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) return;

  if (!confirm(`Delete invoice ${invoice.jobNumber}? This cannot be undone.`)) return;

  storeInvoices(invoices.filter((item) => item.id !== invoiceId));
  if (activeInvoiceId === invoiceId) {
    activeInvoiceId = null;
    hideEditingBanner();
  }
  renderInvoiceList();
}

function openInvoiceFinder() {
  byId("invoiceFinderModal").hidden = false;
  byId("invoiceSearch").value = "";
  renderInvoiceList();
  setTimeout(() => byId("invoiceSearch").focus(), 0);
}

function closeInvoiceFinder() {
  byId("invoiceFinderModal").hidden = true;
}

function searchableInvoiceText(invoice) {
  return [
    invoice.jobNumber,
    invoice.invoiceDate,
    invoice.dueDate,
    invoice.clientName,
    invoice.businessName,
    invoice.billingAddress,
    invoice.cityStateZip,
    invoice.phone,
    invoice.email,
    invoice.notes,
    ...(invoice.services || []).flatMap((service) => [service.date, service.address, service.service, service.amount])
  ].join(" ").toLowerCase();
}

function renderInvoiceList() {
  const list = byId("invoiceList");
  if (!list) return;

  const searchTerm = (byId("invoiceSearch")?.value || "").trim().toLowerCase();
  const invoices = getSavedInvoices()
    .filter((invoice) => !searchTerm || searchableInvoiceText(invoice).includes(searchTerm))
    .sort((a, b) => new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt));

  list.innerHTML = "";
  byId("emptyInvoiceMessage").hidden = invoices.length > 0;

  invoices.forEach((invoice) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "invoice-row";
    row.addEventListener("click", () => loadInvoice(invoice.id));

    const customerDisplay = [invoice.clientName, invoice.businessName].filter(Boolean).join(" / ") || "No customer name";
    row.innerHTML = `
      <span class="invoice-job-number">${escapeHtml(invoice.jobNumber || "")}${invoice.isDemo ? '<small class="demo-label">DEMO</small>' : ""}</span>
      <span>${escapeHtml(formatDisplayDate(invoice.invoiceDate))}</span>
      <span class="invoice-customer">${escapeHtml(customerDisplay)}</span>
      <span class="invoice-total">${formatMoney(invoice.total)}</span>
      <span class="delete-dot" role="button" aria-label="Delete ${escapeHtml(invoice.jobNumber || "invoice")}" tabindex="0">●</span>
    `;

    const deleteDot = row.querySelector(".delete-dot");
    deleteDot.addEventListener("click", (event) => deleteInvoice(event, invoice.id));
    deleteDot.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") deleteInvoice(event, invoice.id);
    });
    list.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installDemoInvoices() {
  const invoices = getSavedInvoices();
  if (invoices.some((invoice) => invoice.isDemo)) {
    alert("The five demo jobs are already installed.");
    return;
  }

  const today = new Date();
  const demoCustomers = [
    ["Maria Santos", "", "112 SE Ocean Blvd, Stuart, FL 34994", "Full Service", 85],
    ["James Walker", "Walker Rentals", "840 NW Federal Hwy, Stuart, FL 34994", "Hedge Trim", 165],
    ["Linda Parker", "Seaside Villas HOA", "2250 NE Dixie Hwy, Jensen Beach, FL 34957", "Debris Removal", 240],
    ["Robert Green", "", "601 SW Saint Lucie Cres, Stuart, FL 34994", "Land Clearing", 475],
    ["Angela Morris", "Treasure Coast Realty", "3101 SE Federal Hwy, Stuart, FL 34997", "Full Service", 120]
  ];

  const demos = demoCustomers.map((item, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const invoiceDate = getLocalDateString(date);
    return {
      id: `paradise-demo-${index + 1}`,
      jobNumber: `DEMO-PL-${String(index + 1).padStart(3, "0")}`,
      invoiceDate,
      dueDate: invoiceDate,
      clientName: item[0],
      businessName: item[1],
      billingAddress: item[2],
      cityStateZip: "Stuart, FL 34994",
      phone: `772-555-01${String(index + 1).padStart(2, "0")}`,
      email: `demo${index + 1}@example.com`,
      services: [{ date: invoiceDate, address: item[2], service: item[3], amount: item[4] }],
      taxRate: "0",
      taxLabel: "No Tax",
      paymentRate: "0",
      paymentMethod: index % 2 === 0 ? "Cash" : "Business Check",
      notes: "Demo invoice for training and testing.",
      subtotal: item[4],
      total: item[4],
      isDemo: true,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString()
    };
  });

  storeInvoices([...invoices, ...demos]);
  renderInvoiceList();
  alert("Five demo jobs installed.");
}

function deleteDemoInvoices() {
  const invoices = getSavedInvoices();
  const demoCount = invoices.filter((invoice) => invoice.isDemo).length;
  if (!demoCount) {
    alert("There are no demo jobs to delete.");
    return;
  }

  if (!confirm(`Delete all ${demoCount} demo jobs? Real invoices will not be affected.`)) return;
  storeInvoices(invoices.filter((invoice) => !invoice.isDemo));
  renderInvoiceList();
  alert("Demo jobs deleted. Real invoices were not changed.");
}

function initializeApp() {
  byId("taxRate").addEventListener("change", calculateTotals);
  byId("paymentMethod").addEventListener("change", calculateTotals);
  byId("invoiceSearch").addEventListener("input", renderInvoiceList);
  byId("invoiceFinderModal").addEventListener("click", (event) => {
    if (event.target === byId("invoiceFinderModal")) closeInvoiceFinder();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !byId("invoiceFinderModal").hidden) closeInvoiceFinder();
  });

  resetServiceRows();
  byId("todayDate").value = getLocalDateString();
  byId("jobNumber").value = generateJobNumber();
  calculateTotals();
}

initializeApp();
