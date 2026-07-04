import { db, doc, setDoc, getDoc } from "./firebase.js";
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

   try {
    renderStats(rows);
    await saveCurrentStatsRows(rows);
    console.log("통계 Firebase 저장 완료");
} catch (err) {
    console.error("통계 저장 오류:", err);
    alert("화면 표시는 됐는데 Firebase 저장 실패. 콘솔 확인 필요");
}
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
    renderDoctorInsight(headers, dataRows, rows);
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

function getCellByHeader(headers, row, headerName) {
    const index = col(headers, headerName);
    if (index === -1) return 0;
    return num(row[index]);
}

function getDoctorDisplayName(name) {
    return String(name || "-")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getDoctorShortName(name) {
    const text = getDoctorDisplayName(name);

    const match = text.match(/\((.*?)\)/);
    if (match) return match[1];

    return text;
}

function maxBy(list, key) {
    return list.reduce((best, item) => {
        if (!best) return item;
        return Number(item[key] || 0) > Number(best[key] || 0) ? item : best;
    }, null);
}

function minBy(list, key) {
    const filtered = list.filter(item => Number(item[key] || 0) > 0);

    return filtered.reduce((best, item) => {
        if (!best) return item;
        return Number(item[key] || 0) < Number(best[key] || 0) ? item : best;
    }, null);
}

function averageOf(list, key) {
    const values = list
        .map(item => Number(item[key] || 0))
        .filter(value => value > 0);

    if (!values.length) return 0;

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderDoctorInsight(headers, dataRows, rawRows) {
    const grid = document.getElementById("doctorInsightGrid");
    const commentBox = document.getElementById("doctorCommentBox");

    if (!grid || !commentBox) return;

    const injectionBlocks = findInjectionBlocks(rawRows);

    const doctors = dataRows
        .filter(row => {
            const name = String(row[0] || "");
            return name && !name.includes("총합");
        })
        .map((row, index) => {
            const block = injectionBlocks[index] || {};

            return {
                name: getDoctorDisplayName(row[0]),
                shortName: getDoctorShortName(row[0]),

                newCount: getCellByHeader(headers, row, "초진수"),
                revisitCount: getCellByHeader(headers, row, "재진수"),
                totalVisit: getCellByHeader(headers, row, "합계"),

                totalSales: getCellByHeader(headers, row, "총 진료비"),
                salesPerVisit: getCellByHeader(headers, row, "건당 진료비"),

                newAvgVisit: getCellByHeader(headers, row, "신환 진료실별 평균내원횟수"),
                revisitRate: getCellByHeader(headers, row, "재내원률"),
                fiveVisitRate: getCellByHeader(headers, row, "5회 이상내원"),

                injectionRate: getCellByHeader(headers, row, "주사 처방률"),
                avgInjectionCount: getCellByHeader(headers, row, "평균 주사 횟수"),
                injectionAvgVisit: getCellByHeader(headers, row, "주사 평균 내원"),
                injectionReturnRate: getCellByHeader(headers, row, "주사 후 재내원률"),

                firstInjectionTotal: num(block.total),
                firstInjectionAvg: num(block.avg),
                firstInjectionOnce: num(block.values?.[0]),
                firstInjectionTwice: num(block.values?.[1]),
                firstInjectionThree: num(block.values?.[2]),
                firstInjectionFour: num(block.values?.[3]),
                firstInjectionFivePlus: num(block.values?.[4]),
                firstInjectionFivePlusRate: num(block.rates?.[4])
            };
        });

    if (!doctors.length) {
        grid.innerHTML = "";
        commentBox.textContent = "의사별 분석에 사용할 데이터가 없습니다.";
        return;
    }

    const visitTop = maxBy(doctors, "totalVisit");
    const salesTop = maxBy(doctors, "totalSales");
    const unitTop = maxBy(doctors, "salesPerVisit");
    const injectionRateTop = maxBy(doctors, "injectionRate");
    const injectionAvgTop = maxBy(doctors, "avgInjectionCount");
    const returnTop = maxBy(doctors, "injectionReturnRate");
    const fivePlusTop = maxBy(doctors, "firstInjectionFivePlusRate");

    const lowUnit = minBy(doctors, "salesPerVisit");
    const lowReturn = minBy(doctors, "injectionReturnRate");

    grid.innerHTML = `
        <div class="doctor-insight-card">
            <span>내원 최다</span>
            <strong>${escapeHtml(visitTop.shortName)}</strong>
            <p>${formatNumber(visitTop.totalVisit)}명</p>
        </div>

        <div class="doctor-insight-card">
            <span>총 진료비 최다</span>
            <strong>${escapeHtml(salesTop.shortName)}</strong>
            <p>${formatMoney(salesTop.totalSales)}</p>
        </div>

        <div class="doctor-insight-card">
            <span>건당 진료비 최고</span>
            <strong>${escapeHtml(unitTop.shortName)}</strong>
            <p>${formatMoney(unitTop.salesPerVisit)}</p>
        </div>

        <div class="doctor-insight-card">
            <span>주사 처방률 최고</span>
            <strong>${escapeHtml(injectionRateTop.shortName)}</strong>
            <p>${formatPercent(injectionRateTop.injectionRate)}</p>
        </div>

        <div class="doctor-insight-card">
            <span>평균 주사 횟수 최고</span>
            <strong>${escapeHtml(injectionAvgTop.shortName)}</strong>
            <p>${formatNumber(injectionAvgTop.avgInjectionCount)}회</p>
        </div>

        <div class="doctor-insight-card">
            <span>주사 후 재내원률 최고</span>
            <strong>${escapeHtml(returnTop.shortName)}</strong>
            <p>${formatPercent(returnTop.injectionReturnRate)}</p>
        </div>
    `;

    const avgSalesPerVisit = averageOf(doctors, "salesPerVisit");
    const avgInjectionRate = averageOf(doctors, "injectionRate");
    const avgReturnRate = averageOf(doctors, "injectionReturnRate");

    const comments = [];

    comments.push(`${visitTop.name}은 선택 월 기준 총 내원 ${formatNumber(visitTop.totalVisit)}명으로 가장 많은 환자를 진료했습니다.`);

    if (salesTop.name === visitTop.name) {
        comments.push(`${salesTop.name}은 내원수와 총 진료비가 모두 가장 높아 전체 매출 기여도가 가장 큰 진료실입니다.`);
    } else {
        comments.push(`총 진료비는 ${salesTop.name}이 ${formatMoney(salesTop.totalSales)}로 가장 높습니다. 내원수 1위와 매출 1위가 달라 진료 단가 차이가 있는 것으로 보입니다.`);
    }

    if (unitTop.salesPerVisit >= avgSalesPerVisit * 1.15) {
        comments.push(`${unitTop.name}은 건당 진료비가 ${formatMoney(unitTop.salesPerVisit)}로 평균보다 높습니다. 비급여, 주사, 고단가 처치 비중이 높은지 확인해볼 만합니다.`);
    } else {
        comments.push(`건당 진료비는 ${unitTop.name}이 가장 높지만, 전체 진료실 간 차이는 크지 않은 편입니다.`);
    }

    if (lowUnit && lowUnit.name !== unitTop.name) {
        comments.push(`${lowUnit.name}은 건당 진료비가 ${formatMoney(lowUnit.salesPerVisit)}로 낮은 편입니다. 단순 재진 또는 저단가 진료 비중이 높은지 확인이 필요합니다.`);
    }

    if (injectionRateTop.injectionRate >= avgInjectionRate * 1.2) {
        comments.push(`${injectionRateTop.name}은 주사 처방률이 ${formatPercent(injectionRateTop.injectionRate)}로 가장 높습니다. 주사 치료 연결이 강한 진료실입니다.`);
    } else {
        comments.push(`주사 처방률은 ${injectionRateTop.name}이 가장 높지만, 진료실 간 차이는 과도하지 않습니다.`);
    }

    if (injectionAvgTop.avgInjectionCount > 0) {
        comments.push(`${injectionAvgTop.name}은 평균 주사 횟수가 ${formatNumber(injectionAvgTop.avgInjectionCount)}회로 가장 높습니다.`);
    }

    if (returnTop.injectionReturnRate >= avgReturnRate * 1.1) {
        comments.push(`${returnTop.name}은 주사 후 재내원률이 ${formatPercent(returnTop.injectionReturnRate)}로 가장 높아 치료 후 추적 내원이 잘 이어지는 편입니다.`);
    }

    if (lowReturn && lowReturn.name !== returnTop.name) {
        comments.push(`${lowReturn.name}은 주사 후 재내원률이 ${formatPercent(lowReturn.injectionReturnRate)}로 낮은 편입니다. 주사 후 경과 예약 또는 재내원 안내가 충분한지 확인해볼 수 있습니다.`);
    }

    if (fivePlusTop.firstInjectionFivePlusRate > 0) {
        comments.push(`초진 주사 5회 이상 비율은 ${fivePlusTop.name}이 ${formatPercent(fivePlusTop.firstInjectionFivePlusRate)}로 가장 높습니다. 장기 치료 연결률이 상대적으로 높은 진료실입니다.`);
    }

    commentBox.innerHTML = comments
        .slice(0, 7)
        .map(text => `<div>• ${escapeHtml(text)}</div>`)
        .join("");
}
const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}


/* =========================
   통계 년 / 월 선택 + 월별 저장
========================= */

const statsYear = document.getElementById("statsYear");
const statsMonth = document.getElementById("statsMonth");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const today = new Date();

for (let y = 2024; y <= 2035; y++) {
    statsYear.innerHTML += `<option value="${y}">${y}년</option>`;
}

for (let m = 1; m <= 12; m++) {
    statsMonth.innerHTML += `<option value="${m}">${m}월</option>`;
}

statsYear.value = String(today.getFullYear());
statsMonth.value = String(today.getMonth() + 1);



async function saveCurrentStatsRows(rows) {
    const wrappedRows = rows.map(row => ({
        cells: Array.isArray(row) ? row : []
    }));

    await setDoc(
        doc(db, "statsRows", `${statsYear.value}-${statsMonth.value}`),
        { rows: wrappedRows },
        { merge: true }
    );
}

function clearStatsScreen() {
    document.getElementById("summaryGrid").innerHTML = "";
    document.getElementById("mainStatsTable").innerHTML = "";
    document.getElementById("injectionGrid").innerHTML = "";

    const doctorGrid = document.getElementById("doctorInsightGrid");
    const doctorComment = document.getElementById("doctorCommentBox");

    if (doctorGrid) doctorGrid.innerHTML = "";
    if (doctorComment) doctorComment.textContent = "엑셀 업로드 후 의사별 자동 분석이 표시됩니다.";

    if (mainChart) {
        mainChart.destroy();
        mainChart = null;
    }
}

async function loadCurrentStatsRows() {
    const snap = await getDoc(
        doc(db, "statsRows", `${statsYear.value}-${statsMonth.value}`)
    );

    if (!snap.exists()) {
        clearStatsScreen();
        return;
    }

    const saved = snap.data().rows || [];

    const rows = saved.map(item => {
        if (Array.isArray(item)) return item;
        return item.cells || [];
    });

    renderStats(rows);
}
prevMonthBtn.onclick = function () {
    const date = new Date(
        Number(statsYear.value),
        Number(statsMonth.value) - 1,
        1
    );

    date.setMonth(date.getMonth() - 1);

    statsYear.value = String(date.getFullYear());
    statsMonth.value = String(date.getMonth() + 1);

    loadCurrentStatsRows();
};

nextMonthBtn.onclick = function () {
    const date = new Date(
        Number(statsYear.value),
        Number(statsMonth.value) - 1,
        1
    );

    date.setMonth(date.getMonth() + 1);

    statsYear.value = String(date.getFullYear());
    statsMonth.value = String(date.getMonth() + 1);

    loadCurrentStatsRows();
};

statsYear.onchange = loadCurrentStatsRows;
statsMonth.onchange = loadCurrentStatsRows;

// 첫 접속 때 현재 년/월 통계 바로 표시
loadCurrentStatsRows();