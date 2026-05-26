import { db, doc, getDoc, setDoc } from "./firebase.js";
let dailyRowsForRoute = null;
let routeRowsForSales = null;
const roomFields = [
    "급여",
    "비급여",
    "조합청구액",
    "100/100미만 총액",
    "장애인기금/전액본인",
    "현금",
    "카드",
];

let deskData = {};
let deskExtraData = {
    reservation: {},
    injectionReserve: {},
    expense: {},
    income: {},
    memo: ""
};

/* =========================
   날짜
========================= */

const yearSelect = document.getElementById("deskYear");
const monthSelect = document.getElementById("deskMonth");
const daySelect = document.getElementById("deskDay");

const today = new Date();

let currentYear = today.getFullYear();
let currentMonth = today.getMonth() + 1;
let currentDay = today.getDate();

for (let y = 2024; y <= 2035; y++) {
    yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
}

for (let m = 1; m <= 12; m++) {
    monthSelect.innerHTML += `<option value="${m}">${m}월</option>`;
}

function updateDays() {
    const lastDay = new Date(
        Number(yearSelect.value),
        Number(monthSelect.value),
        0
    ).getDate();

    daySelect.innerHTML = "";

    for (let d = 1; d <= lastDay; d++) {
        daySelect.innerHTML += `<option value="${d}">${d}일</option>`;
    }

    daySelect.value = currentDay;
}

yearSelect.value = currentYear;
monthSelect.value = currentMonth;

updateDays();

daySelect.value = currentDay;

function getDateKey() {
    return `${yearSelect.value}-${monthSelect.value}-${daySelect.value}`;
}

/* =========================
   저장 / 불러오기
========================= */

async function loadDeskStorage() {
    const key = getDateKey();

    const snap = await getDoc(doc(db, "closings", key));
    const data = snap.exists() ? snap.data() : {};

    deskData = data.deskData || {};

    deskExtraData = data.deskExtraData || {
        reservation: {},
        injectionReserve: {},
        expense: {},
        income: {},
        memo: ""
    };
}

async function saveDeskData(roomNum, field, value) {
    if (!deskData[`room${roomNum}`]) {
        deskData[`room${roomNum}`] = {};
    }

    deskData[`room${roomNum}`][field] = Number(value) || 0;

    await setDoc(
    doc(db, "closings", getDateKey()),
    {
        deskExtraData: {
            ...deskExtraData,
            updatedAt: Date.now()
        }
    },
    { merge: true }
);
}

async function saveDeskExtra() {
    await setDoc(
        doc(db, "closings", getDateKey()),
        {
            deskExtraData: deskExtraData
        },
        { merge: true }
    );
}
/* =========================
   진료실 입력 생성
========================= */

function renderRooms() {
    for (let i = 1; i <= 5; i++) {
        if (!deskData[`room${i}`]) {
            deskData[`room${i}`] = {};
        }

        const page = document.getElementById(`room${i}`);
        if (!page) continue;

        page.innerHTML = `
            

            ${roomFields.map(field => `
                <div class="input-row">
                    <label>${field}</label>
                    <input
                        type="number"
                        value="${deskData[`room${i}`][field] ?? 0}"
                        oninput="saveDeskData(${i}, '${field}', this.value)"
                    >
                </div>
            `).join("")}
        `;
    }
}

/* =========================
   추가 입력
========================= */

function setupExtraInputs() {
    setupReservation();
    setupInjectionReserve();
    setupMemo();
}
function setupReservation() {
    const rows = document.querySelectorAll(".desk-section:nth-of-type(2) tbody tr");

    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const name = cells[0]?.textContent.trim();
        const inputs = row.querySelectorAll("input");

        if (!name) return;

        if (!deskExtraData.reservation[name]) {
            deskExtraData.reservation[name] = {};
        }

        if (name === "실예약환자수") {
            inputs[0].value =
                deskExtraData.reservation[name]["값"] ?? 0;

            inputs[0].oninput = function () {
                deskExtraData.reservation[name]["값"] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };

            return;
        }

        const cols = ["예약", "변경", "취소"];

        inputs.forEach((input, index) => {
            const col = cols[index];

            input.type = "number";
            input.value =
                deskExtraData.reservation[name][col] ?? 0;

            input.oninput = function () {
                deskExtraData.reservation[name][col] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };
        });
    });
}

