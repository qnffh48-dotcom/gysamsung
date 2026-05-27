import { db, doc, getDoc } from "./firebase.js";

let summaryVisitChart = null;
let therapySalesChart = null;
let injectionReserveChart = null;
let injectionChart = null;
let routeSalesChart = null;

const valueLabelPlugin = {
    id: "valueLabelPlugin",

    afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;

        ctx.save();
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);

            meta.data.forEach((bar, index) => {
                const value = dataset.data[index];
                if (!value) return;

                const text =
                    Number(value).toLocaleString("ko-KR");

                let x = bar.x;
                let y = bar.y + ((bar.base - bar.y) / 2);

                if (chart.options.indexAxis === "y") {
                    x = bar.x - ((bar.x - bar.base) / 2);
                    y = bar.y;
                }

                x = Math.max(chartArea.left + 12, Math.min(x, chartArea.right - 12));
                y = Math.max(chartArea.top + 12, Math.min(y, chartArea.bottom - 12));

                ctx.fillText(text, x, y);
            });
        });

        ctx.restore();
    }
};

const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const loadReportBtn = document.getElementById("loadReportBtn");

const today = new Date();
const todayKey = toDateInputValue(today);

startDate.value = todayKey;
endDate.value = todayKey;

const therapyItems = [
    "도수",
    "충격파",
    "신장분사",
    "페인 스크램블러",
    "수액",
    "근전도(신경전도)",
    "리푸스"
];

const therapyCols = ["신환", "재진", "매출", "상담", "예약"];

function toDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

function toFirebaseKey(dateInputValue) {
    const [y, m, d] = dateInputValue.split("-").map(Number);
    return `${y}-${m}-${d}`;
}

function getDateRange(start, end) {
    const result = [];

    const current = new Date(start);
    const last = new Date(end);

    while (current <= last) {
        result.push(toFirebaseKey(toDateInputValue(current)));
        current.setDate(current.getDate() + 1);
    }

    return result;
}

