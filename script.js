let serviceRowCount = 0;
const maxServiceRows = 20;
const startingServiceRows = 5;

function cleanMoney(value) {
  return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function formatMoney(value) {
  return "$" + value.toFixed(2);
}

function getMonthCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return yy + mm;
}

function generateJobNumber() {
  const monthCode = getMonthCode();
  const savedMonth = localStorage.getItem("pl_last_month");
  let sequence = Number(localStorage.getItem("pl_job_sequence")) || 0;

  if (savedMonth !== monthCode) {
    sequence = 0;
  }

  sequence++;

  localStorage.setItem("pl_last_month", monthCode);
  localStorage.setItem("pl_job_sequence", sequence);

  const padded = String(sequence).padStart(5, "0");
  document.getElementById("jobNumber").value = `PL-${monthCode}-${padded}`;
}

function createServiceRow() {
  if (serviceRowCount >= maxServiceRows) {
    alert("Maximum of 20 service lines reached.");
    return;
  }

  serviceRowCount++;

  const row = document.createElement("div");
  row.className = "service-row";

  row.innerHTML = `
    <input type="date" class="service-date">

    <input type="text" class="service-address" placeholder="Service Address">

    <select class="service-select">
      <option>Select</option>
      <option>Mow</option>
      <option>Weed Eat</option>
      <option>Edge</option>
      <option>Blow</option>
      <option>Hedge Trim</option>
      <option>Debris Removal</option>
      <option>Land Clearing</option>
    </select>

    <input class="amount" type="text" inputmode="decimal" placeholder="$0.00">
  `;

  document.getElementById("serviceRows").appendChild(row);

  const amountField = row.querySelector(".amount");

  amountField.addEventListener("input", calculateTotals);

  amountField.addEventListener("blur", function () {
    formatAmountField(amountField);
  });
}

function addServiceRow() {
  createServiceRow();
}

function calculateTotals() {
  const amountFields = document.querySelectorAll(".amount");
  let subtotal = 0;

  amountFields.forEach(function (field) {
    subtotal += cleanMoney(field.value);
  });

  const taxRate = Number(document.getElementById("taxRate").value);
  const paymentRate = Number(document.getElementById("paymentMethod").value);

  const taxedTotal = subtotal + subtotal * taxRate;
  const cardFee = taxedTotal * paymentRate;
  const total = taxedTotal + cardFee;

  document.getElementById("subtotal").textContent = formatMoney(subtotal);
  document.getElementById("total").textContent = formatMoney(total);
}

function formatAmountField(field) {
  const value = cleanMoney(field.value);

  if (value > 0) {
    field.value = formatMoney(value);
  } else {
    field.value = "";
  }

  calculateTotals();
}

function resetForm() {
  if (!confirm("Clear this invoice? Job number will not change.")) {
    return;
  }

  document.querySelectorAll("input, textarea").forEach(function (field) {
    if (field.id !== "jobNumber") {
      field.value = "";
    }
  });

  document.querySelectorAll("select").forEach(function (field) {
    field.selectedIndex = 0;
  });

  const serviceRows = document.getElementById("serviceRows");
  serviceRows.innerHTML = "";
  serviceRowCount = 0;

  for (let i = 0; i < startingServiceRows; i++) {
    createServiceRow();
  }

  calculateTotals();
}

function setTodayDate() {
  const todayField = document.getElementById("todayDate");
  if (!todayField) return;

  const today = new Date();
  todayField.value = today.toISOString().split("T")[0];
}

document.getElementById("taxRate").addEventListener("change", calculateTotals);
document.getElementById("paymentMethod").addEventListener("change", calculateTotals);

for (let i = 0; i < startingServiceRows; i++) {
  createServiceRow();
}

setTodayDate();
generateJobNumber();
calculateTotals();