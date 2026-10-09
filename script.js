
"use strict";

// Cash-Flow: Salary and Expense Tracker

const STORAGE_KEY = "cashFlowTrackerData";

const salaryForm = document.getElementById("salary-form");
const salaryInput = document.getElementById("salary-input");
const salaryError = document.getElementById("salary-error");
const salaryTotal = document.getElementById("salary-total");
const expensesTotal = document.getElementById("expenses-total");
const remainingBalance = document.getElementById("remaining-balance");
const balanceStatus = document.getElementById("balance-status");
const alertBanner = document.getElementById("alert-banner");

const expenseForm = document.getElementById("expense-form");
const expenseNameInput = document.getElementById("expense-name");
const expenseAmountInput = document.getElementById("expense-amount");
const expenseNameError = document.getElementById("expense-name-error");
const expenseAmountError = document.getElementById("expense-amount-error");
const expenseList = document.getElementById("expense-list");
const emptyState = document.getElementById("empty-state");
const expenseCount = document.getElementById("expense-count");
const formStatus = document.getElementById("form-status");

const downloadReportButton = document.getElementById("download-report");
const reportStatus = document.getElementById("report-status");
const currencySelect = document.getElementById("currency-select");
const convertCurrencyButton = document.getElementById("convert-currency");
const currencyStatus = document.getElementById("currency-status");
const chartCanvas = document.getElementById("balance-chart");
const chartFallback = document.getElementById("chart-fallback");

let salary = 0;
let expenses = [];
let chart = null;
let displayCurrency = "INR";
let exchangeRates = { INR: 1 };

function createId() {
  return window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMoney(amount, currency = displayCurrency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function getTotalExpenses() {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function getRemainingBalance() {
  return salary - getTotalExpenses();
}

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("is-error", "is-success");
  if (type) element.classList.add(type);
}

function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ salary, expenses })
    );
    return true;
  } catch (error) {
    console.error("Could not save data:", error);
    showStatus(
      formStatus,
      "Could not save data. Check your browser storage settings.",
      "is-error"
    );
    return false;
  }
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const data = JSON.parse(stored);
    if (!data || typeof data !== "object") return;

    const savedSalary = Number(data.salary);
    salary = Number.isFinite(savedSalary) && savedSalary >= 0
      ? savedSalary
      : 0;

    expenses = Array.isArray(data.expenses)
      ? data.expenses
          .filter(item =>
            item &&
            typeof item.name === "string" &&
            item.name.trim() &&
            Number.isFinite(Number(item.amount)) &&
            Number(item.amount) > 0
          )
          .map(item => ({
            id: String(item.id || createId()),
            name: item.name.trim().slice(0, 100),
            amount: Number(item.amount),
            createdAt: item.createdAt || new Date().toISOString()
          }))
      : [];
  } catch (error) {
    console.error("Could not load saved data:", error);
    salary = 0;
    expenses = [];
  }
}

function renderSalary() {
  salaryTotal.textContent = formatMoney(
    salary * (exchangeRates[displayCurrency] || 1)
  );
  salaryInput.value = salary > 0 ? String(salary) : "";
}

function renderSummary() {
  const total = getTotalExpenses();
  const balance = getRemainingBalance();
  const rate = exchangeRates[displayCurrency] || 1;

  expensesTotal.textContent = formatMoney(total * rate);
  remainingBalance.textContent = formatMoney(balance * rate);

  const isLow = salary > 0 && balance < salary * 0.1;

  remainingBalance.classList.toggle("is-low", isLow);
  balanceStatus.classList.toggle("is-low", isLow);
  alertBanner.hidden = !isLow;

  if (salary <= 0) {
    balanceStatus.textContent = "Set a salary to begin";
  } else if (isLow) {
    balanceStatus.textContent = "Low balance warning";
  } else {
    balanceStatus.textContent = "Balance looks healthy";
  }
}