function setupInjectionReserve() {
    const rows = document.querySelectorAll(".desk-section:nth-of-type(3) tbody tr");
    const cols = ["초진 X block", "재진 X block"];

    rows.forEach(row => {
        const name = row.querySelector("td")?.textContent.trim();
        const inputs = row.querySelectorAll("input");

        if (!name) return;

        if (!deskExtraData.injectionReserve[name]) {
            deskExtraData.injectionReserve[name] = {};
        }

        inputs.forEach((input, index) => {
            const col = cols[index];

            input.type = "number";
            input.value =
                deskExtraData.injectionReserve[name][col] ?? 0;

            input.oninput = function () {
                deskExtraData.injectionReserve[name][col] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };
        });
    });
}


function setupMemo() {
    const memo = document.querySelector(".memo-box");
    if (!memo) return;

    memo.value = deskExtraData.memo || "";

    memo.oninput = function () {
        deskExtraData.memo = this.value;

        saveDeskExtra();
    };
}

/* =========================
   날짜 변경 시 전체 갱신
========================= */

async function reloadDeskPage() {
    await loadDeskStorage();
    renderRooms();
    setupExtraInputs();

    if (deskExtraData.timeChart) {
        drawTimePeriodChart(deskExtraData.timeChart);
    } else {
        clearTimePeriodChart();
    }

    if (deskExtraData.routeSales) {
        renderRouteSalesTable(deskExtraData.routeSales);
    } else {
        clearRouteSalesTable();
    }

    if (deskExtraData.insuranceType) {
        renderInsuranceTypeTable(deskExtraData.insuranceType);
    } else {
        clearInsuranceTypeTable();
    }
}
yearSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadDeskPage();
});

monthSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadDeskPage();
});

daySelect.addEventListener("change", reloadDeskPage);

function changeDate(diff) {
    const date = new Date(
        Number(yearSelect.value),
        Number(monthSelect.value) - 1,
        Number(daySelect.value)
    );

    date.setDate(date.getDate() + diff);

    yearSelect.value = date.getFullYear();
    monthSelect.value = date.getMonth() + 1;

    currentDay = date.getDate();

    updateDays();

    daySelect.value = currentDay;

    reloadDeskPage();
}

document
    .getElementById("prevDay")
    .addEventListener("click", () => changeDate(-1));

document
    .getElementById("nextDay")
    .addEventListener("click", () => changeDate(1));

/* =========================
   탭
========================= */

function openRoom(event, roomId) {
    document.querySelectorAll(".room-tab").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".room-page").forEach(page => {
        page.classList.remove("active");
    });

    event.currentTarget.classList.add("active");

    document.getElementById(roomId).classList.add("active");
    
}

window.openRoom = openRoom;
window.saveDeskData = saveDeskData;

document.querySelectorAll(".desk-top-tab").forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.tab;

        document.querySelectorAll(".desk-top-tab").forEach(btn => {
            btn.classList.remove("active");
        });

        document.querySelectorAll(".desk-top-page").forEach(page => {
            page.classList.remove("active");
        });

        button.classList.add("active");

        document.getElementById(target)?.classList.add("active");
    });
});

/* =========================
   사이드바 스크롤
========================= */

const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform =
                `translateY(${targetY}px)`;
        });
    });
}

reloadDeskPage();
let timePeriodChart = null;

document.getElementById("dailyExcelInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(sheet, {
            range: 6,
            defval: ""
        });

        const timeChart = makeTimePeriodResult(rows);
const insuranceType = makeInsuranceTypeResult(rows);
const summary = makeClosingSummaryResult(rows);

dailyRowsForRoute = rows;

deskExtraData.timeChart = timeChart;
        deskExtraData.insuranceType = insuranceType;
        deskExtraData.summary = summary;

        await setDoc(
            doc(db, "closings", getDateKey()),
            {
                deskExtraData: deskExtraData
            },
            { merge: true }
        );

        drawTimePeriodChart(timeChart);
        renderInsuranceTypeTable(insuranceType);

        alert("엑셀 업로드 저장 완료");
    };

    reader.readAsArrayBuffer(file);
});

