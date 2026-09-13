let lastUpdateSeconds = 0;
let allAttempts = [];
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
  const maxPage = Math.max(1, Math.ceil(allAttempts.length / rowsPerPage));
  if (currentPage > maxPage) currentPage = maxPage;

  renderTablePage();

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

function renderTablePage() {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  const start = (currentPage - 1) * rowsPerPage;
  const pageItems = allAttempts.slice(start, start + rowsPerPage);

  pageItems.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.ip}</td><td>${a.username}</td><td>${a.time}</td>`;
    rows.appendChild(tr);
  });

  const maxPage = Math.max(1, Math.ceil(allAttempts.length / rowsPerPage));
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
  const maxPage = Math.max(1, Math.ceil(allAttempts.length / rowsPerPage));
  if (currentPage < maxPage) {
    currentPage++;
    renderTablePage();
  }
});

function tickUpdatedLabel() {
  lastUpdateSeconds += 1;
  document.getElementById("updated").textContent = `آخر تحديث: قبل ${lastUpdateSeconds} ثانية`;
}

loadData();
setInterval(loadData, 10000);
setInterval(tickUpdatedLabel, 1000);
