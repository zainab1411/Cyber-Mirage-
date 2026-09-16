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

  // تحديث ملخص أعلى 3 دول
  updateTopCountries(data.attacks_by_country);

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

// دالة لتحديث قائمة أعلى 3 دول
function updateTopCountries(countries) {
  const listEl = document.getElementById("topCountriesList");
  if (!listEl) return;
  listEl.innerHTML = "";
  
  const sortedCountries = [...countries].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  
  sortedCountries.forEach((c, index) => {
    const li = document.createElement("li");
    li.style.cssText = "padding: 6px 0; border-bottom: 1px solid #333; font-size: 14px;";
    li.innerHTML = `${index + 1}. 🌍 ${c.country}: <span style="color:#00f2fe; font-weight:bold;">${c.percentage}%</span>`;
    listEl.appendChild(li);
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
    rows.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:15px; color:#888;">لا توجد نتائج مطابقة</td></tr>`;
  } else {
    const ipCounts = {};
    filteredAttempts.forEach(item => {
      ipCounts[item.ip] = (ipCounts[item.ip] || 0) + 1;
    });

    pageItems.forEach((a) => {
      const count = ipCounts[a.ip] || 1;
      const tr = document.createElement("tr");

      // تمييز الـ IP المتكرر مع Tooltip يوضح عدد مرات التكرار عند مرور الماوس
      let ipDisplay = `<span title="عنوان IP مسجل (عدد المحاولات: ${count})" style="cursor: pointer; text-decoration: underline dotted;">${a.ip}</span>`;
      if (count > 1) {
        ipDisplay = `<span title="⚠️ تحذير: IP متكرر (${count} محاولات)" style="cursor: pointer;">${a.ip} <span style="background: rgba(255,0,0,0.2); color:#ff6b6b; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px; font-weight: bold;">🔴 ${count}</span></span>`;
      }

      tr.innerHTML = `<td style="padding: 10px;">${ipDisplay}</td><td style="padding: 10px;">${a.username || '-'}</td><td style="padding: 10px;" dir="ltr">${a.time}</td>`;
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
  setInterval(loadData, 3600000);
  initThemeToggle(); // تشغيل خاصية الوضع الليلي/النهاري
});

function updateTimerDisplay() {
  lastUpdateSeconds++;
  const el = document.getElementById("updated");
  if (!el) return;
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
      valA = (valA || "").toLowerCase();
      valB = (valB || "").toLowerCase();
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

// وظيفة زر الوضع الليلي والنهاري (Dark/Light Mode)
function initThemeToggle() {
  const toggleBtn = document.getElementById("themeToggle");
  if (!toggleBtn) return;
  
  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    toggleBtn.textContent = isLight ? "🌙 وضع ليلي" : "☀️ وضع نهاري";
  });
}