function clearTimePeriodChart() {
    document.getElementById("morningCount").textContent = "0명";
    document.getElementById("afternoonCount").textContent = "0명";
    document.getElementById("eveningCount").textContent = "0명";

    if (timePeriodChart) {
        timePeriodChart.destroy();
        timePeriodChart = null;
    }
}function drawTimePeriodChart(result) {
    const ageGroups = [
        "0~19", "20~29", "30~39",
        "40~49", "50~59", "60~69",
        "70~79", "80~89", "90~100"
    ];

    const colors = [
        "#ef4444", "#f97316", "#eab308",
        "#22c55e", "#14b8a6", "#3b82f6",
        "#6366f1", "#a855f7", "#ec4899"
    ];

    const morningTotal = ageGroups.reduce((sum, group) => sum + (result[group]?.오전 || 0), 0);
    const afternoonTotal = ageGroups.reduce((sum, group) => sum + (result[group]?.오후 || 0), 0);
    const eveningTotal = ageGroups.reduce((sum, group) => sum + (result[group]?.저녁 || 0), 0);

    document.getElementById("morningCount").textContent = morningTotal + "명";
    document.getElementById("afternoonCount").textContent = afternoonTotal + "명";
    document.getElementById("eveningCount").textContent = eveningTotal + "명";

    const ctx = document.getElementById("timePeriodChart");

    if (timePeriodChart) {
        timePeriodChart.destroy();
    }

    timePeriodChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: [
                "오전(09~12)",
                "오후(12~17)",
                "저녁(17~19:30)"
            ],
            datasets: ageGroups.map((group, index) => ({
                label: group,
                data: [
                    result[group]?.오전 || 0,
                    result[group]?.오후 || 0,
                    result[group]?.저녁 || 0
                ],
                backgroundColor: colors[index]
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            }
        }
    });
}document.getElementById("routeExcelInput").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        routeRowsForSales = XLSX.utils.sheet_to_json(sheet, {
    defval: ""
}).filter(row => {

    const route =
        String(row["내원경로"] || "")
        .replace(/[\s\[\]]/g, "");

    return route !== "총계";
});
        makeRouteSalesTable();
    };

    reader.readAsArrayBuffer(file);
});

async function makeRouteSalesTable() {
    if (!dailyRowsForRoute || !routeRowsForSales) return;

    function cleanText(v) {
        return String(v || "")
            .replace(/\s/g, "")
            .replace(/\[/g, "")
            .replace(/\]/g, "")
            .trim();
    }

    function isTotalRow(row) {
        const allText = Object.values(row)
            .map(v => cleanText(v))
            .join("");

        return allText.includes("소계") || allText.includes("총계");
    }

    const salesMap = {};

    dailyRowsForRoute.forEach(row => {
        const chartNo = cleanText(row["챠트번호"]);

        const amount = Number(
            String(row["수납액"] || 0).replace(/,/g, "")
        );

        if (!chartNo) return;

        salesMap[chartNo] = (salesMap[chartNo] || 0) + amount;
    });

    const result = {};

    routeRowsForSales.forEach(row => {
        if (isTotalRow(row)) return;

        const chartNo = cleanText(row["차트번호"]);
        const route = String(row["내원경로"] || "").trim();

        if (!chartNo) return;
        if (!route || route === "-") return;

        if (!result[route]) {
            result[route] = {
                count: 0,
                sales: 0
            };
        }

        result[route].count++;
        result[route].sales += salesMap[chartNo] || 0;
    });

    deskExtraData.routeSales = result;
    await saveDeskExtra();

    renderRouteSalesTable(result);
}

function renderRouteSalesTable(result) {
    const tbody = document.querySelector("#routeSalesTable tbody");
    if (!tbody) return;

    const rows = Object.entries(result);

    const totalCount = rows.reduce((sum, [, row]) => sum + row.count, 0);
    const totalSales = rows.reduce((sum, [, row]) => sum + row.sales, 0);

    tbody.innerHTML = `
        ${rows
.filter(([route]) =>
    route.replace(/\s/g, "") !== "[총계]"
)
.map(([route, row]) => `
            <tr>
                <td>${route}</td>
                <td>${row.count}명</td>
                <td>${Number(row.sales || 0).toLocaleString("ko-KR")}원</td>
            </tr>
        `).join("")}

        <tr class="total-row">
            <td>합계</td>
            <td>${totalCount}명</td>
            <td>${totalSales.toLocaleString("ko-KR")}원</td>
        </tr>
    `;
}function clearRouteSalesTable() {
    const tbody =
        document.querySelector("#routeSalesTable tbody");

    if (!tbody) return;

    tbody.innerHTML = "";
}
function renderInsuranceTypeTable(types) {

    const tbody =
        document.querySelector("#insuranceTypeTable tbody");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td>${Number(types?.["국민건강보험"] || 0)}</td>

            <td>${Number(types?.["보호 1,2종"] || 0)}</td>

            <td>${Number(types?.["자보-청구분"] || 0)}</td>

            <td>${Number(types?.["일반"] || 0)}</td>

            <td>${Number(types?.["국민건강보험(차상위1종)"] || 0)}</td>

            <td>${Number(types?.["국민건강보험(차상위2종)"] || 0)}</td>
        </tr>
    `;
}

function clearInsuranceTypeTable() {

    const tbody =
        document.querySelector("#insuranceTypeTable tbody");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
            <td>0</td>
        </tr>
    `;
}