function renderExpenses() {
  expenseList.replaceChildren();

  const rate = exchangeRates[displayCurrency] || 1;

  expenses.forEach(expense => {
    const item = document.createElement("li");
    item.className = "expense-item";

    const details = document.createElement("div");
    details.className = "expense-details";

    const name = document.createElement("span");
    name.className = "expense-name";
    name.textContent = expense.name;

    const date = document.createElement("span");
    date.className = "expense-date";

    const parsedDate = new Date(expense.createdAt);
    date.textContent = Number.isNaN(parsedDate.getTime())
      ? "Date unavailable"
      : parsedDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });

    details.append(name, date);

    const right = document.createElement("div");
    right.className = "expense-right";

    const amount = document.createElement("span");
    amount.className = "expense-amount";
    amount.textContent = formatMoney(expense.amount * rate);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute(
      "aria-label",
      `Delete expense: ${expense.name}`
    );

    deleteButton.addEventListener("click", () => {
      deleteExpense(expense.id);
    });

    right.append(amount, deleteButton);
    item.append(details, right);
    expenseList.append(item);
  });

  emptyState.hidden = expenses.length > 0;
  expenseCount.textContent =
    `${expenses.length} ${expenses.length === 1 ? "item" : "items"}`;
}

function renderChart() {
  if (typeof Chart === "undefined") {
    chartCanvas.hidden = true;
    chartFallback.hidden = false;
    return;
  }

  chartCanvas.hidden = false;
  chartFallback.hidden = true;

  const rate = exchangeRates[displayCurrency] || 1;
  const values = [
    Math.max(0, getRemainingBalance()) * rate,
    getTotalExpenses() * rate
  ];

  if (chart) {
    chart.data.datasets[0].data = values;
    chart.update();
    return;
  }

  chart = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels: ["Remaining Balance", "Total Expenses"],
      datasets: [{
        data: values,
        backgroundColor: ["#555d69", "#c8ccd2"],
        borderColor: ["#ffffff", "#ffffff"],
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${formatMoney(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

function renderAll() {
  renderSalary();
  renderSummary();
  renderExpenses();
  renderChart();
}

function logAnalytics(action) {
  console.log(`[Cash-Flow] ${action}`);
}

// Save salary
salaryForm.addEventListener("submit", event => {
  event.preventDefault();

  const rawValue = salaryInput.value.trim();
  const value = Number(rawValue);

  if (!rawValue || !Number.isFinite(value) || value <= 0) {
    setFieldError(
      salaryInput,
      salaryError,
      "Enter a valid salary greater than zero."
    );
    salaryInput.focus();
    return;
  }

  setFieldError(salaryInput, salaryError, "");
  salary = value;

  saveState();
  renderAll();
  showStatus(formStatus, "Salary saved successfully.", "is-success");
  logAnalytics("Salary saved");
});

salaryInput.addEventListener("input", () => {
  setFieldError(salaryInput, salaryError, "");
});

// Clear errors while typing
expenseNameInput.addEventListener("input", () => {
  setFieldError(expenseNameInput, expenseNameError, "");
});

expenseAmountInput.addEventListener("input", () => {
  setFieldError(expenseAmountInput, expenseAmountError, "");
});

// Add expense
expenseForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = expenseNameInput.value.trim().slice(0, 100);
  const rawAmount = expenseAmountInput.value.trim();
  const amount = Number(rawAmount);
  let valid = true;

  if (!name) {
    setFieldError(
      expenseNameInput,
      expenseNameError,
      "Enter an expense name."
    );
    valid = false;
  } else {
    setFieldError(expenseNameInput, expenseNameError, "");
  }

  if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
    setFieldError(
      expenseAmountInput,
      expenseAmountError,
      "Enter an amount greater than zero."
    );
    valid = false;
  } else {
    setFieldError(expenseAmountInput, expenseAmountError, "");
  }

  if (!valid) {
    showStatus(
      formStatus,
      "Please correct the highlighted fields.",
      "is-error"
    );
    expenseForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  expenses.unshift({
    id: createId(),
    name,
    amount,
    createdAt: new Date().toISOString()
  });

  saveState();
  renderAll();
  expenseForm.reset();

  setFieldError(expenseNameInput, expenseNameError, "");
  setFieldError(expenseAmountInput, expenseAmountError, "");

  showStatus(formStatus, "Expense added successfully.", "is-success");
  logAnalytics("Expense added");
});

// Delete expense
function deleteExpense(id) {
  const target = expenses.find(expense => expense.id === id);
  if (!target) return;

  expenses = expenses.filter(expense => expense.id !== id);

  saveState();
  renderAll();

  showStatus(
    formStatus,
    `"${target.name}" was deleted.`,
    "is-success"
  );
  logAnalytics("Expense deleted");
}

// Currency converter
async function convertCurrency() {
  const target = currencySelect.value;

  if (target === "INR") {
    displayCurrency = "INR";
    exchangeRates = { INR: 1 };
    renderAll();
    showStatus(
      currencyStatus,
      "Showing INR. Saved records remain in INR.",
      "is-success"
    );
    return;
  }

  convertCurrencyButton.disabled = true;
  convertCurrencyButton.textContent = "Loading rate…";
  showStatus(currencyStatus, "Fetching latest reference rate…");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=INR&to=${encodeURIComponent(target)}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      throw new Error("Rate service returned an error.");
    }

    const data = await response.json();
    const rate = Number(data.rates?.[target]);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid exchange rate.");
    }

    exchangeRates = { INR: 1, [target]: rate };
    displayCurrency = target;

    renderAll();

    showStatus(
      currencyStatus,
      `Showing ${target} using the reference rate${data.date ? ` dated ${data.date}` : ""}. Saved records remain in INR.`,
      "is-success"
    );

    logAnalytics("Currency converted");
  } catch (error) {
    showStatus(
      currencyStatus,
      "Currency conversion is unavailable. Check your internet and try again.",
      "is-error"
    );
  } finally {
    clearTimeout(timeoutId);
    convertCurrencyButton.disabled = false;
    convertCurrencyButton.textContent = "Update currency";
  }
}

