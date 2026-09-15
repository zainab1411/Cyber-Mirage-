let lastUpdateSeconds = 0;
let allAttempts = [];
let filteredAttempts = [];
let currentPage = 1;
const rowsPerPage = 10;

async function loadData() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    renderData(data);
    lastUpdateSeconds = 0;
  } catch (err) {
    console.error("تعذر جلب البيانات:", err);
  }
}

function renderData(data) {
  document.getElementById("total").textContent = data.total_attempts;
  document.getElementById("topip").textContent = data.top_ip;

  const alertBox = document.getElementById("alert");
  alertBox.style.display = data.high_activity_alert ? "block" : "none";

  allAttempts = data.attempts;
  applyFilters();

  const countryLabels = data.attacks_by_country.map(c => c.country);
  const countryValues = data.attacks_by_country.map(c => c.percentage);

  if (window.countryChartInstance) {
    window.countryChartInstance.destroy();
  }

  window.countryChartInstance = new Chart(document.getElementById("countryChart"), {
    type: "pie",
    data: {
      labels: countryLabels,
      datasets: [{ data: countryValues }]
    },
    options: {
      plugins: { title: { display: true, text: "نسبة الهجمات حسب الدولة" } }
    }
  });
}

function parseDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.trim().split("/");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function applyFilters() {
  const ipQuery = document.getElementById("searchIp").value.trim().toLowerCase();
  const dateFrom = parseDDMMYYYY(document.getElementById("dateFrom").value);
  const dateTo = parseDDMMYYYY(document.getElementById("dateTo").value);

  filteredAttempts = allAttempts.filter(a => {
    const matchIp = ipQuery === "" || a.ip.toLowerCase().includes(ipQuery);

    let matchDate = true;
    if (dateFrom || dateTo) {
      const attemptDate = new Date(a.time);
      if (dateFrom && attemptDate < dateFrom) matchDate = false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (attemptDate > to) matchDate = false;
      }
    }

    return matchIp && matchDate;
  });

  currentPage = 1;
  renderTablePage();
}

function renderTablePage() {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  const start = (currentPage - 1) * rowsPerPage;
  const pageItems = filteredAttempts.slice(start, start + rowsPerPage);

  if (pageItems.length === 0) {
    rows.innerHTML = `<tr><td colspan="3" style="text-align:center;">لا توجد نتائج مطابقة</td></tr>`;
  } else {
    pageItems.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${a.ip}</td><td>${a.username}</td><td>${a.time}</td>`;
      rows.appendChild(tr);
    });
  }

  const maxPage = Math.max(1, Math.ceil(filteredAttempts.length / rowsPerPage));
  document.getElementById("pageInfo").textContent = `صفحة ${currentPage} من ${maxPage}`;
  document.getElementById("prevBtn").disabled = currentPage === 1;
  document.getElementById("nextBtn").disabled = currentPage === maxPage;
}

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTablePage();
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  const maxPage = Math.max(1, Math.ceil(filteredAttempts.length / rowsPerPage));
  if (currentPage < maxPage) {
    currentPage++;
    renderTablePage();
  }
});

document.getElementById("searchIp").addEventListener("input", applyFilters);
document.getElementById("dateFrom").addEventListener("input", applyFilters);
document.getElementById("dateTo").addEventListener("input", applyFilters);
document.getElementById("resetFilters").addEventListener("click", () => {
  document.getElementById("searchIp").value = "";
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  applyFilters();
});

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setInterval(loadData, 5000);
});
function updateTimerDisplay() {
  lastUpdateSeconds++;
  const el = document.getElementById("updated");
  if (lastUpdateSeconds < 5) {
    el.textContent = "آخر تحديث: قبل لحظات";
  } else {
    el.textContent = `آخر تحديث: قبل ${lastUpdateSeconds} ثانية`;
  }
}

setInterval(updateTimerDisplay, 1000);
function exportToCSV() {
  if (filteredAttempts.length === 0) {
    alert("لا توجد بيانات لتصديرها");
    return;
  }

  let csv = "عنوان IP,اسم المستخدم,الوقت\n";
  filteredAttempts.forEach(a => {
    csv += `${a.ip},${a.username},${a.time}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cyber-mirage-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

document.getElementById("exportCsv").addEventListener("click", exportToCSV);
let sortColumn = null;
let sortAscending = true;

function sortByColumn(column) {
  if (sortColumn === column) {
    sortAscending = !sortAscending;
  } else {
    sortColumn = column;
    sortAscending = true;
  }

  filteredAttempts.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    if (column === "time") {
      valA = new Date(valA);
      valB = new Date(valB);
    } else {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortAscending ? -1 : 1;
    if (valA > valB) return sortAscending ? 1 : -1;
    return 0;
  });

  currentPage = 1;
  renderTablePage();
}

document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    sortByColumn(th.getAttribute("data-sort"));
  });
});