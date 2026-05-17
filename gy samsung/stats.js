const excelFile = document.getElementById("excelFile");
let mainChart = null;

excelFile.addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheetName = workbook.SheetNames.includes("통계")
        ? "통계"
        : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
    });

    localStorage.setItem(
    `stats_rows_${statsYear.value}_${statsMonth.value}`,
    JSON.stringify(rows)
);

renderStats(rows);
});

function num(value) {
    if (value === null || value === undefined || value === "") return 0;

    return Number(
        String(value)
            .replace(/[₩,%원]/g, "")
            .replace(/,/g, "")
            .trim()
    ) || 0;
}

function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "-";

    const n = num(value);

    if (Number.isInteger(n)) {
        return n.toLocaleString("ko-KR");
    }

    return n.toLocaleString("ko-KR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "-";
    return num(value).toLocaleString("ko-KR") + "원";
}

function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "-";

    let n = num(value);

    if (n <= 1) {
        n = n * 100;
    }

    return n.toLocaleString("ko-KR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }) + "%";
}

function renderStats(rows) {
    const tableInfo = findMainTable(rows);

    if (!tableInfo) {
        alert("진료실 통계표를 찾지 못했습니다.");
        return;
    }

    const { headers, dataRows } = tableInfo;

    renderSummary(headers, dataRows);
    renderMainTable(headers, dataRows);
    renderChart(rows);
    renderInjectionStats(rows);
}

function findMainTable(rows) {
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];

        const startCol = row.findIndex(cell =>
            String(cell).trim() === "진료실"
        );

        if (startCol === -1) continue;

        const headers = row.slice(startCol).filter(h => h !== "");
        const dataRows = [];

        for (let i = r + 1; i < rows.length; i++) {
            const line = rows[i].slice(startCol);

            if (!line[0]) break;

            dataRows.push(line);

            if (String(line[0]).includes("총합")) break;
        }

        return { headers, dataRows };
    }

    return null;
}

function col(headers, name) {
    return headers.findIndex(h => String(h).trim() === name);
}

function fixHeaderName(h) {
    return String(h)
        .replace("5회 이상내원", "5회 이상내원률")
        .replace("5회이상내원", "5회이상내원률");
}

function renderSummary(headers, rows) {
    const total = rows.find(row => String(row[0]).includes("총합"));
    const summaryGrid = document.getElementById("summaryGrid");

    summaryGrid.innerHTML = `
        <div class="summary-card">
            <span>초진수</span>
            <strong>${formatNumber(total?.[col(headers, "초진수")])}</strong>
        </div>

        <div class="summary-card">
            <span>재진수</span>
            <strong>${formatNumber(total?.[col(headers, "재진수")])}</strong>
        </div>

        <div class="summary-card">
            <span>총 내원</span>
            <strong>${formatNumber(total?.[col(headers, "합계")])}</strong>
        </div>

        <div class="summary-card wide">
            <span>총 진료비</span>
            <strong>${formatMoney(total?.[col(headers, "총 진료비")])}</strong>
        </div>
    `;
}

function renderMainTable(headers, rows) {
    const table = document.getElementById("mainStatsTable");

    table.innerHTML = `
        <thead>
            <tr>
                ${headers.map(h => `<th>${fixHeaderName(h)}</th>`).join("")}
            </tr>
        </thead>

        <tbody>
            ${rows.map(row => `
                <tr class="${String(row[0]).includes("총합") ? "total-row" : ""}">
                    ${headers.map((h, i) => {
                        const value = row[i];
                        const header = fixHeaderName(h);

                        if (String(h).trim() === "진료실") {
                            return `<td>${value || "-"}</td>`;
                        }

                        if (String(h).includes("진료비")) {
                            return `<td>${formatMoney(value)}</td>`;
                        }

                        if (
                            header.includes("률") ||
                            header.includes("율")
                        ) {
                            return `<td>${formatPercent(value)}</td>`;
                        }

                        if (value !== "" && !isNaN(num(value))) {
                            return `<td>${formatNumber(value)}</td>`;
                        }

                        return `<td>${value || "-"}</td>`;
                    }).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function findInjectionBlocks(rows) {
    const blocks = [];

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];

        const startCol = row.findIndex(cell =>
            String(cell).trim() === "초진주사"
        );

        if (startCol === -1) continue;

        const rawTitle = row[startCol + 1] || "";
        const headers = row.slice(startCol + 2, startCol + 7);
        const values = rows[r + 1]?.slice(startCol + 2, startCol + 7) || [];
        const rates = rows[r + 2]?.slice(startCol + 2, startCol + 7) || [];

        blocks.push({
            title: rawTitle,
            total: rows[r + 1]?.[startCol] || "",
            avg: rows[r + 2]?.[startCol] || "",
            headers,
            values,
            rates
        });
    }

    return blocks;
}