convertCurrencyButton.addEventListener("click", convertCurrency);

currencySelect.addEventListener("change", () => {
  if (currencySelect.value === "INR") {
    displayCurrency = "INR";
    exchangeRates = { INR: 1 };
    renderAll();
    showStatus(currencyStatus, "Showing INR.");
  }
});

// Load external PDF library when needed
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load PDF library."));
    document.head.append(script);
  });
}

// Download PDF report
async function downloadReport() {
  downloadReportButton.disabled = true;
  downloadReportButton.textContent = "Preparing PDF…";
  showStatus(reportStatus, "Preparing your report…");

  try {
    if (!window.jspdf?.jsPDF) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
      );
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 16;
    const maxWidth = 178;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Cash-Flow Expense Report", left, y);
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
    y += 9;

    doc.text(`Total Salary: ${formatMoney(salary, "INR")}`, left, y);
    y += 7;
    doc.text(`Total Expenses: ${formatMoney(getTotalExpenses(), "INR")}`, left, y);
    y += 7;
    doc.text(`Remaining Balance: ${formatMoney(getRemainingBalance(), "INR")}`, left, y);
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.text("Expense history", left, y);
    y += 8;
    doc.setFont("helvetica", "normal");

    if (expenses.length === 0) {
      doc.text("No expenses recorded.", left, y);
    } else {
      expenses.forEach((expense, index) => {
        const date = new Date(expense.createdAt).toLocaleDateString();
        const line = `${index + 1}. ${expense.name} - ${formatMoney(expense.amount, "INR")} - ${date}`;
        const lines = doc.splitTextToSize(line, maxWidth);
        const height = lines.length * 6 + 2;

        if (y + height > pageHeight - 16) {
          doc.addPage();
          y = 20;
        }

        doc.text(lines, left, y);
        y += height;
      });
    }

    doc.save("cash-flow-report.pdf");
    showStatus(reportStatus, "PDF report downloaded.", "is-success");
    logAnalytics("PDF report downloaded");
  } catch (error) {
    console.error("PDF generation failed:", error);
    showStatus(
      reportStatus,
      "Could not create the PDF. Check your internet and try again.",
      "is-error"
    );
  } finally {
    downloadReportButton.disabled = false;
    downloadReportButton.textContent = "Download PDF report";
  }
}

downloadReportButton.addEventListener("click", downloadReport);

// Start the application
loadState();
renderAll();