function money(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function count(value, unit = "") {
    return Number(value || 0).toLocaleString("ko-KR") + unit;
}

async function loadReportData() {
    const keys = getDateRange(startDate.value, endDate.value);

    const report = {
        summary: {
            new: 0,
            revisit: 0,
            new90: 0,
            noCalc: 0,
            total: 0,
            sales: 0,
            deposit: 0,
newSales: 0,
revisitSales: 0,
new90Sales: 0
            
        },
        therapy: {},
        injectionReserve: {
            newTotal: 0,
            newFollow: 0,
            newInjection: 0,
            revisitTotal: 0,
            revisitFollow: 0,
            revisitInjection: 0
        },
        injection: {
            carm: 0,
            arthrogram: 0,
            ultrasound: 0,
            total: 0
        },
        routeSales: {}
    };

    for (const key of keys) {
        const snap = await getDoc(doc(db, "closings", key));
const nurseSnap = await getDoc(doc(db, "nurseClosing", key));

const data = snap.exists() ? snap.data() : {};

if (nurseSnap.exists()) {
    data.nurseData = nurseSnap.data();
}

if (!snap.exists() && !nurseSnap.exists()) continue;

        collectSummary(report, data);
        collectTherapy(report, data);
        collectInjectionReserve(report, data);
        collectInjection(report, data);
        collectRouteSales(report, data);
    }

    renderSummary(report);
    renderTherapy(report);
    renderInjectionReserve(report);
    renderInjection(report);
    renderRouteSales(report);
    renderCharts(report);
}

function collectSummary(report, data) {
    const summary = data.deskExtraData?.summary || {};
    const deskData = data.deskData || {};

    report.summary.new += Number(summary.new || 0);
    report.summary.revisit += Number(summary.revisit || 0);
    report.summary.new90 += Number(summary.new90 || 0);
    report.summary.noCalc += Number(summary.noCalc || 0);
    report.summary.newSales += Number(summary.newSales || 0);
report.summary.revisitSales += Number(summary.revisitSales || 0);
report.summary.new90Sales += Number(summary.new90Sales || 0);

    const salesFields = [
        "급여",
        "비급여",
        "조합청구액",
        "100/100미만 총액",
        "장애인기금/전액본인"
    ];

    for (let i = 1; i <= 5; i++) {
        const room = deskData[`room${i}`] || {};

        salesFields.forEach(field => {
            report.summary.sales += Number(room[field] || 0);
        });

        report.summary.deposit += Number(room["현금"] || 0);
    }

    report.summary.total =
        report.summary.new +
        report.summary.revisit +
        report.summary.new90 +
        report.summary.noCalc;
}

function collectTherapy(report, data) {
    const therapyData = data.therapyData || {};
    const nurseData = data.nurseData || {};

    therapyItems.forEach(item => {
        if (!report.therapy[item]) {
            report.therapy[item] = {
                신환: 0,
                재진: 0,
                매출: 0,
                상담: 0,
                예약: 0
            };
        }

        for (let i = 1; i <= 5; i++) {
            const row = therapyData[`room${i}`]?.[item] || {};

            therapyCols.forEach(col => {
                report.therapy[item][col] += Number(row[col] || 0);
            });
        }

        if (item === "수액") {

    for (let i = 1; i <= 5; i++) {

        report.therapy[item].신환 +=
            Number(nurseData[`room${i}`]?.fluidNew || 0);

        report.therapy[item].재진 +=
            Number(nurseData[`room${i}`]?.fluidRevisit || 0);

        report.therapy[item].매출 +=
    Number(nurseData[`room${i}`]?.sales || 0);
    }
}
    });
}

function collectInjectionReserve(report, data) {
    const reserve = data.deskExtraData?.injectionReserve || {};

    function num(row, col) {
        return Number(reserve[row]?.[col] || 0);
    }

    const newX = num("X", "초진 X block");
    const newFollow = num("주사경과만", "초진 X block");
    const newInjection = num("주사만", "초진 X block");
    const newBoth = num("주사경과+주사", "초진 X block");
    const newEtc = num("이외예약O", "초진 X block");

    const revisitX = num("X", "재진 X block");
    const revisitFollow = num("주사경과만", "재진 X block");
    const revisitInjection = num("주사만", "재진 X block");
    const revisitBoth = num("주사경과+주사", "재진 X block");
    const revisitEtc = num("이외예약O", "재진 X block");

    report.injectionReserve.newTotal +=
        newX + newFollow + newInjection + newBoth + newEtc;

    report.injectionReserve.newFollow +=
        newBoth + newFollow;

    report.injectionReserve.newInjection +=
        newBoth + newInjection;

    report.injectionReserve.revisitTotal +=
        revisitX + revisitFollow + revisitInjection + revisitBoth + revisitEtc;

    report.injectionReserve.revisitFollow +=
        revisitBoth + revisitFollow;

    report.injectionReserve.revisitInjection +=
        revisitBoth + revisitInjection;
}

function collectInjection(report, data) {
    const radiology = data.radiologyData || {};
    const nurseData = data.nurseData || {};

    const carm =
        Number(radiology.carm_os1 || 0) +
        Number(radiology.carm_neuro || 0) +
        Number(radiology.carm_os3 || 0) +
        Number(radiology.carm_os4 || 0) +
        Number(radiology.carm_os5 || 0);

    const arthrogram =
        Number(radiology.arthrogram || 0);

    let ultrasound = 0;

    for (let i = 1; i <= 5; i++) {
        ultrasound +=
            Number(nurseData[`room${i}`]?.ultrasound || 0);
    }

    report.injection.carm += carm;
    report.injection.arthrogram += arthrogram;
    report.injection.ultrasound += ultrasound;
    report.injection.total += carm + arthrogram + ultrasound;
}

function collectRouteSales(report, data) {
    const routeSales = data.deskExtraData?.routeSales || {};

    Object.entries(routeSales).forEach(([route, row]) => {
        if (!report.routeSales[route]) {
            report.routeSales[route] = {
                count: 0,
                sales: 0
            };
        }

        report.routeSales[route].count += Number(row.count || 0);
        report.routeSales[route].sales += Number(row.sales || 0);
    });
}

function renderSummary(report) {
    const tbody = document.querySelector("#reportSummaryTable tbody");
    const s = report.summary;

    tbody.innerHTML = `
        <tr>
            <td>${count(s.new, "명")}</td>
            <td>${count(s.revisit, "명")}</td>
            <td>${count(s.new90, "명")}</td>
            <td>${count(s.noCalc, "명")}</td>
            <td class="total-cell">${count(s.total, "명")}</td>
            <td>${money(s.sales)}</td>
            <td>${money(s.total ? Math.round(s.sales / s.total) : 0)}</td>
            <td>${money(s.deposit)}</td>
        </tr>
    `;
}

function renderTherapy(report) {
    const tbody = document.querySelector("#reportTherapyTable tbody");

    const totals = {
        신환: 0,
        재진: 0,
        매출: 0,
        상담: 0,
        예약: 0
    };

    tbody.innerHTML = `
        ${therapyItems.map(item => {
            const row = report.therapy[item] || {};

            therapyCols.forEach(col => {
                totals[col] += Number(row[col] || 0);
            });

            return `
                <tr>
                    <td>${item}</td>
                    <td>${count(row.신환)}</td>
                    <td>${count(row.재진)}</td>
                    <td>${money(row.매출)}</td>
                    <td>${count(row.상담)}</td>
                    <td>${count(row.예약)}</td>
                </tr>
            `;
        }).join("")}

        <tr class="total-row">
            <td>합계</td>
            <td>${count(totals.신환, "명")}</td>
            <td>${count(totals.재진, "명")}</td>
            <td>${money(totals.매출)}</td>
            <td>${count(totals.상담, "명")}</td>
            <td>${count(totals.예약, "명")}</td>
        </tr>
    `;
}

function renderInjectionReserve(report) {
    const tbody = document.querySelector("#reportInjectionReserveTable tbody");
    const r = report.injectionReserve;

    const newFollowRate =
        r.newTotal ? ((r.newFollow / r.newTotal) * 100).toFixed(1) : "0.0";

    const newInjectionRate =
        r.newTotal ? ((r.newInjection / r.newTotal) * 100).toFixed(1) : "0.0";

    const revisitFollowRate =
        r.revisitTotal ? ((r.revisitFollow / r.revisitTotal) * 100).toFixed(1) : "0.0";

    const revisitInjectionRate =
        r.revisitTotal ? ((r.revisitInjection / r.revisitTotal) * 100).toFixed(1) : "0.0";

    tbody.innerHTML = `
        <tr>
            <th>초진</th>
            <td>${newFollowRate}%</td>
            <td>${newInjectionRate}%</td>
        </tr>
        <tr>
            <th>재진</th>
            <td>${revisitFollowRate}%</td>
            <td>${revisitInjectionRate}%</td>
        </tr>
    `;
}

function renderInjection(report) {
    const tbody = document.querySelector("#reportInjectionTable tbody");
    const i = report.injection;

    tbody.innerHTML = `
        <tr>
            <td>${count(i.carm, "건")}</td>
            <td>${count(i.arthrogram, "건")}</td>
            <td>${count(i.ultrasound, "건")}</td>
            <td class="total-cell">${count(i.total, "건")}</td>
        </tr>
    `;
}

function renderRouteSales(report) {
    const tbody = document.querySelector("#reportRouteSalesTable tbody");

    const rows = Object.entries(report.routeSales);

    const totalCount =
        rows.reduce((sum, [, row]) => sum + Number(row.count || 0), 0);

    const totalSales =
        rows.reduce((sum, [, row]) => sum + Number(row.sales || 0), 0);

    tbody.innerHTML = `
        ${rows.map(([route, row]) => `
            <tr>
                <td>${route}</td>
                <td>${count(row.count, "명")}</td>
                <td>${money(row.sales)}</td>
            </tr>
        `).join("")}

        <tr class="total-row">
            <td>합계</td>
            <td>${count(totalCount, "명")}</td>
            <td>${money(totalSales)}</td>
        </tr>
    `;
}

loadReportBtn.addEventListener("click", loadReportData);

loadReportData();
function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
}