function renderChart(rows) {
    const blocks = findInjectionBlocks(rows);

    const labels = blocks.map((b, i) => {
        const cleanTitle = String(b.title)
            .replace(`${i + 1}진료실`, "")
            .replace(/\n/g, " ")
            .trim();

        return `${i + 1}진료실\n${cleanTitle}`;
    });

    const first = blocks.map(b => num(b.values[0]));
    const second = blocks.map(b => num(b.values[1]));
    const third = blocks.map(b => num(b.values[2]));
    const fourth = blocks.map(b => num(b.values[3]));
    const fifth = blocks.map(b => num(b.values[4]));

    if (mainChart) {
        mainChart.destroy();
    }

    mainChart = new Chart(document.getElementById("mainChart"), {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "1회", data: first, backgroundColor: "rgba(74, 144, 226, 0.75)", borderRadius: 8, barThickness: 18 },
                { label: "2회", data: second, backgroundColor: "rgba(231, 76, 60, 0.75)", borderRadius: 8, barThickness: 18 },
                { label: "3회", data: third, backgroundColor: "rgba(241, 196, 15, 0.75)", borderRadius: 8, barThickness: 18 },
                { label: "4회", data: fourth, backgroundColor: "rgba(46, 204, 113, 0.75)", borderRadius: 8, barThickness: 18 },
                { label: "5회이상", data: fifth, backgroundColor: "rgba(230, 126, 34, 0.75)", borderRadius: 8, barThickness: 18 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 0,
                    right: 25,
                    bottom: 10,
                    left: 10
                }
            },
            plugins: {
                legend: {
                    position: "top",
                    align: "start",
                    labels: {
                        boxWidth: 14,
                        boxHeight: 14,
                        padding: 6,
                        font: {
                            size: 12,
                            weight: "600"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "rgba(20, 35, 50, 0.92)",
                    titleFont: {
                        size: 13,
                        weight: "700"
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 12,
                    cornerRadius: 10
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: "600"
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(0, 0, 0, 0.08)"
                    },
                    ticks: {
                        precision: 0,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            animation: {
                duration: 800,
                easing: "easeOutQuart"
            }
        },
        plugins: [{
            id: "valueLabels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;

                ctx.save();
                ctx.font = "600 11px Arial";
                ctx.fillStyle = "#1f3447";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);

                    meta.data.forEach((bar, index) => {
                        const value = dataset.data[index];

                        if (!value) return;

                        ctx.fillText(value, bar.x, bar.y - 4);
                    });
                });

                ctx.restore();
            }
        }]
    });
}

function renderInjectionStats(rows) {
    const grid = document.getElementById("injectionGrid");
    const blocks = findInjectionBlocks(rows);

    grid.innerHTML = "";

    blocks.forEach((block, index) => {
        const cleanTitle = String(block.title)
            .replace(`${index + 1}진료실`, "")
            .replace(/\n/g, "<br>")
            .trim();

        grid.innerHTML += `
            <div class="injection-card">
                <h3>${index + 1}진료실<br>${cleanTitle}</h3>

                <div class="inject-info">
                    <span>초진주사 ${formatNumber(block.total)}</span>
                    <strong>평균 ${formatNumber(block.avg)}</strong>
                </div>

                <table>
                    <thead>
                        <tr>
                            ${block.headers.map(h => `<th>${h}</th>`).join("")}
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            ${block.values.map(v => `<td>${formatNumber(v)}</td>`).join("")}
                        </tr>

                        <tr>
                            ${block.rates.map(v => `<td>${formatPercent(v)}</td>`).join("")}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });
}

const savedRows = localStorage.getItem("stats_rows");

if (savedRows) {
    renderStats(JSON.parse(savedRows));
}const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}/* =========================
   통계 년 / 월 선택 + 월별 저장
========================= */

const statsYear = document.getElementById("statsYear");
const statsMonth = document.getElementById("statsMonth");

const today = new Date();

for (let y = 2024; y <= 2035; y++) {
    statsYear.innerHTML += `<option value="${y}">${y}년</option>`;
}

for (let m = 1; m <= 12; m++) {
    statsMonth.innerHTML += `<option value="${m}">${m}월</option>`;
}

statsYear.value = today.getFullYear();
statsMonth.value = today.getMonth() + 1;

function statsKey() {
    return `stats_rows_${statsYear.value}_${statsMonth.value}`;
}

function saveCurrentStatsRows(rows) {
    localStorage.setItem(statsKey(), JSON.stringify(rows));
}

function loadCurrentStatsRows() {
    const saved = localStorage.getItem(statsKey());

    if (saved) {
        renderStats(JSON.parse(saved));
    } else {
        document.getElementById("summaryGrid").innerHTML = "";
        document.getElementById("mainStatsTable").innerHTML = "";
        document.getElementById("injectionGrid").innerHTML = "";

        if (mainChart) {
            mainChart.destroy();
            mainChart = null;
        }
    }
}

document.getElementById("prevMonth").onclick = function () {
    const date = new Date(
        Number(statsYear.value),
        Number(statsMonth.value) - 1,
        1
    );

    date.setMonth(date.getMonth() - 1);

    statsYear.value = date.getFullYear();
    statsMonth.value = date.getMonth() + 1;

    loadCurrentStatsRows();
};

document.getElementById("nextMonth").onclick = function () {
    const date = new Date(
        Number(statsYear.value),
        Number(statsMonth.value) - 1,
        1
    );

    date.setMonth(date.getMonth() + 1);

    statsYear.value = date.getFullYear();
    statsMonth.value = date.getMonth() + 1;

    loadCurrentStatsRows();
};

statsYear.onchange = loadCurrentStatsRows;
statsMonth.onchange = loadCurrentStatsRows;