function makeClosingSummaryResult(rows) {
    const result = {
        new: 0,
        revisit: 0,
        new90: 0,
        noCalc: 0,
        total: 0,
        sales: 0
    };

    rows.forEach(row => {
        const visitType = String(row["초/재"] || "").trim();

        const pay =
            Number(String(row["수납액"] || 0).replace(/,/g, "")) || 0;

        if (visitType === "신환") result.new++;
        else if (visitType === "재진") result.revisit++;
        else if (visitType === "90일초진") result.new90++;

        if (pay === 0) result.noCalc++;

        result.sales += pay;
    });

    result.total =
        result.new +
        result.revisit +
        result.new90 +
        result.noCalc;

    return result;
}

function makeTimePeriodResult(rows) {
    const ageGroups = [
        "0~19", "20~29", "30~39",
        "40~49", "50~59", "60~69",
        "70~79", "80~89", "90~100"
    ];

    const result = {};

    ageGroups.forEach(group => {
        result[group] = {
            오전: 0,
            오후: 0,
            저녁: 0
        };
    });

    function getAgeFromJumin(jumin) {
        const value = String(jumin || "").replace(/[^0-9]/g, "");
        if (value.length < 7) return null;

        const yy = Number(value.slice(0, 2));
        const code = Number(value.slice(6, 7));

        if ([1, 2, 5, 6].includes(code)) return new Date().getFullYear() - (1900 + yy) + 1;
        if ([3, 4, 7, 8].includes(code)) return new Date().getFullYear() - (2000 + yy) + 1;

        return null;
    }

    function getAgeGroup(age) {
        if (age <= 19) return "0~19";
        if (age <= 29) return "20~29";
        if (age <= 39) return "30~39";
        if (age <= 49) return "40~49";
        if (age <= 59) return "50~59";
        if (age <= 69) return "60~69";
        if (age <= 79) return "70~79";
        if (age <= 89) return "80~89";
        return "90~100";
    }

    rows.forEach(row => {
        const timeValue = String(row["진료시작시간"] || "").trim();
        const age = getAgeFromJumin(row["주민번호"]);

        if (timeValue.length < 12 || age === null) return;

        const hour = Number(timeValue.slice(8, 10));
        const minute = Number(timeValue.slice(10, 12));
        const ageGroup = getAgeGroup(age);

        let period = "";

        if (hour >= 9 && hour < 12) period = "오전";
        else if (hour >= 12 && hour < 17) period = "오후";
        else if (hour === 17 || hour === 18 || (hour === 19 && minute <= 30)) period = "저녁";

        if (period) result[ageGroup][period]++;
    });

    return result;
}function makeInsuranceTypeResult(rows) {
    const types = {
        "국민건강보험": 0,
        "보호 1,2종": 0,
        "자보-청구분": 0,
        "일반": 0,
        "국민건강보험(차상위1종)": 0,
        "국민건강보험(차상위2종)": 0
    };

    rows.forEach(row => {
        const insurance = String(row["보험유형"] || "")
            .replace(/\s/g, "")
            .trim();

        if (insurance === "국민건강보험") {
            types["국민건강보험"]++;
        }

        else if (
            insurance === "보호1종" ||
            insurance === "보호2종"
        ) {
            types["보호 1,2종"]++;
        }

        else if (insurance === "자보-청구분") {
            types["자보-청구분"]++;
        }

        else if (insurance === "일반") {
            types["일반"]++;
        }

        else if (
            insurance === "국민건강보험(차상위1종)"
        ) {
            types["국민건강보험(차상위1종)"]++;
        }

        else if (
            insurance === "국민건강보험(차상위2종)"
        ) {
            types["국민건강보험(차상위2종)"]++;
        }
    });

    return types;
}