function renderCharts(report) {
    renderSummaryVisitChart(report);
    renderTherapySalesChart(report);
    renderInjectionReserveChart(report);
    renderInjectionChart(report);
    renderRouteSalesChart(report);
}

function renderSummaryVisitChart(report) {
    const canvas = document.getElementById("summaryVisitChart");
    if (!canvas) return;

    destroyChart(summaryVisitChart);

    const s = report.summary;

    summaryVisitChart = new Chart(canvas, {
    plugins: [valueLabelPlugin],
        type: "bar",
        data: {
            labels: ["초진", "재진", "90일초진"],
            datasets: [
                {
    label: "내원 인원",
    data: [s.new, s.revisit, s.new90],
    yAxisID: "y",

    barPercentage: 0.5,
    categoryPercentage: 0.6
},
{
    label: "매출",
    data: [s.newSales, s.revisitSales, s.new90Sales],
    yAxisID: "y1",

    barPercentage: 0.5,
    categoryPercentage: 0.6
}
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    position: "left"
                },
                y1: {
                    beginAtZero: true,
                    position: "right",
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        callback: value =>
                            Number(value).toLocaleString("ko-KR") + "원"
                    }
                }
            }
        }
    });
}

function renderTherapySalesChart(report) {
    const canvas = document.getElementById("therapySalesChart");
    if (!canvas) return;

    destroyChart(therapySalesChart);

    const labels = Object.keys(report.therapy);
    const sales = labels.map(item =>
        Number(report.therapy[item]?.매출 || 0)
    );

    therapySalesChart = new Chart(canvas, {
    plugins: [valueLabelPlugin],
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "비급여 매출",
                data: sales

                

                
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderInjectionReserveChart(report) {
    const canvas = document.getElementById("injectionReserveChart");
    if (!canvas) return;

    destroyChart(injectionReserveChart);

    const r = report.injectionReserve;

    const newFollowRate =
        r.newTotal ? (r.newFollow / r.newTotal) * 100 : 0;

    const newInjectionRate =
        r.newTotal ? (r.newInjection / r.newTotal) * 100 : 0;

    const revisitFollowRate =
        r.revisitTotal ? (r.revisitFollow / r.revisitTotal) * 100 : 0;

    const revisitInjectionRate =
        r.revisitTotal ? (r.revisitInjection / r.revisitTotal) * 100 : 0;

    injectionReserveChart = new Chart(canvas, {
    plugins: [valueLabelPlugin],
        type: "bar",
        data: {
            labels: ["초진 주사경과", "초진 주사", "재진 주사경과", "재진 주사"],
            datasets: [{
                label: "비율(%)",
                data: [
                    newFollowRate.toFixed(1),
                    newInjectionRate.toFixed(1),
                    revisitFollowRate.toFixed(1),
                    revisitInjectionRate.toFixed(1)
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function renderInjectionChart(report) {
    const canvas = document.getElementById("injectionChart");
    if (!canvas) return;

    destroyChart(injectionChart);

    const i = report.injection;

    injectionChart = new Chart(canvas, {

    plugins: [{
        id: "doughnutLabel",

        afterDatasetsDraw(chart) {

            const { ctx } = chart;

            ctx.save();

            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const meta =
                chart.getDatasetMeta(0);

            meta.data.forEach((arc, index) => {

                const value =
                    chart.data.datasets[0].data[index];

                if (!value) return;

                const angle =
                    (arc.startAngle + arc.endAngle) / 2;

                const r =
                    (arc.innerRadius + arc.outerRadius) / 2;

                const x =
                    arc.x + Math.cos(angle) * r;

                const y =
                    arc.y + Math.sin(angle) * r;

                ctx.fillText(
                    Number(value).toLocaleString("ko-KR"),
                    x,
                    y
                );
            });

            ctx.restore();
        }
    }],
        type: "doughnut",
        data: {
            labels: ["C-ARM", "관절조영", "초음파"],
            datasets: [{
                data: [
                    i.carm,
                    i.arthrogram,
                    i.ultrasound
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderRouteSalesChart(report) {
    const canvas = document.getElementById("routeSalesChart");
    if (!canvas) return;

    destroyChart(routeSalesChart);

    const rows = Object.entries(report.routeSales)
        .sort((a, b) =>
            Number(b[1].sales || 0) - Number(a[1].sales || 0)
        )
        .slice(0, 10);

    routeSalesChart = new Chart(canvas, {
    plugins: [valueLabelPlugin],
        type: "bar",
        data: {
            labels: rows.map(([route]) => route),
            datasets: [{
                label: "내원 경로별 매출 TOP 10",
                data: rows.map(([, row]) =>
                    Number(row.sales || 0)
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}