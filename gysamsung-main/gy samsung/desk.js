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
    memo: "",
    tempPayment: getDefaultTempPaymentData(),
    tempReservation: getDefaultTempReservationData(),
    tempOT: getDefaultTempOTData(),
    tempCleaning: getDefaultTempCleaningData()
};

function getDefaultTempPaymentData() {
    return {
        rows: Array.from({ length: 250 }, () => createTempPaymentEmptyRow()),
        expenses: [],
        firstList: "",
        blockList: ""
    };
}

function createTempPaymentEmptyRow() {
    return {
        chartNo: "",
        name: "",
        pay1: "",
        amount1: "",
        pay2: "",
        amount2: "",
        reservation: "1",
        memo: "",
        checked: false
    };
}

function getDefaultTempReservationData() {
    return {
        pasteRaw: "",
        rows: Array.from({ length: 300 }, () => createTempReservationEmptyRow())
    };
}

function createTempReservationEmptyRow() {
    return {
        chartNo: "",
        name: "",
        phone: "",
        room: "",
        doctor: "",
        insurance: "",
        reserveTime: "",
        statusText: "예약",
        subject: "",
        memo: "",
        resultCode: "",
        reason: "",
        cancelReason: "",
        note: "",
        checked: false
    };
}

function getDefaultTempOTData() {
    return {
        staffCount: 4,
        standardStart: "09:00",
        standardEnd: "18:30",
        rows: Array.from({ length: 4 }, () => createTempOTEmptyRow())
    };
}

function createTempOTEmptyRow() {
    return {
        name: "",
        start: "",
        end: "",
        breakMinutes: 0,
        memo: ""
    };
}

function getDefaultTempCleaningData() {
    return {
        cells: {},
        memo: ""
    };
}

function normalizeDeskExtraData(data = {}) {
    const temp = data.tempPayment || {};
    const defaultTemp = getDefaultTempPaymentData();
    const tempReservation = data.tempReservation || {};
    const defaultTempReservation = getDefaultTempReservationData();
    const tempOT = data.tempOT || {};
    const defaultTempOT = getDefaultTempOTData();
    const tempCleaning = data.tempCleaning || {};
    const defaultTempCleaning = getDefaultTempCleaningData();

    return {
        reservation: data.reservation || {},
        injectionReserve: data.injectionReserve || {},
        expense: data.expense || {},
        income: data.income || {},
        memo: data.memo || "",
        ...data,
        tempPayment: {
            ...defaultTemp,
            ...temp,
            rows: Array.isArray(temp.rows) && temp.rows.length
                ? [...temp.rows, ...Array.from({ length: Math.max(0, 250 - temp.rows.length) }, () => createTempPaymentEmptyRow())].slice(0, 250)
                : defaultTemp.rows,
            expenses: Array.isArray(temp.expenses) ? temp.expenses : []
        },
        tempReservation: {
            ...defaultTempReservation,
            ...tempReservation,
            rows: Array.isArray(tempReservation.rows) && tempReservation.rows.length
                ? [...tempReservation.rows, ...Array.from({ length: Math.max(0, 300 - tempReservation.rows.length) }, () => createTempReservationEmptyRow())].slice(0, 300)
                : defaultTempReservation.rows
        },
        tempOT: {
            ...defaultTempOT,
            ...tempOT,
            rows: Array.isArray(tempOT.rows) && tempOT.rows.length
                ? tempOT.rows
                : defaultTempOT.rows
        },
        tempCleaning: {
            ...defaultTempCleaning,
            ...tempCleaning,
            cells: tempCleaning.cells && typeof tempCleaning.cells === "object" ? tempCleaning.cells : {}
        }
    };
}

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

function getTempLocalDateBarHtml(prefix) {
    return `
        <div class="temp-local-date-bar" data-prefix="${prefix}">
            <button type="button" class="temp-date-btn" id="${prefix}PrevDay">◀</button>
            <div class="temp-date-box">
                <select id="${prefix}Year"></select>
                <select id="${prefix}Month"></select>
                <select id="${prefix}Day"></select>
            </div>
            <button type="button" class="temp-date-btn" id="${prefix}NextDay">▶</button>
        </div>
    `;
}

function setupTempLocalDateControls(prefix) {
    const localYear = document.getElementById(`${prefix}Year`);
    const localMonth = document.getElementById(`${prefix}Month`);
    const localDay = document.getElementById(`${prefix}Day`);
    const prevBtn = document.getElementById(`${prefix}PrevDay`);
    const nextBtn = document.getElementById(`${prefix}NextDay`);

    if (!localYear || !localMonth || !localDay) return;

    localYear.innerHTML = "";
    localMonth.innerHTML = "";

    for (let y = 2024; y <= 2035; y++) {
        localYear.innerHTML += `<option value="${y}">${y}년</option>`;
    }

    for (let m = 1; m <= 12; m++) {
        localMonth.innerHTML += `<option value="${m}">${m}월</option>`;
    }

    function renderLocalDays() {
        const selectedDay = Number(localDay.value || daySelect.value || 1);
        const lastDay = new Date(
            Number(localYear.value),
            Number(localMonth.value),
            0
        ).getDate();

        localDay.innerHTML = "";

        for (let d = 1; d <= lastDay; d++) {
            localDay.innerHTML += `<option value="${d}">${d}일</option>`;
        }

        localDay.value = Math.min(selectedDay, lastDay);
    }

    function syncFromMainDate() {
        localYear.value = yearSelect.value;
        localMonth.value = monthSelect.value;
        renderLocalDays();
        localDay.value = daySelect.value;
    }

    async function applyLocalDate() {
        yearSelect.value = localYear.value;
        monthSelect.value = localMonth.value;
        currentDay = Number(localDay.value);

        updateDays();
        daySelect.value = currentDay;

        await reloadDeskPage();
    }

    function moveLocalDate(diff) {
        const date = new Date(
            Number(localYear.value),
            Number(localMonth.value) - 1,
            Number(localDay.value)
        );

        date.setDate(date.getDate() + diff);

        localYear.value = date.getFullYear();
        localMonth.value = date.getMonth() + 1;
        renderLocalDays();
        localDay.value = date.getDate();

        applyLocalDate();
    }

    syncFromMainDate();

    localYear.onchange = () => {
        renderLocalDays();
        localDay.value = "1";
        applyLocalDate();
    };

    localMonth.onchange = () => {
        renderLocalDays();
        localDay.value = "1";
        applyLocalDate();
    };

    localDay.onchange = applyLocalDate;

    if (prevBtn) prevBtn.onclick = () => moveLocalDate(-1);
    if (nextBtn) nextBtn.onclick = () => moveLocalDate(1);
}


/* =========================
   저장 / 불러오기
========================= */

async function loadDeskStorage() {
    const key = getDateKey();

    const snap = await getDoc(doc(db, "closings", key));
    const data = snap.exists() ? snap.data() : {};

    deskData = data.deskData || {};

    deskExtraData = normalizeDeskExtraData(data.deskExtraData || {});
}

async function saveDeskData(roomNum, field, value) {

    if (!deskData[`room${roomNum}`]) {
        deskData[`room${roomNum}`] = {};
    }

    deskData[`room${roomNum}`][field] =
        Number(value) || 0;

    await setDoc(
        doc(db, "closings", getDateKey()),
        {
            deskData: deskData,
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
        if (!deskExtraData.injectionReserve) {
    deskExtraData.injectionReserve = {};
}
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
     console.log("불러오는 날짜:", getDateKey());

    await loadDeskStorage();
    renderRooms();
    setupExtraInputs();
    renderTempPayment();
    renderTempReservation();
    renderTempOT();
    renderTempCleaning();

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

daySelect.addEventListener("change", () => {
    currentDay = Number(daySelect.value);
    reloadDeskPage();
});

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

        const rows = getRowsFromDailySheet(sheet);
        const timeChart = makeTimePeriodResult(rows);
const insuranceType = makeInsuranceTypeResult(rows);
const summary = makeClosingSummaryResult(rows);

dailyRowsForRoute = rows;

deskExtraData.timeChart = timeChart;
        deskExtraData.insuranceType = insuranceType;
        deskExtraData.summary = summary;

        const saveKey = getDateKey();

if (!confirm(`${saveKey} 날짜에 저장할까요?`)) {
    return;
}

await setDoc(
    doc(db, "closings", saveKey),
    {
        deskExtraData: deskExtraData
    },
    { merge: true }
);

        drawTimePeriodChart(timeChart);
        renderInsuranceTypeTable(insuranceType);
        if (routeRowsForSales) {
    await makeRouteSalesTable();
}

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

    reader.onload = async function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        routeRowsForSales = XLSX.utils.sheet_to_json(sheet, {
            defval: ""
        }).filter(row => {
            const route = String(row["내원경로"] || "")
                .replace(/[\s\[\]]/g, "");

            return route !== "총계";
        });

        if (!dailyRowsForRoute) {
            alert("일일 환자 집계를 먼저 업로드해주세요.");
            return;
        }

        await makeRouteSalesTable();

        alert("내원경로 엑셀 업로드 완료");
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
        const chartNo = cleanText(row["챠트번호"] || row["차트번호"]);

        const amount = Number(
            String(row["수납액"] || 0).replace(/,/g, "")
        );

        if (!chartNo) return;

        salesMap[chartNo] = (salesMap[chartNo] || 0) + amount;
    });

    const result = {};

    routeRowsForSales.forEach(row => {
        if (isTotalRow(row)) return;

        const chartNo = cleanText(row["차트번호"] || row["챠트번호"]);
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
const saveKey = getDateKey();

if (!confirm(`${saveKey} 날짜에 저장할까요?`)) {
    return;
}
    deskExtraData.routeSales = result;
    await saveDeskExtra();

    renderRouteSalesTable(result);
}

function renderRouteSalesTable(result) {
    const tbody = document.querySelector("#routeSalesTable tbody");
    if (!tbody) return;

    const rows = Object.entries(result);

    const totalCount = rows.reduce((sum, [, row]) => sum + row.count, 0);
    

    tbody.innerHTML = `
    ${rows
.filter(([route]) =>
    route.replace(/\s/g, "") !== "[총계]"
)
.map(([route, row]) => `
        <tr>
            <td>${route}</td>
            <td>${row.count}명</td>
        </tr>
    `).join("")}

    <tr class="total-row">
        <td>합계</td>
        <td>${totalCount}명</td>
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
    therapyVisit: 0,
    total: 0,
    sales: 0,

    newSales: 0,
    revisitSales: 0,
    new90Sales: 0,
    therapyVisitSales: 0,
    noCalcSales: 0
};

    rows.forEach(row => {
        const visitType = String(row["초/재"] || row["초재진구분"] || "").trim();

        const pay =
            Number(String(row["수납액"] || 0).replace(/,/g, "")) || 0;

        if (visitType === "신환") {
            result.new++;
            result.newSales += pay;
        }

        else if (visitType === "재진") {
            result.revisit++;
            result.revisitSales += pay;
        }

        else if (visitType === "90일초진") {
            result.new90++;
            result.new90Sales += pay;
        }

        else if (visitType === "진찰료 산정안함") {
    result.noCalc++;
    result.noCalcSales += pay;
}

        else if (visitType === "물리치료내원") {
    result.therapyVisit++;
    result.therapyVisitSales += pay;
}
        result.sales += pay;
    });

    result.total =
        result.new +
        result.revisit +
        result.new90 +
        result.noCalc +
        result.therapyVisit;

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

  
    if (!timeValue || age === null) return;

    

    let hour = null;
    let minute = 0;

    const timeMatch = timeValue.match(/(\d{1,2}):(\d{2})/);

    if (timeMatch) {
        hour = Number(timeMatch[1]);
        minute = Number(timeMatch[2]);
    } else if (timeValue.length >= 12) {
        hour = Number(timeValue.slice(8, 10));
        minute = Number(timeValue.slice(10, 12));
    }

    if (hour === null || Number.isNaN(hour)) return;

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
}function getRowsFromDailySheet(sheet) {
    const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
    });

    const headerIndex = raw.findIndex(row =>
        row.map(v => String(v).trim()).includes("주민번호") &&
        row.map(v => String(v).trim()).includes("진료시작시간")
    );

    if (headerIndex === -1) {
        alert("일일 환자 집계 엑셀에서 주민번호/진료시작시간 헤더를 찾지 못했습니다.");
        return [];
    }

    const headers = raw[headerIndex].map(v =>
        String(v).trim()
    );

    return raw.slice(headerIndex + 1)
        .map(row => {
            const obj = {};

            headers.forEach((header, index) => {
                if (header) {
                    obj[header] = row[index] ?? "";
                }
            });

            return obj;
        })
        .filter(row =>
            Object.values(row).some(v => String(v).trim() !== "")
        );
}

/* =========================
   임시1 - 수납관리 직접입력
========================= */

const TEMP_PAY_TYPES = {
    "": "선택",
    "1": "현금",
    "2": "카드",
    "3": "미수",
    "4": "미수입금(현금)",
    "5": "미수입금(카드)",
    "6": "계좌이체"
};

const TEMP_EXPENSE_TYPES = {
    "1": "현금",
    "2": "카드",
    "3": "기타"
};

const TEMP_RESERVATIONS = {
    "1": "X",
    "2": "주사경과만",
    "3": "주사만",
    "4": "주사경과+주사",
    "5": "이외예약O",
    "6": "비급여"
};

function tempPaymentContainer() {
    return document.getElementById("desk-temp1") ||
        document.getElementById("temp1") ||
        document.getElementById("imsi1") ||
        document.getElementById("temporary1") ||
        document.getElementById("임시1") ||
        document.querySelector('[data-tab-page="temp1"]') ||
        document.querySelector('[data-page="temp1"]');
}

function tempClean(value) {
    return String(value ?? "").trim();
}

function tempChartClean(value) {
    return tempClean(value).replace(/[^0-9]/g, "");
}

function tempNum(value) {
    return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
}

function tempWon(value) {
    return `${Math.round(tempNum(value)).toLocaleString("ko-KR")}원`;
}

function tempPct(value) {
    return `${((Number.isFinite(value) ? value : 0) * 100).toFixed(1)}%`;
}

function tempOptionHtml(map, valueTextOnly = false) {
    return Object.entries(map).map(([value, label]) => {
        const text = valueTextOnly || value === "" ? label : `${value}. ${label}`;
        return `<option value="${value}">${text}</option>`;
    }).join("");
}

function applyTempPaySelectColor(select) {
    if (!select) return;

    select.classList.remove(
        "pay-empty",
        "pay-cash",
        "pay-card",
        "pay-unpaid",
        "pay-unpaid-cash",
        "pay-unpaid-card",
        "pay-transfer"
    );

    const classMap = {
        "": "pay-empty",
        "1": "pay-cash",
        "2": "pay-card",
        "3": "pay-unpaid",
        "4": "pay-unpaid-cash",
        "5": "pay-unpaid-card",
        "6": "pay-transfer"
    };

    select.classList.add(classMap[select.value] || "pay-empty");
}

function getTempPaymentData() {
    if (!deskExtraData.tempPayment) {
        deskExtraData.tempPayment = getDefaultTempPaymentData();
    }

    deskExtraData.tempPayment = normalizeDeskExtraData({
        tempPayment: deskExtraData.tempPayment
    }).tempPayment;

    return deskExtraData.tempPayment;
}

function renderTempPayment() {
    const container = tempPaymentContainer();
    if (!container) return;

    injectTempPaymentStyle();
    getTempPaymentData();

    container.innerHTML = `
        <section class="temp-payment-page">
            <div class="temp-payment-head">
                <div>
                    <p class="temp-eyebrow">DAILY PAYMENT LEDGER</p>
                    <h2>수납관리</h2>
                    <p>차트번호, 이름, 결제수단, 금액, 예약항목만 입력하면 자동 계산됩니다.</p>
                </div>
                <div class="temp-payment-actions">
                    <button type="button" id="tempPaymentSaveBtn">저장</button>
                    <button type="button" id="tempPaymentClearBtn" class="danger">초기화</button>
                    <button type="button" id="tempPaymentCsvBtn" class="ghost">CSV 저장</button>
                    <button type="button" id="tempPaymentPrintBtn" class="ghost">인쇄</button>
                </div>
            </div>

            ${getTempLocalDateBarHtml("tempPayment")}

            <div class="temp-summary-grid">
                <article><span>수납건수</span><strong id="tempPayCount">0건</strong></article>
                <article><span>현금①</span><strong id="tempCashTotal">0건 / 0원</strong></article>
                <article><span>카드②</span><strong id="tempCardTotal">0건 / 0원</strong></article>
                <article><span>미수입금(현금)③</span><strong id="tempUnpaidCashTotal">0건 / 0원</strong></article>
                <article><span>미수입금(카드)④</span><strong id="tempUnpaidCardTotal">0건 / 0원</strong></article>
                <article><span>현금입금①+③-⑤</span><strong id="tempCashDeposit">0원</strong></article>
                <article><span>현금지출⑤</span><strong id="tempCashExpenseTotal">0건 / 0원</strong></article>
                <article><span>카드지출</span><strong id="tempCardExpenseTotal">0건 / 0원</strong></article>
                <article><span>미수발생</span><strong id="tempUnpaidTotal">0건 / 0원</strong></article>
                <article><span>계좌이체</span><strong id="tempTransferTotal">0건 / 0원</strong></article>
                <article><span>예약오류</span><strong id="tempErrorTotal">0건</strong></article>
                <article><span>PT만</span><strong id="tempPtOnlyTotal">0건</strong></article>
                <article><span>총환자 예약률</span><strong id="tempTotalRate">0.0%</strong></article>
                <article><span>초진 / 재진 예약률</span><strong id="tempFirstRevisitRate">0.0% / 0.0%</strong></article>
            </div>

            <div class="temp-stats-box">
                <div class="temp-mini-card"><h3>초진</h3><table><tbody id="tempFirstSummaryBody"></tbody></table></div>
                <div class="temp-mini-card"><h3>재진</h3><table><tbody id="tempRevisitSummaryBody"></tbody></table></div>
                <div class="temp-mini-card"><h3>초진 X Block</h3><table><tbody id="tempFirstBlockSummaryBody"></tbody></table></div>
                <div class="temp-mini-card"><h3>재진 X Block</h3><table><tbody id="tempRevisitBlockSummaryBody"></tbody></table></div>
                <div class="temp-mini-card"><h3>예약률 (%)</h3><table><tbody id="tempRateSummaryBody"></tbody></table></div>
            </div>

            <div class="temp-payment-layout">
                <aside class="temp-side-box">
                    <h3>자동판정 목록</h3>
                    <p>비트에서 차트번호만 복사해서 붙여넣으면 초진/Block이 자동 체크됩니다.</p>
                    <div class="temp-list-pair">
                        <label>초진 차트번호</label>
                        <textarea id="tempFirstList" placeholder="11524\n11523\n11522"></textarea>
                    </div>
                    <div class="temp-list-pair">
                        <label>Block 차트번호</label>
                        <textarea id="tempBlockList" placeholder="11068\n11194\n2171"></textarea>
                    </div>
                    <div class="temp-side-line"></div>
                    <div class="temp-side-title-row">
                        <h3>지출</h3>
                        <button type="button" id="tempAddExpenseBtn">추가</button>
                    </div>
                    <div id="tempExpenseBox"></div>
                </aside>

                <section class="temp-table-box">
                    <div class="temp-table-title">
                        <h3>수납 입력</h3>
                    </div>
                    <table id="tempPaymentTable">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>차트번호</th>
                                <th>이름</th>
                                <th>결제수단</th>
                                <th>금액</th>
                                <th>추가수단</th>
                                <th>추가금액</th>
                                <th>예약</th>
                                <th>비고</th>
                                <th>초진</th>
                                <th>Block</th>
                                <th>예약오류</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </section>
            </div>
        </section>
    `;

    document.getElementById("tempPaymentSaveBtn").onclick = async () => {
        await saveDeskExtra();
        alert("수납관리 저장 완료");
    };

    document.getElementById("tempPaymentClearBtn").onclick = async () => {
        if (!confirm("수납관리 입력값을 초기화할까요?")) return;
        deskExtraData.tempPayment = getDefaultTempPaymentData();
        await saveDeskExtra();
        renderTempPayment();
    };

    document.getElementById("tempPaymentCsvBtn").onclick = exportTempPaymentCsv;
    document.getElementById("tempPaymentPrintBtn").onclick = () => window.print();
    setupTempLocalDateControls("tempPayment");
    const addRowBtn = document.getElementById("tempAddRowBtn");
    if (addRowBtn) {
        addRowBtn.onclick = () => {
            getTempPaymentData().rows.push(createTempPaymentEmptyRow());
            renderTempPaymentRows();
        };
    }
    document.getElementById("tempAddExpenseBtn").onclick = () => {
        getTempPaymentData().expenses.push({ type: "1", amount: "" });
        renderTempExpenses();
        calculateTempPayment();
    };

    document.getElementById("tempFirstList").value = getTempPaymentData().firstList || "";
    document.getElementById("tempBlockList").value = getTempPaymentData().blockList || "";

    document.getElementById("tempFirstList").oninput = function () {
        getTempPaymentData().firstList = this.value;
        calculateTempPayment();
        saveDeskExtra();
    };

    document.getElementById("tempBlockList").oninput = function () {
        getTempPaymentData().blockList = this.value;
        calculateTempPayment();
        saveDeskExtra();
    };

    renderTempPaymentRows();
}

function renderTempPaymentRows() {
    const tbody = document.querySelector("#tempPaymentTable tbody");
    if (!tbody) return;

    const data = getTempPaymentData();
    tbody.innerHTML = "";

    data.rows.forEach((row, index) => {
        const tr = document.createElement("tr");
        tr.classList.toggle("checked-row", Boolean(row.checked));

        tr.innerHTML = `
            <td class="temp-row-no" title="클릭하면 확인 표시">${row.checked ? `${index + 1}(확인)` : index + 1}</td>
            <td><input class="temp-chart-no" inputmode="numeric"></td>
            <td><input class="temp-name"></td>
            <td><select class="temp-pay1">${tempOptionHtml(TEMP_PAY_TYPES, true)}</select></td>
            <td><input class="temp-amount1" type="number" min="0" step="100"></td>
            <td><select class="temp-pay2">${tempOptionHtml(TEMP_PAY_TYPES, true)}</select></td>
            <td><input class="temp-amount2" type="number" min="0" step="100"></td>
            <td><select class="temp-reservation">${tempOptionHtml(TEMP_RESERVATIONS)}</select></td>
            <td><input class="temp-memo" placeholder="pt / pt만 / 진료 등"></td>
            <td class="temp-first-cell"></td>
            <td class="temp-block-cell"></td>
            <td class="temp-error-cell"></td>
            <td><button type="button" class="temp-delete-row danger">삭제</button></td>
        `;

        tr.querySelector(".temp-row-no").onclick = async () => {
            row.checked = !row.checked;
            renderTempPaymentRows();
            await saveDeskExtra();
        };

        const bindings = [
            ["chartNo", ".temp-chart-no"],
            ["name", ".temp-name"],
            ["amount1", ".temp-amount1"],
            ["amount2", ".temp-amount2"],
            ["memo", ".temp-memo"],
            ["pay1", ".temp-pay1"],
            ["pay2", ".temp-pay2"],
            ["reservation", ".temp-reservation"]
        ];

        bindings.forEach(([key, selector]) => {
            const input = tr.querySelector(selector);
            input.value = row[key] ?? (key === "reservation" ? "1" : "");

            if (key === "pay1" || key === "pay2") {
                applyTempPaySelectColor(input);
            }

            input.oninput = input.onchange = () => {
                row[key] = input.value;

                if (key === "pay1" || key === "pay2") {
                    applyTempPaySelectColor(input);
                }

                calculateTempPayment();
                saveDeskExtra();
            };
        });

        tr.querySelector(".temp-delete-row").onclick = async () => {
            data.rows.splice(index, 1);
            renderTempPaymentRows();
            await saveDeskExtra();
        };

        tbody.appendChild(tr);
    });

    renderTempExpenses();
    calculateTempPayment();
}

function renderTempExpenses() {
    const box = document.getElementById("tempExpenseBox");
    if (!box) return;

    const data = getTempPaymentData();
    box.innerHTML = "";

    data.expenses.forEach((expense, index) => {
        const row = document.createElement("div");
        row.className = "temp-expense-row";
        row.innerHTML = `
            <select>${tempOptionHtml(TEMP_EXPENSE_TYPES, true)}</select>
            <input type="number" min="0" step="100" placeholder="금액">
            <button type="button" class="danger">삭제</button>
        `;

        const type = row.querySelector("select");
        const amount = row.querySelector("input");

        type.value = expense.type || "1";
        amount.value = expense.amount || "";

        type.onchange = async () => {
            expense.type = type.value;
            calculateTempPayment();
            await saveDeskExtra();
        };

        amount.oninput = async () => {
            expense.amount = amount.value;
            calculateTempPayment();
            await saveDeskExtra();
        };

        row.querySelector("button").onclick = async () => {
            data.expenses.splice(index, 1);
            renderTempExpenses();
            calculateTempPayment();
            await saveDeskExtra();
        };

        box.appendChild(row);
    });
}

function tempListSet(text) {
    return new Set(tempClean(text).split(/\s+/).map(tempChartClean).filter(Boolean));
}

function isTempReserved(row) {
    return !["1", "6", ""].includes(row.reservation);
}

function isTempPtOnly(row) {
    const amount = tempNum(row.amount1);
    const memo = tempClean(row.memo).toLowerCase();
    const noJinryo = !memo.includes("진료");
    const hasPtText = /(^|[^a-zA-Z0-9가-힣])pt(만)?([^a-zA-Z0-9가-힣]|$)/i.test(memo);

    return noJinryo && ([1900, 6200, 7000].includes(amount) || (amount === 0 && hasPtText));
}

function computedTempRows() {
    const data = getTempPaymentData();
    const firstSet = tempListSet(data.firstList);
    const blockSet = tempListSet(data.blockList);
    const chartCount = new Map();
    const nameCount = new Map();

    data.rows.forEach(row => {
        const chart = tempChartClean(row.chartNo);
        const name = tempClean(row.name);
        if (chart) chartCount.set(chart, (chartCount.get(chart) || 0) + 1);
        if (name) nameCount.set(name, (nameCount.get(name) || 0) + 1);
    });

    return data.rows.map(row => {
        const chart = tempChartClean(row.chartNo);
        const name = tempClean(row.name);
        const hasPatient = Boolean(chart || name);
        const isFirst = chart ? firstSet.has(chart) : false;
        const isBlock = chart ? blockSet.has(chart) : false;
        const duplicate = (chart && chartCount.get(chart) > 1) || (name && nameCount.get(name) > 1);

        let error = "";
        if (hasPatient && !row.reservation) error = "예약누락";
        if (hasPatient && duplicate) error = "환자 1명당 예약 1번만!";

        return { ...row, chart, name, hasPatient, isFirst, isBlock, error };
    });
}

function tempAddPay(stats, type, amount) {
    if (!type) return;
    if (!stats[type]) stats[type] = { count: 0, sum: 0 };
    stats[type].count += 1;
    stats[type].sum += tempNum(amount);
}

function tempCodeCounts(rows) {
    const counts = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
    rows.forEach(row => {
        const code = TEMP_RESERVATIONS[row.reservation] ? row.reservation : "1";
        counts[code] += 1;
    });
    return counts;
}

function renderTempCountTable(selector, rows) {
    const body = document.querySelector(selector);
    if (!body) return;

    const counts = tempCodeCounts(rows);
    body.innerHTML = Object.entries(TEMP_RESERVATIONS).map(([code, label]) => `
        <tr><td>${code}</td><td>${label}</td><td>${counts[code]}</td></tr>
    `).join("") + `<tr class="total-row"><td></td><td>Total</td><td>${rows.length}</td></tr>`;
}

function tempPercentText(numerator, denominator) {
    return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : "0.0%";
}

function renderTempRateTable(groups) {
    const { patients, firstPatients, revisitPatients, firstBlockPatients, revisitBlockPatients, blockPatients } = groups;
    const reservedCount = rows => rows.filter(isTempReserved).length;
    const gyeonggwaCount = rows => rows.filter(row => ["2", "4"].includes(row.reservation)).length;
    const injectionCount = rows => rows.filter(row => ["3", "4"].includes(row.reservation)).length;

    const rows = [
        ["총환자", "초진", tempPercentText(reservedCount(firstPatients), firstPatients.length)],
        ["", "재진", tempPercentText(reservedCount(revisitPatients), revisitPatients.length)],
        ["", "Total", tempPercentText(reservedCount(patients), patients.length)],
        ["주사", "초진 경과", tempPercentText(gyeonggwaCount(firstBlockPatients), firstBlockPatients.length)],
        ["", "초진 주사", tempPercentText(injectionCount(firstBlockPatients), firstBlockPatients.length)],
        ["", "재진 경과", tempPercentText(gyeonggwaCount(revisitBlockPatients), revisitBlockPatients.length)],
        ["", "재진 주사", tempPercentText(injectionCount(revisitBlockPatients), revisitBlockPatients.length)],
        ["Total", "경과", tempPercentText(gyeonggwaCount(blockPatients), blockPatients.length)],
        ["", "주사", tempPercentText(injectionCount(blockPatients), blockPatients.length)]
    ];

    const body = document.getElementById("tempRateSummaryBody");
    if (!body) return;
    body.innerHTML = rows.map(([a, b, c]) => `
        <tr>
            <td class="rate-group">${a || "&nbsp;"}</td>
            <td class="rate-label">${b}</td>
            <td class="rate-value">${c}</td>
        </tr>
    `).join("");
}

function syncTempPaymentToInjectionReserve(firstBlockPatients, revisitBlockPatients) {
    if (!deskExtraData.injectionReserve) {
        deskExtraData.injectionReserve = {};
    }

    const rowNames = ["X", "주사경과만", "주사만", "주사경과+주사", "이외예약O"];
    const firstCol = "초진 X block";
    const revisitCol = "재진 X block";

    rowNames.forEach((name, index) => {
        const code = String(index + 1);
        if (!deskExtraData.injectionReserve[name]) {
            deskExtraData.injectionReserve[name] = {};
        }

        deskExtraData.injectionReserve[name][firstCol] =
            firstBlockPatients.filter(row => row.reservation === code).length;
        deskExtraData.injectionReserve[name][revisitCol] =
            revisitBlockPatients.filter(row => row.reservation === code).length;
    });

    const mainRows = document.querySelectorAll(".desk-section:nth-of-type(3) tbody tr");
    const cols = [firstCol, revisitCol];

    mainRows.forEach(tr => {
        const name = tr.querySelector("td")?.textContent.trim();
        const inputs = tr.querySelectorAll("input");
        const values = deskExtraData.injectionReserve[name];

        if (!values) return;

        inputs.forEach((input, index) => {
            const col = cols[index];
            input.value = values[col] ?? 0;
            input.readOnly = true;
            input.title = "임시1 수납관리에서 자동 연동됩니다.";
        });
    });
}

function calculateTempPayment() {
    if (!tempPaymentContainer()) return;

    const data = computedTempRows();
    const stats = {};
    Object.keys(TEMP_PAY_TYPES).forEach(key => {
        if (key) stats[key] = { count: 0, sum: 0 };
    });

    data.forEach(row => {
        tempAddPay(stats, row.pay1, row.amount1);
        tempAddPay(stats, row.pay2, row.amount2);
    });

    const patients = data.filter(row => row.hasPatient);
    const firstPatients = patients.filter(row => row.isFirst);
    const revisitPatients = patients.filter(row => !row.isFirst);
    const firstBlockPatients = firstPatients.filter(row => row.isBlock);
    const revisitBlockPatients = revisitPatients.filter(row => row.isBlock);
    const blockPatients = patients.filter(row => row.isBlock);
    const rate = rows => rows.length ? rows.filter(isTempReserved).length / rows.length : 0;
    const expenseStats = {
        "1": { count: 0, sum: 0 },
        "2": { count: 0, sum: 0 },
        "3": { count: 0, sum: 0 }
    };

    getTempPaymentData().expenses.forEach(expense => {
        const type = expense.type || "1";
        if (!expenseStats[type]) expenseStats[type] = { count: 0, sum: 0 };
        if (tempNum(expense.amount) > 0) {
            expenseStats[type].count += 1;
            expenseStats[type].sum += tempNum(expense.amount);
        }
    });

    const cashExpense = expenseStats["1"].sum;
    const ptOnlyCount = data.filter(row => row.hasPatient && isTempPtOnly(row)).length;

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setText("tempPayCount", `${Object.values(stats).reduce((sum, row) => sum + row.count, 0)}건`);
    setText("tempCashTotal", `${stats["1"].count}건 / ${tempWon(stats["1"].sum)}`);
    setText("tempCardTotal", `${stats["2"].count}건 / ${tempWon(stats["2"].sum)}`);
    setText("tempUnpaidCashTotal", `${stats["4"].count}건 / ${tempWon(stats["4"].sum)}`);
    setText("tempUnpaidCardTotal", `${stats["5"].count}건 / ${tempWon(stats["5"].sum)}`);
    setText("tempCashDeposit", tempWon(stats["1"].sum + stats["4"].sum - cashExpense));
    setText("tempCashExpenseTotal", `${expenseStats["1"].count}건 / ${tempWon(expenseStats["1"].sum)}`);
    setText("tempCardExpenseTotal", `${expenseStats["2"].count}건 / ${tempWon(expenseStats["2"].sum)}`);
    setText("tempUnpaidTotal", `${stats["3"].count}건 / ${tempWon(stats["3"].sum)}`);
    setText("tempTransferTotal", `${stats["6"].count}건 / ${tempWon(stats["6"].sum)}`);
    setText("tempErrorTotal", `${data.filter(row => row.error).length}건`);
    setText("tempPtOnlyTotal", `${ptOnlyCount}건`);
    setText("tempTotalRate", tempPct(rate(patients)));
    setText("tempFirstRevisitRate", `${tempPct(rate(firstPatients))} / ${tempPct(rate(revisitPatients))}`);

    renderTempCountTable("#tempFirstSummaryBody", firstPatients);
    renderTempCountTable("#tempRevisitSummaryBody", revisitPatients);
    renderTempCountTable("#tempFirstBlockSummaryBody", firstBlockPatients);
    renderTempCountTable("#tempRevisitBlockSummaryBody", revisitBlockPatients);
    renderTempRateTable({ patients, firstPatients, revisitPatients, firstBlockPatients, revisitBlockPatients, blockPatients });
    syncTempPaymentToInjectionReserve(firstBlockPatients, revisitBlockPatients);

    document.querySelectorAll("#tempPaymentTable tbody tr").forEach((tr, index) => {
        const row = data[index];
        tr.querySelector(".temp-first-cell").textContent = row.isFirst ? "✓" : "";
        tr.querySelector(".temp-block-cell").textContent = row.isBlock ? "✓" : "";
        tr.querySelector(".temp-error-cell").textContent = row.error;
        tr.querySelector(".temp-first-cell").classList.toggle("true", row.isFirst);
        tr.querySelector(".temp-block-cell").classList.toggle("true", row.isBlock);
    });
}

function exportTempPaymentCsv() {
    const data = computedTempRows();
    const header = ["no", "confirm", "chartNo", "name", "pay1", "amount1", "pay2", "amount2", "reservation", "memo", "first", "block", "error"];
    const lines = [header.join(",")];

    data.filter(row => row.hasPatient || row.pay1 || row.pay2).forEach((row, index) => {
        const values = [
            index + 1,
            row.checked ? "확인" : "",
            row.chart,
            row.name,
            TEMP_PAY_TYPES[row.pay1] || "",
            row.amount1,
            TEMP_PAY_TYPES[row.pay2] || "",
            row.amount2,
            TEMP_RESERVATIONS[row.reservation] || "",
            row.memo,
            row.isFirst ? "TRUE" : "FALSE",
            row.isBlock ? "TRUE" : "FALSE",
            row.error
        ];
        lines.push(values.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","));
    });

    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `수납관리_${getDateKey()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function injectTempPaymentStyle() {
    const oldStyle = document.getElementById("tempPaymentStyle");
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = "tempPaymentStyle";
    style.textContent = `
        #desk-temp1 { overflow: hidden !important; }
        #desk-temp1 .desk-card { padding: 0 !important; }

        .temp-payment-page {
            width: 100%;
            max-width: 100%;
            overflow: hidden;
            box-sizing: border-box;
            padding: 8px 0 0;
            color: #2d241c;
        }

        .temp-payment-head {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            align-items: flex-start;
            margin-bottom: 14px;
            padding: 16px 18px;
            border: 1px solid #eadbbe;
            border-radius: 16px;
            background: rgba(255,255,255,.96);
            box-shadow: 0 8px 18px rgba(77,52,22,.05);
        }
        .temp-payment-head h2 { margin: 0 0 4px; font-size: 26px; line-height: 1.1; }
        .temp-payment-head p { margin: 0; color: #8b7b68; font-size: 14px; }
        .temp-eyebrow { font-size: 11px; font-weight: 900; letter-spacing: .18em; color: #c49a44 !important; }
        .temp-payment-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .temp-payment-page button { border: 0; border-radius: 10px; background: #c9a34d; color: #fff; font-weight: 900; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
        .temp-payment-page button.ghost { background: #fff; color: #7a6030; border: 1px solid #e8d8b8; }
        .temp-payment-page button.danger, .temp-payment-page .danger { background: #d94a3f; color: #fff; }

        .temp-summary-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 12px;
            width: 100%;
        }
        .temp-summary-grid article {
            min-width: 0;
            background: rgba(255,255,255,.94);
            border: 1px solid #eadbbe;
            border-radius: 13px;
            padding: 9px 8px;
            box-shadow: 0 8px 18px rgba(77,52,22,.05);
        }
        .temp-summary-grid span {
            display: block;
            font-size: 12px;
            font-weight: 900;
            color: #8b7b68;
            margin-bottom: 5px;
            line-height: 1.25;
            min-height: 0;
            word-break: keep-all;
        }
        .temp-summary-grid strong { font-size: 17px; color: #221b16; white-space: nowrap; letter-spacing: -0.03em; }

        .temp-stats-box {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 12px;
            width: 100%;
        }
        .temp-mini-card, .temp-side-box, .temp-table-box {
            min-width: 0;
            background: rgba(255,255,255,.94);
            border: 1px solid #eadbbe;
            border-radius: 15px;
            box-shadow: 0 10px 22px rgba(77,52,22,.06);
            box-sizing: border-box;
        }
        .temp-mini-card { padding: 10px 11px; }
        .temp-mini-card h3, .temp-side-box h3, .temp-table-title h3 { margin: 0 0 8px; font-size: 17px; font-weight: 900; }
        .temp-mini-card table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
        .temp-mini-card td { border-bottom: 1px solid #eee3cf; padding: 3px 2px; white-space: nowrap; }
        .temp-mini-card td:first-child { width: 22px; }
        .temp-mini-card td:last-child { text-align: right; font-weight: 900; width: 34px; }
        #tempRateSummaryBody { width: 100%; }
        #tempRateSummaryBody td { font-size: 11px; line-height: 1.35; word-break: keep-all; white-space: nowrap; box-sizing: border-box; }
        #tempRateSummaryBody .rate-group { width: 32%; color: #2d241c; overflow: hidden; text-overflow: clip; }
        #tempRateSummaryBody .rate-label { width: 38%; text-align: center; padding-left: 0; overflow: hidden; text-overflow: clip; }
        #tempRateSummaryBody .rate-value { width: 30%; text-align: right; font-weight: 900; padding-right: 4px; overflow: hidden; }

        .temp-payment-layout {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            align-items: flex-start;
            width: 100%;
        }
        .temp-side-box { padding: 14px; }
        .temp-side-box p { margin: 0 0 10px; color: #8b7b68; font-size: 13px; line-height: 1.45; }
        .temp-side-box label { display: block; margin: 0 0 7px; font-weight: 900; min-height: 24px; line-height: 24px; }
        .temp-side-box textarea { width: 100%; height: 88px; min-height: 88px; border: 1px solid #eadbbe; border-radius: 12px; padding: 9px; resize: vertical; box-sizing: border-box; }
        .temp-side-box { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; align-items: start; }
        .temp-side-box > h3, .temp-side-box > p, .temp-side-line, .temp-side-title-row, #tempExpenseBox { grid-column: 1 / -1; }
        .temp-list-pair { min-width: 0; display: flex; flex-direction: column; }
        .temp-list-pair:nth-of-type(1) { grid-column: 1; }
        .temp-list-pair:nth-of-type(2) { grid-column: 2; }
        .temp-side-line { height: 1px; background: #eadbbe; margin: 4px 0; }
        .temp-side-title-row, .temp-table-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .temp-expense-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; margin-bottom: 6px; }

        .temp-table-box {
            padding: 12px;
            overflow: hidden;
        }
        .temp-table-scroll {
            width: 100%;
            overflow: hidden;
        }
        #tempPaymentTable {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 11px;
        }
        #tempPaymentTable th { background: #f4ead5; color: #2d241c; border: 1px solid #302820; padding: 3px 2px; height: 23px; font-weight: 900; }
        #tempPaymentTable td { border: 1px solid #302820; padding: 0; height: 23px; background: #fff; text-align: center; }
        #tempPaymentTable tr.checked-row td { background: #e8f8e8; }
        #tempPaymentTable input, #tempPaymentTable select { width: 100%; height: 22px; border: 0; padding: 0 3px; box-sizing: border-box; background: transparent; font-size: 11px; outline: none; }
        #tempPaymentTable select.temp-pay1, #tempPaymentTable select.temp-pay2 { font-weight: 800; }
        #tempPaymentTable select.pay-empty { background: #fff; color: #111; }
        #tempPaymentTable select.pay-cash { background: #00ff00; color: #111; }
        #tempPaymentTable select.pay-card { background: #ffff00; color: #111; }
        #tempPaymentTable select.pay-unpaid { background: #e89a9a; color: #111; }
        #tempPaymentTable select.pay-unpaid-cash { background: #b7f7c4; color: #111; }
        #tempPaymentTable select.pay-unpaid-card { background: #f6c7d8; color: #111; }
        #tempPaymentTable select.pay-transfer { background: #bfe7ff; color: #111; }
        #tempPaymentTable .temp-row-no { cursor: pointer; font-weight: 900; user-select: none; }
        #tempPaymentTable .temp-first-cell.true, #tempPaymentTable .temp-block-cell.true { color: #166534; font-size: 15px; font-weight: 900; }
        #tempPaymentTable .temp-error-cell { color: #b91c1c; font-weight: 900; font-size: 10px; line-height: 1.1; }
        #tempPaymentTable .temp-delete-row { padding: 1px 4px; border-radius: 5px; font-size: 10px; }

        #tempPaymentTable th:nth-child(1) { width: 48px; }
        #tempPaymentTable th:nth-child(2) { width: 76px; }
        #tempPaymentTable th:nth-child(3) { width: 84px; }
        #tempPaymentTable th:nth-child(4) { width: 68px; }
        #tempPaymentTable th:nth-child(5) { width: 78px; }
        #tempPaymentTable th:nth-child(6) { width: 68px; }
        #tempPaymentTable th:nth-child(7) { width: 78px; }
        #tempPaymentTable th:nth-child(8) { width: 112px; }
        #tempPaymentTable th:nth-child(9) { width: 120px; }
        #tempPaymentTable th:nth-child(10), #tempPaymentTable th:nth-child(11) { width: 42px; }
        #tempPaymentTable th:nth-child(12) { width: 88px; }
        #tempPaymentTable th:nth-child(13) { width: 42px; }


        .temp-stats-box .temp-mini-card:last-child { overflow: hidden; }
        .temp-payment-actions #tempPaymentPrintBtn { min-width: 58px; }
        .temp-local-date-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            margin: 0 0 14px;
            padding: 10px 12px;
            border: 1px solid #eadbbe;
            border-radius: 15px;
            background: rgba(255,255,255,.94);
            box-sizing: border-box;
        }
        .temp-date-box {
            display: flex;
            gap: 8px;
            padding: 7px 9px;
            border-radius: 14px;
            background: #fbf5e8;
        }
        .temp-date-box select {
            width: 96px;
            height: 38px;
            border: 1px solid #eadbbe;
            border-radius: 10px;
            background: #fff;
            color: #2d241c;
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            outline: none;
        }
        .temp-date-btn {
            width: 42px;
            height: 42px;
            padding: 0 !important;
            border-radius: 12px !important;
            background: #2f4858 !important;
            color: white !important;
            font-size: 20px;
            font-weight: 900;
        }

        @media print {
            body { background: #fff !important; }
            .sidebar, .excel-upload-buttons, .desk-top-tabs, .desk-date-bar,
            .temp-payment-actions, #tempPaymentClearBtn, #tempPaymentSaveBtn,
            #tempPaymentCsvBtn, #tempPaymentPrintBtn,
            .temp-delete-row, #tempAddExpenseBtn { display: none !important; }
            .desk-main, .desk-top-page, #desk-temp1 {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                background: #fff !important;
                border-radius: 0 !important;
            }
            .desk-top-page:not(#desk-temp1) { display: none !important; }
            #desk-temp1 { display: block !important; overflow: visible !important; }
            .temp-payment-page { overflow: visible !important; padding: 0 !important; }
            .temp-payment-head, .temp-summary-grid article, .temp-mini-card, .temp-side-box, .temp-table-box {
                box-shadow: none !important;
                background: #fff !important;
                border-color: #ddd !important;
            }
            .temp-summary-grid { grid-template-columns: repeat(5, 1fr) !important; gap: 5px !important; }
            .temp-stats-box { grid-template-columns: repeat(5, 1fr) !important; gap: 5px !important; }
            .temp-payment-layout { display: block !important; }
            .temp-side-box { margin-bottom: 10px !important; }
            #tempPaymentTable { font-size: 9px !important; }
            #tempPaymentTable input, #tempPaymentTable select { font-size: 9px !important; height: 18px !important; }
            #tempPaymentTable th, #tempPaymentTable td { height: 18px !important; padding: 0 !important; }
            @page { size: A4 landscape; margin: 8mm; }
        }

        @media (max-width: 1200px) {
            .temp-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .temp-stats-box { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .temp-side-box { grid-template-columns: 1fr; }
            .temp-side-box label:nth-of-type(1), #tempFirstList,
            .temp-side-box label:nth-of-type(2), #tempBlockList { grid-column: 1; }
            .temp-table-box { overflow-x: auto; }
            #tempPaymentTable { min-width: 1000px; }
        }
    `;

    document.head.appendChild(style);
}
window.renderTempPayment = renderTempPayment;


/* =========================
   임시2 - 예약관리 붙여넣기
========================= */

const TEMP_RESERVATION_RESULT = {
    "": "선택",
    "1": "예약",
    "2": "변경",
    "3": "취소"
};

const TEMP_CANCEL_REASONS = {
    "": "선택",
    "개인사정": "개인사정",
    "일정변경": "일정변경",
    "연락안됨": "연락안됨",
    "증상호전": "증상호전",
    "타병원": "타병원",
    "예약착오": "예약착오",
    "기타": "기타"
};

const TEMP_RESERVATION_CATEGORIES = [
    { key: "injection", label: "주사치료", mainKey: "주사", test: text => text.includes("주사치료") },
    { key: "care", label: "주사경과+진료", mainKey: "경과", test: text => ["주사경과", "진료", "수액", "소독"].some(word => text.includes(word)) }
];

function tempReservationContainer() {
    return document.getElementById("desk-temp2") ||
        document.getElementById("temp2") ||
        document.getElementById("imsi2") ||
        document.getElementById("임시2") ||
        document.querySelector('[data-tab-page="temp2"]') ||
        document.querySelector('[data-page="temp2"]');
}

function getTempReservationData() {
    if (!deskExtraData.tempReservation) {
        deskExtraData.tempReservation = getDefaultTempReservationData();
    }

    deskExtraData.tempReservation = normalizeDeskExtraData({
        tempReservation: deskExtraData.tempReservation
    }).tempReservation;

    if (typeof deskExtraData.tempReservation.pasteRaw !== "string") {
        deskExtraData.tempReservation.pasteRaw = "";
    }

    return deskExtraData.tempReservation;
}

function renderTempReservation() {
    const container = tempReservationContainer();
    if (!container) return;

    injectTempReservationStyle();
    const data = getTempReservationData();

    container.innerHTML = `
        <section class="temp-reservation-page">
            <div class="temp-reservation-head">
                <div>
                    <p class="temp-reservation-eyebrow">DAILY RESERVATION MANAGER</p>
                    <h2>예약관리</h2>
                    <p>비트 예약관리 엑셀 표를 그대로 복사해서 붙여넣으면 자동 집계됩니다.</p>
                </div>
                <div class="temp-reservation-actions">
                    <button type="button" id="tempReservationSaveBtn">저장</button>
                    <button type="button" id="tempReservationClearBtn" class="danger">초기화</button>
                    <button type="button" id="tempReservationCsvBtn" class="ghost">CSV 저장</button>
                </div>
            </div>

            ${getTempLocalDateBarHtml("tempReservation")}

            <div class="temp-reservation-paste-card">
                <div class="temp-reservation-paste-title">
                    <h3>예약 엑셀 붙여넣기</h3>
                    <span>Ctrl+A → Ctrl+C 후 아래 칸에 Ctrl+V</span>
                </div>
                <textarea id="tempReservationPasteBox" placeholder="비트 예약관리 엑셀 내용을 여기에 붙여넣기"></textarea>
                <div class="temp-reservation-paste-actions">
                    <button type="button" id="tempReservationApplyPasteBtn">붙여넣기 반영</button>
                    <button type="button" id="tempReservationClearPasteBtn" class="ghost">붙여넣기 비우기</button>
                </div>
            </div>

            <div class="temp-reservation-summary">
                <article><span>예약 총건수</span><strong id="tempReservationTotal">0건</strong></article>
                <article><span>예약</span><strong id="tempReservationVisit">0건</strong></article>
                <article><span>변경</span><strong id="tempReservationChange">0건</strong></article>
                <article><span>취소</span><strong id="tempReservationCancel">0건</strong></article>
                <article><span>실 예약 환자수</span><strong id="tempReservationReal">0명</strong></article>
            </div>

            <div class="temp-reservation-stats">
                <div class="temp-reservation-card">
                    <h3>예약 구분 집계</h3>
                    <table>
                        <thead>
                            <tr><th>구분</th><th>예약</th><th>변경</th><th>취소</th></tr>
                        </thead>
                        <tbody id="tempReservationStatsBody"></tbody>
                    </table>
                </div>
                <div class="temp-reservation-card small">
                    <h3>취소사유 집계</h3>
                    <table>
                        <thead><tr><th>사유</th><th>건수</th></tr></thead>
                        <tbody id="tempReservationCancelReasonBody"></tbody>
                    </table>
                </div>
            </div>

            <section class="temp-reservation-table-box">
                <div class="temp-reservation-table-title">
                    <h3>예약 입력</h3>
                </div>
                <table id="tempReservationTable">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>차트번호</th>
                            <th>성명</th>
                            <th>핸드폰번호</th>
                            <th>예약과목</th>
                            <th>주치의</th>
                            <th>보험유형</th>
                            <th>예약일시</th>
                            <th>메모</th>
                            <th>결과</th>
                            <th>취소사유</th>
                            <th>확인</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </section>
        </section>
    `;

    document.getElementById("tempReservationSaveBtn").onclick = async () => {
        await saveDeskExtra();
        alert("예약관리 저장 완료");
    };

    document.getElementById("tempReservationClearBtn").onclick = async () => {
        if (!confirm("예약관리 입력값을 초기화할까요?")) return;
        deskExtraData.tempReservation = getDefaultTempReservationData();
        await saveDeskExtra();
        renderTempReservation();
    };

    document.getElementById("tempReservationCsvBtn").onclick = exportTempReservationCsv;
    setupTempLocalDateControls("tempReservation");

    const pasteBox = document.getElementById("tempReservationPasteBox");
    pasteBox.value = data.pasteRaw || "";
    pasteBox.onpaste = () => {
        setTimeout(async () => {
            parseAndApplyTempReservationPaste(pasteBox.value);
            await saveDeskExtra();
        }, 0);
    };
    pasteBox.oninput = () => {
        getTempReservationData().pasteRaw = pasteBox.value;
    };

    document.getElementById("tempReservationApplyPasteBtn").onclick = async () => {
        parseAndApplyTempReservationPaste(pasteBox.value);
        await saveDeskExtra();
        alert("예약 붙여넣기 반영 완료");
    };

    document.getElementById("tempReservationClearPasteBtn").onclick = async () => {
        pasteBox.value = "";
        getTempReservationData().pasteRaw = "";
        await saveDeskExtra();
    };

    renderTempReservationRows();
}

function detectTempReservationResult(statusText) {
    const text = tempClean(statusText).replace(/\s/g, "");
    if (text.includes("취소") || text.toUpperCase() === "X") return "3";
    if (text.includes("변경") || text.toUpperCase() === "B") return "2";
    if (text.includes("예약") || text.includes("내원") || text.toUpperCase() === "O") return "1";
    return "1";
}

function parseAndApplyTempReservationPaste(raw) {
    const data = getTempReservationData();
    data.pasteRaw = raw || "";

    const lines = String(raw || "")
        .replace(/\r/g, "")
        .split("\n")
        .filter(line => line.trim() !== "");

    if (!lines.length) {
        data.rows = Array.from({ length: 300 }, () => createTempReservationEmptyRow());
        renderTempReservationRows();
        return;
    }

    const table = lines.map(line => line.split("\t"));
    const normalizeHeader = value => tempClean(value).replace(/\s/g, "");
    const firstLine = table[0].map(normalizeHeader);
    const hasHeader = firstLine.includes("차트번호") || firstLine.includes("성명") || firstLine.includes("예약일시");
    const headers = hasHeader ? firstLine : [];
    const rows = hasHeader ? table.slice(1) : table;

    const findIndex = (...names) => {
        for (const name of names) {
            const index = headers.indexOf(name);
            if (index !== -1) return index;
        }
        return -1;
    };

    const fallbackIndex = {
        chartNo: 1,
        name: 2,
        phone: 5,
        room: 6,
        doctor: 7,
        insurance: 8,
        reserveTime: 9,
        statusText: 10,
        memo: 11,
        note: 12
    };

    const indexes = hasHeader ? {
        chartNo: findIndex("차트번호", "챠트번호"),
        name: findIndex("성명", "이름"),
        phone: findIndex("핸드폰번호", "휴대폰번호", "전화번호"),
        room: findIndex("예약과목", "과목"),
        doctor: findIndex("주치의", "담당의"),
        insurance: findIndex("보험유형", "보험"),
        reserveTime: findIndex("예약일시", "예약시간", "예약일자"),
        statusText: findIndex("상태"),
        memo: findIndex("메모"),
        note: findIndex("비고")
    } : fallbackIndex;

    const valueAt = (row, key) => {
        const index = indexes[key];
        return index >= 0 ? tempClean(row[index]) : "";
    };

    const parsed = rows.map(row => {
        const statusText = valueAt(row, "statusText");
        const memo = valueAt(row, "memo") || valueAt(row, "note");

        return {
            ...createTempReservationEmptyRow(),
            chartNo: tempChartClean(valueAt(row, "chartNo")),
            name: valueAt(row, "name"),
            phone: valueAt(row, "phone"),
            room: valueAt(row, "room"),
            doctor: valueAt(row, "doctor"),
            insurance: valueAt(row, "insurance"),
            reserveTime: valueAt(row, "reserveTime"),
            statusText: statusText,
            memo: memo,
            resultCode: detectTempReservationResult(statusText),
            cancelReason: ""
        };
    }).filter(row =>
        tempClean(row.chartNo) || tempClean(row.name) || tempClean(row.phone) ||
        tempClean(row.room) || tempClean(row.doctor) || tempClean(row.reserveTime) || tempClean(row.memo)
    );

    data.rows = [
        ...parsed,
        ...Array.from({ length: Math.max(0, 300 - parsed.length) }, () => createTempReservationEmptyRow())
    ].slice(0, 300);

    renderTempReservationRows();
}

function renderTempReservationRows() {
    const tbody = document.querySelector("#tempReservationTable tbody");
    if (!tbody) return;

    const data = getTempReservationData();
    tbody.innerHTML = "";

    data.rows.forEach((row, index) => {
        const tr = document.createElement("tr");
        tr.classList.toggle("checked-row", Boolean(row.checked));
        tr.innerHTML = `
            <td class="temp-reservation-no">${index + 1}</td>
            <td><input class="r-chart" inputmode="numeric"></td>
            <td><input class="r-name"></td>
            <td><input class="r-phone"></td>
            <td><input class="r-room"></td>
            <td><input class="r-doctor"></td>
            <td><input class="r-insurance"></td>
            <td><input class="r-time" placeholder="09:00"></td>
            <td><input class="r-memo" placeholder="주사치료/진료 등"></td>
            <td><select class="r-result">${tempOptionHtml(TEMP_RESERVATION_RESULT, true)}</select></td>
            <td><select class="r-cancel-reason">${tempOptionHtml(TEMP_CANCEL_REASONS, true)}</select></td>
            <td class="r-confirm">${row.checked ? "✓" : ""}</td>
        `;

        const bindings = [
            ["chartNo", ".r-chart"],
            ["name", ".r-name"],
            ["phone", ".r-phone"],
            ["room", ".r-room"],
            ["doctor", ".r-doctor"],
            ["insurance", ".r-insurance"],
            ["reserveTime", ".r-time"],
            ["memo", ".r-memo"],
            ["resultCode", ".r-result"],
            ["cancelReason", ".r-cancel-reason"]
        ];

        bindings.forEach(([key, selector]) => {
            const input = tr.querySelector(selector);
            input.value = row[key] ?? "";
            input.oninput = input.onchange = () => {
                row[key] = input.value;
                calculateTempReservation();
                saveDeskExtra();
            };
        });

        tr.querySelector(".r-confirm").onclick = async () => {
            row.checked = !row.checked;
            renderTempReservationRows();
            await saveDeskExtra();
        };

        tbody.appendChild(tr);
    });

    calculateTempReservation();
}

function tempReservationText(row) {
    return `${row.room || ""} ${row.memo || ""}`.replace(/\s+/g, "").trim();
}

function computedTempReservationRows() {
    return getTempReservationData().rows.map(row => ({
        ...row,
        hasReservation: Boolean(
            tempClean(row.chartNo) || tempClean(row.name) || tempClean(row.phone) ||
            tempClean(row.room) || tempClean(row.doctor) || tempClean(row.insurance) ||
            tempClean(row.reserveTime) || tempClean(row.memo)
        )
    }));
}


function syncTempReservationToMainReservation(statRows) {
    if (!deskExtraData.reservation) {
        deskExtraData.reservation = {};
    }

    statRows.forEach(row => {
        const category = TEMP_RESERVATION_CATEGORIES.find(cat => cat.label === row.label);
        const mainKey = category?.mainKey || row.label;

        if (!deskExtraData.reservation[mainKey]) {
            deskExtraData.reservation[mainKey] = {};
        }

        deskExtraData.reservation[mainKey]["예약"] = row.total;
        deskExtraData.reservation[mainKey]["변경"] = row.changed;
        deskExtraData.reservation[mainKey]["취소"] = row.canceled;
    });

    const mainRows = document.querySelectorAll(".desk-section:nth-of-type(2) tbody tr");
    const cols = ["예약", "변경", "취소"];

    mainRows.forEach(tr => {
        const name = tr.querySelector("td")?.textContent.trim();
        const inputs = tr.querySelectorAll("input");
        const values = deskExtraData.reservation[name];

        if (!values) return;

        inputs.forEach((input, index) => {
            const col = cols[index];
            input.value = values[col] ?? 0;
            input.readOnly = true;
            input.title = "임시2 예약관리에서 자동 연동됩니다.";
        });
    });
}

function calculateTempReservation() {
    if (!tempReservationContainer()) return;

    const rows = computedTempReservationRows();
    const active = rows.filter(row => row.hasReservation);

    const visit = active.filter(row => row.resultCode === "1").length;
    const changed = active.filter(row => row.resultCode === "2").length;
    const canceled = active.filter(row => row.resultCode === "3").length;
    const realPatientSet = new Set(active
        .filter(row => row.resultCode !== "3")
        .map(row => `${tempClean(row.name)}|${tempClean(row.phone)}|${tempClean(row.chartNo)}`)
        .filter(key => key.replace(/\|/g, ""))
    );

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setText("tempReservationTotal", `${active.length}건`);
    setText("tempReservationVisit", `${visit}건`);
    setText("tempReservationChange", `${changed}건`);
    setText("tempReservationCancel", `${canceled}건`);
    setText("tempReservationReal", `${realPatientSet.size}명`);

    const statRows = TEMP_RESERVATION_CATEGORIES.map(cat => {
        const matched = active.filter(row => cat.test(tempReservationText(row)));
        return {
            label: cat.label,
            total: matched.filter(row => row.resultCode === "1").length,
            changed: matched.filter(row => row.resultCode === "2").length,
            canceled: matched.filter(row => row.resultCode === "3").length
        };
    });

    const totalRow = {
        label: "합계",
        total: statRows.reduce((sum, row) => sum + row.total, 0),
        changed: statRows.reduce((sum, row) => sum + row.changed, 0),
        canceled: statRows.reduce((sum, row) => sum + row.canceled, 0)
    };

    syncTempReservationToMainReservation(statRows);

    const body = document.getElementById("tempReservationStatsBody");
    if (body) {
        body.innerHTML = [
            ...statRows,
            totalRow
        ].map(row => `
            <tr class="${row.label.includes("합계") ? "total-row" : ""}">
                <td>${row.label}</td>
                <td>${row.total}</td>
                <td>${row.changed}</td>
                <td>${row.canceled}</td>
            </tr>
        `).join("");
    }

    const reasonCounts = {};
    active.filter(row => row.resultCode === "3").forEach(row => {
        const reason = tempClean(row.cancelReason) || "미선택";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const reasonBody = document.getElementById("tempReservationCancelReasonBody");
    if (reasonBody) {
        const entries = Object.entries(reasonCounts);
        reasonBody.innerHTML = entries.length
            ? entries.map(([reason, count]) => `<tr><td>${reason}</td><td>${count}</td></tr>`).join("")
            : `<tr><td>취소 없음</td><td>0</td></tr>`;
    }
}

function exportTempReservationCsv() {
    const rows = computedTempReservationRows().filter(row => row.hasReservation);
    const header = ["no", "chartNo", "name", "phone", "room", "doctor", "insurance", "reserveTime", "memo", "result", "cancelReason", "checked"];
    const lines = [header.join(",")];

    rows.forEach((row, index) => {
        const values = [
            index + 1,
            row.chartNo,
            row.name,
            row.phone,
            row.room,
            row.doctor,
            row.insurance,
            row.reserveTime,
            row.memo,
            TEMP_RESERVATION_RESULT[row.resultCode] || "",
            row.cancelReason || "",
            row.checked ? "확인" : ""
        ];
        lines.push(values.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","));
    });

    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `예약관리_${getDateKey()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function injectTempReservationStyle() {
    const oldStyle = document.getElementById("tempReservationStyle");
    if (oldStyle) oldStyle.remove();

    const style = document.createElement("style");
    style.id = "tempReservationStyle";
    style.textContent = `
        #desk-temp2 { overflow: hidden !important; }
        #desk-temp2 .desk-card { padding: 0 !important; }
        .temp-reservation-page { width: 100%; max-width: 100%; overflow: hidden; box-sizing: border-box; padding: 8px 0 0; color: #2d241c; }
        .temp-reservation-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; padding: 16px 18px; border: 1px solid #eadbbe; border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 8px 18px rgba(77,52,22,.05); }
        .temp-reservation-head h2 { margin: 0 0 4px; font-size: 26px; line-height: 1.1; }
        .temp-reservation-head p { margin: 0; color: #8b7b68; font-size: 14px; }
        .temp-reservation-eyebrow { font-size: 11px; font-weight: 900; letter-spacing: .18em; color: #c49a44 !important; }
        .temp-reservation-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .temp-reservation-page button { border: 0; border-radius: 10px; background: #c9a34d; color: #fff; font-weight: 900; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
        .temp-local-date-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            margin: 0 0 14px;
            padding: 10px 12px;
            border: 1px solid #eadbbe;
            border-radius: 15px;
            background: rgba(255,255,255,.94);
            box-sizing: border-box;
        }
        .temp-date-box {
            display: flex;
            gap: 8px;
            padding: 7px 9px;
            border-radius: 14px;
            background: #fbf5e8;
        }
        .temp-date-box select {
            width: 96px;
            height: 38px;
            border: 1px solid #eadbbe;
            border-radius: 10px;
            background: #fff;
            color: #2d241c;
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            outline: none;
        }
        .temp-date-btn {
            width: 42px;
            height: 42px;
            padding: 0 !important;
            border-radius: 12px !important;
            background: #2f4858 !important;
            color: white !important;
            font-size: 20px;
            font-weight: 900;
        }
        .temp-reservation-page button.ghost { background: #fff; color: #7a6030; border: 1px solid #e8d8b8; }
        .temp-reservation-page button.danger { background: #d94a3f; color: #fff; }
        .temp-reservation-paste-card { margin-bottom: 12px; padding: 14px; border: 1px solid #eadbbe; border-radius: 15px; background: rgba(255,255,255,.94); box-shadow: 0 10px 22px rgba(77,52,22,.06); }
        .temp-reservation-paste-title { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
        .temp-reservation-paste-title h3 { margin: 0; font-size: 17px; font-weight: 900; }
        .temp-reservation-paste-title span { color: #8b7b68; font-size: 12px; font-weight: 700; }
        #tempReservationPasteBox { width: 100%; height: 105px; border: 1px solid #eadbbe; border-radius: 12px; padding: 10px; resize: vertical; box-sizing: border-box; font-size: 12px; outline: none; }
        .temp-reservation-paste-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
        .temp-reservation-summary { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px; margin-bottom: 12px; }
        .temp-reservation-summary article { min-width: 0; background: rgba(255,255,255,.94); border: 1px solid #eadbbe; border-radius: 13px; padding: 10px 9px; box-shadow: 0 8px 18px rgba(77,52,22,.05); }
        .temp-reservation-summary span { display: block; font-size: 12px; font-weight: 900; color: #8b7b68; margin-bottom: 5px; }
        .temp-reservation-summary strong { font-size: 19px; color: #221b16; }
        .temp-reservation-stats { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(270px, .55fr); gap: 12px; margin-bottom: 12px; width: 100%; }
        .temp-reservation-card, .temp-reservation-table-box { background: rgba(255,255,255,.94); border: 1px solid #eadbbe; border-radius: 15px; box-shadow: 0 10px 22px rgba(77,52,22,.06); box-sizing: border-box; padding: 12px; overflow-x: auto; overflow-y: visible; min-width: 0; }
        .temp-reservation-card h3, .temp-reservation-table-title h3 { margin: 0 0 8px; font-size: 17px; font-weight: 900; }
        .temp-reservation-card table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        .temp-reservation-card th, .temp-reservation-card td { border-bottom: 1px solid #eee3cf; padding: 6px 5px; text-align: center; white-space: nowrap; word-break: keep-all; overflow: visible; }
        .temp-reservation-card th:first-child, .temp-reservation-card td:first-child { text-align: left; }
        .temp-reservation-card .total-row td { font-weight: 900; background: #fbf5e8; }
        #tempReservationTable { width: 100%; min-width: 1260px; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
        #tempReservationTable th { background: #f4ead5; color: #2d241c; border: 1px solid #302820; padding: 3px 2px; height: 24px; font-weight: 900; }
        #tempReservationTable td { border: 1px solid #302820; padding: 0; height: 23px; background: #fff; text-align: center; }
        #tempReservationTable tr.checked-row td { background: #e8f8e8; }
        #tempReservationTable input, #tempReservationTable select { width: 100%; height: 22px; border: 0; padding: 0 5px; box-sizing: border-box; background: transparent; font-size: 11px; outline: none; white-space: nowrap; }
        #tempReservationTable .r-confirm { cursor: pointer; color: #166534; font-size: 15px; font-weight: 900; }
        #tempReservationTable th:nth-child(1) { width: 42px; }
        #tempReservationTable th:nth-child(2) { width: 76px; }
        #tempReservationTable th:nth-child(3) { width: 76px; }
        #tempReservationTable th:nth-child(4) { width: 104px; }
        #tempReservationTable th:nth-child(5) { width: 112px; }
        #tempReservationTable th:nth-child(6) { width: 70px; }
        #tempReservationTable th:nth-child(7) { width: 98px; }
        #tempReservationTable th:nth-child(8) { width: 112px; }
        #tempReservationTable th:nth-child(9) { width: 240px; }
        #tempReservationTable th:nth-child(10) { width: 62px; }
        #tempReservationTable th:nth-child(11) { width: 130px; }
        #tempReservationTable th:nth-child(12) { width: 42px; }
        @media (max-width: 1200px) {
            .temp-reservation-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .temp-reservation-stats { grid-template-columns: 1fr; }
            .temp-reservation-table-box { overflow-x: auto; }
            #tempReservationTable { min-width: 1260px; }
        }
    `;

    document.head.appendChild(style);
}
window.renderTempReservation = renderTempReservation;



/* =========================
   임시3 - OT 관리 - 간호 스타일
========================= */

function tempOTContainer() {
    return document.getElementById("desk-temp3") ||
        document.getElementById("temp3") ||
        document.getElementById("imsi3") ||
        document.getElementById("임시3");
}

function getTempOTData() {
    if (!deskExtraData.tempOT) deskExtraData.tempOT = getDefaultTempOTData();
    if (!Array.isArray(deskExtraData.tempOT.rows)) deskExtraData.tempOT.rows = [];

    const count = Math.max(1, Math.min(50, Number(deskExtraData.tempOT.staffCount || 4) || 4));
    deskExtraData.tempOT.staffCount = count;

    while (deskExtraData.tempOT.rows.length < count) deskExtraData.tempOT.rows.push(createTempOTEmptyRow());
    if (deskExtraData.tempOT.rows.length > count) deskExtraData.tempOT.rows = deskExtraData.tempOT.rows.slice(0, count);

    return deskExtraData.tempOT;
}

function tempPad2(value) {
    return String(value).padStart(2, "0");
}

function tempCurrentIsoDate() {
    return `${yearSelect.value}-${tempPad2(monthSelect.value)}-${tempPad2(daySelect.value)}`;
}

function tempSetMainDateFromIso(dateText) {
    const [y, m, d] = String(dateText).split("-").map(Number);
    if (!y || !m || !d) return;

    yearSelect.value = y;
    monthSelect.value = m;
    currentDay = d;
    updateDays();
    daySelect.value = d;
}

function tempTimeToMinutes(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function tempMinutesText(minutes) {
    minutes = Number(minutes || 0);
    if (minutes <= 0) return "0";
    return String(minutes);
}

function makeTempHourOptions(selectedTime = "") {
    const selectedHour = selectedTime ? selectedTime.split(":")[0] : "";
    let html = `<option value="">시</option>`;

    for (let h = 6; h <= 22; h++) {
        const hour = String(h).padStart(2, "0");
        html += `<option value="${hour}" ${selectedHour === hour ? "selected" : ""}>${hour}</option>`;
    }

    return html;
}

function makeTempMinuteOptions(selectedTime = "") {
    const selectedMinute = selectedTime ? selectedTime.split(":")[1] : "";
    let html = `<option value="">분</option>`;

    for (let m = 0; m < 60; m += 10) {
        const minute = String(m).padStart(2, "0");
        html += `<option value="${minute}" ${selectedMinute === minute ? "selected" : ""}>${minute}</option>`;
    }

    return html;
}

function getTempSelectedTime(index, type) {
    const hour = document.querySelector(`[data-ot-index="${index}"][data-type="${type}Hour"]`)?.value;
    const minute = document.querySelector(`[data-ot-index="${index}"][data-type="${type}Minute"]`)?.value;

    if (!hour || !minute) return "";
    return `${hour}:${minute}`;
}

function calcTempWorkTime(start, end, lunch, off, baseStartValue, baseEndValue) {
    if (off) return { ot: 0, early: 0, total: 0 };

    const actualStart = start || baseStartValue;
    const actualEnd = end || baseEndValue;

    const s = tempTimeToMinutes(actualStart);
    const e = tempTimeToMinutes(actualEnd);
    const bs = tempTimeToMinutes(baseStartValue);
    const be = tempTimeToMinutes(baseEndValue);

    if (s === null || e === null || bs === null || be === null) {
        return { ot: 0, early: 0, total: 0 };
    }

    const ot = Math.max(0, bs - s) + Math.max(0, e - be) + Number(lunch || 0);
    const early = Math.max(0, be - e);
    const total = ot - early;

    return { ot, early, total };
}

function renderTempOT() {
    const container = tempOTContainer();
    if (!container) return;

    injectTempOTStyle();
    const data = getTempOTData();

    container.innerHTML = `
        <section class="work-schedule-page temp-ot-page">
            <div class="work-control-card">
                <label>
                    날짜
                    <input type="date" id="tempOTWorkDate" value="${tempCurrentIsoDate()}">
                </label>

                <label>
                    인원수
                    <input type="number" id="tempOTStaffCount" min="1" max="50" value="${data.staffCount || 4}">
                </label>

                <label>
                    기준 출근
                    <input type="time" id="tempOTBaseStart" value="${data.standardStart || "09:00"}" step="600">
                </label>

                <label>
                    기준 퇴근
                    <input type="time" id="tempOTBaseEnd" value="${data.standardEnd || "19:30"}" step="600">
                </label>

                <button type="button" id="tempOTSaveBtn" class="work-primary-btn">저장</button>
                <button type="button" id="tempOTShowDayBtn">1일 보기</button>
                <button type="button" id="tempOTShowMonthBtn">한달 보기</button>
            </div>

            <section id="tempOTDailyView" class="work-view-card">
                <div class="work-section-title">
                    <h2 id="tempOTDailyTitle">1일 보기</h2>
                    <p>출근/퇴근을 비우면 기준시간으로 계산됩니다.</p>
                </div>

                <table class="work-daily-table" id="tempOTDailyTable">
                    <thead>
                        <tr>
                            <th>이름</th>
                            <th>출근</th>
                            <th>점심</th>
                            <th>퇴근</th>
                            <th>휴무</th>
                            <th>OT</th>
                            <th>조기퇴근</th>
                        </tr>
                    </thead>
                    <tbody id="tempOTDailyBody"></tbody>
                </table>
            </section>

            <section id="tempOTMonthView" class="work-view-card" style="display:none;">
                <div class="work-section-title work-month-head">
                    <div>
                        <h2 id="tempOTMonthTitle">한달 보기</h2>
                        <p>날짜별 직원 OT / 조기퇴근 현황</p>
                    </div>

                    <div class="work-month-total-box">
                        <table>
                            <thead>
                                <tr>
                                    <th>이름</th>
                                    <th>OT</th>
                                    <th>조퇴</th>
                                    <th>합계</th>
                                </tr>
                            </thead>
                            <tbody id="tempOTMonthTotalBody"></tbody>
                        </table>
                    </div>
                </div>

                <div class="work-calendar-week">
                    <div>일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div>토</div>
                </div>

                <div id="tempOTCalendarGrid" class="work-calendar-grid"></div>
            </section>
        </section>
    `;

    document.getElementById("tempOTWorkDate").onchange = async function () {
        tempSetMainDateFromIso(this.value);
        await reloadDeskPage();
    };

    document.getElementById("tempOTSaveBtn").onclick = async () => {
        collectTempOTRows();
        await saveDeskExtra();
        alert("OT 저장 완료");
    };

    document.getElementById("tempOTShowDayBtn").onclick = () => {
        document.getElementById("tempOTDailyView").style.display = "block";
        document.getElementById("tempOTMonthView").style.display = "none";
        renderTempOTDailyRows();
    };

    document.getElementById("tempOTShowMonthBtn").onclick = async () => {
        collectTempOTRows();
        await saveDeskExtra();
        document.getElementById("tempOTDailyView").style.display = "none";
        document.getElementById("tempOTMonthView").style.display = "block";
        await renderTempOTMonthCalendar();
    };

    document.getElementById("tempOTStaffCount").onchange = async function () {
        data.staffCount = Math.max(1, Math.min(50, Number(this.value) || 1));
        getTempOTData();
        renderTempOTDailyRows();
        await saveDeskExtra();
    };

    document.getElementById("tempOTBaseStart").onchange = async function () {
        data.standardStart = this.value;
        updateTempOTCalc();
        await saveDeskExtra();
    };

    document.getElementById("tempOTBaseEnd").onchange = async function () {
        data.standardEnd = this.value;
        updateTempOTCalc();
        await saveDeskExtra();
    };

    renderTempOTDailyRows();
}

function renderTempOTDailyRows() {
    const data = getTempOTData();
    const body = document.getElementById("tempOTDailyBody");
    const title = document.getElementById("tempOTDailyTitle");
    if (!body) return;

    const date = tempCurrentIsoDate();
    if (title) title.innerText = `${date} 근무 입력`;

    body.innerHTML = "";

    data.rows.forEach((row, index) => {
        const name = row.name || "";
        body.innerHTML += `
            <tr>
                <td>
                    <input class="work-name-input" value="${name}" data-ot-index="${index}" data-type="name" placeholder="이름">
                </td>

                <td>
                    <div class="work-time-group">
                        <select data-ot-index="${index}" data-type="startHour">${makeTempHourOptions(row.start || "")}</select>
                        <select data-ot-index="${index}" data-type="startMinute">${makeTempMinuteOptions(row.start || "")}</select>
                    </div>
                </td>

                <td>
                    <select data-ot-index="${index}" data-type="lunch">
                        ${[0,10,20,30,40,50,60].map(v => `<option value="${v}" ${Number(row.lunch || 0) === v ? "selected" : ""}>${v}</option>`).join("")}
                    </select>
                </td>

                <td>
                    <div class="work-time-group">
                        <select data-ot-index="${index}" data-type="endHour">${makeTempHourOptions(row.end || "")}</select>
                        <select data-ot-index="${index}" data-type="endMinute">${makeTempMinuteOptions(row.end || "")}</select>
                    </div>
                </td>

                <td>
                    <input type="checkbox" data-ot-index="${index}" data-type="off" ${row.off ? "checked" : ""}>
                </td>

                <td id="temp-ot-${index}" class="work-ot-cell">0</td>
                <td id="temp-early-${index}" class="work-early-cell">0</td>
            </tr>
        `;
    });

    body.querySelectorAll("[data-ot-index]").forEach(input => {
        input.addEventListener("change", async () => {
            collectTempOTRows();
            updateTempOTCalc();
            await saveDeskExtra();
        });
    });

    updateTempOTCalc();
}

function collectTempOTRows() {
    const data = getTempOTData();
    const baseStart = document.getElementById("tempOTBaseStart")?.value || data.standardStart || "09:00";
    const baseEnd = document.getElementById("tempOTBaseEnd")?.value || data.standardEnd || "19:30";

    data.standardStart = baseStart;
    data.standardEnd = baseEnd;

    data.rows.forEach((row, index) => {
        const nameInput = document.querySelector(`[data-ot-index="${index}"][data-type="name"]`);
        const lunchInput = document.querySelector(`[data-ot-index="${index}"][data-type="lunch"]`);
        const offInput = document.querySelector(`[data-ot-index="${index}"][data-type="off"]`);

        if (!nameInput || !lunchInput || !offInput) return;

        const start = getTempSelectedTime(index, "start");
        const end = getTempSelectedTime(index, "end");
        const result = calcTempWorkTime(start, end, lunchInput.value, offInput.checked, baseStart, baseEnd);

        row.name = nameInput.value.trim();
        row.start = start;
        row.end = end;
        row.lunch = lunchInput.value;
        row.off = offInput.checked;
        row.ot = result.ot;
        row.early = result.early;
        row.total = result.total;
    });
}

function updateTempOTCalc() {
    const data = getTempOTData();
    const baseStart = document.getElementById("tempOTBaseStart")?.value || data.standardStart || "09:00";
    const baseEnd = document.getElementById("tempOTBaseEnd")?.value || data.standardEnd || "19:30";

    data.rows.forEach((row, index) => {
        const startHour = document.querySelector(`[data-ot-index="${index}"][data-type="startHour"]`);
        const startMinute = document.querySelector(`[data-ot-index="${index}"][data-type="startMinute"]`);
        const endHour = document.querySelector(`[data-ot-index="${index}"][data-type="endHour"]`);
        const endMinute = document.querySelector(`[data-ot-index="${index}"][data-type="endMinute"]`);
        const lunchInput = document.querySelector(`[data-ot-index="${index}"][data-type="lunch"]`);
        const offInput = document.querySelector(`[data-ot-index="${index}"][data-type="off"]`);

        if (!startHour || !startMinute || !endHour || !endMinute || !lunchInput || !offInput) return;

        const disabled = offInput.checked;
        startHour.disabled = disabled;
        startMinute.disabled = disabled;
        endHour.disabled = disabled;
        endMinute.disabled = disabled;
        lunchInput.disabled = disabled;

        if (disabled) {
            startHour.value = "";
            startMinute.value = "";
            endHour.value = "";
            endMinute.value = "";
            lunchInput.value = "0";
        }

        const start = getTempSelectedTime(index, "start");
        const end = getTempSelectedTime(index, "end");
        const result = calcTempWorkTime(start, end, lunchInput.value, offInput.checked, baseStart, baseEnd);

        const otCell = document.getElementById(`temp-ot-${index}`);
        const earlyCell = document.getElementById(`temp-early-${index}`);
        if (otCell) otCell.innerText = result.ot;
        if (earlyCell) earlyCell.innerText = result.early;
    });
}

async function getTempOTDataForDate(year, month, day) {
    const key = `${year}-${month}-${day}`;
    try {
        const snap = await getDoc(doc(db, "closings", key));
        const data = snap.exists() ? snap.data() : {};
        return data.deskExtraData?.tempOT || null;
    } catch (error) {
        console.warn("OT 월별 데이터 불러오기 실패", key, error);
        return null;
    }
}

async function renderTempOTMonthCalendar() {
    const selectedDate = document.getElementById("tempOTWorkDate")?.value || tempCurrentIsoDate();
    const [year, month] = selectedDate.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0).getDate();
    const startWeek = firstDay.getDay();
    const grid = document.getElementById("tempOTCalendarGrid");
    const totalBody = document.getElementById("tempOTMonthTotalBody");
    const title = document.getElementById("tempOTMonthTitle");
    const current = getTempOTData();

    if (!grid || !totalBody) return;
    if (title) title.innerText = `${year}년 ${month}월 한달 보기`;

    grid.innerHTML = "";
    totalBody.innerHTML = "";

    const names = current.rows.map((row, index) => row.name || `${index + 1}번`).slice(0, current.staffCount || current.rows.length);
    const totals = {};
    names.forEach(name => totals[name] = { ot: 0, early: 0, total: 0 });

    for (let i = 0; i < startWeek; i++) {
        grid.innerHTML += `<div class="work-calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const dayData = await getTempOTDataForDate(year, month, day);
        const rows = Array.isArray(dayData?.rows) ? dayData.rows : [];
        let html = "";

        names.forEach((name, index) => {
            const row = rows[index] || {};
            const rowName = row.name || name;
            const ot = Number(row.ot || 0);
            const early = Number(row.early || 0);
            const total = Number(row.total || (ot - early));

            totals[name].ot += ot;
            totals[name].early += early;
            totals[name].total += total;

            html += row.off
                ? `<div class="work-employee-line off"><span>${rowName}</span><span>휴무</span></div>`
                : `<div class="work-employee-line"><span>${rowName}</span><span>${ot} / ${early}</span></div>`;
        });

        grid.innerHTML += `
            <div class="work-calendar-cell">
                <div class="work-day-head">
                    <span class="work-day-number">${day}</span>
                    <span class="work-day-total">OT / 조퇴</span>
                </div>
                ${html}
            </div>
        `;
    }

    names.forEach(name => {
        totalBody.innerHTML += `
            <tr>
                <td>${name}</td>
                <td>${totals[name].ot}</td>
                <td>${totals[name].early}</td>
                <td>${totals[name].total}</td>
            </tr>
        `;
    });
}

function injectTempOTStyle() {
    const old = document.getElementById("tempOTStyle");
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = "tempOTStyle";
    style.textContent = `
        #desk-temp3 { overflow: visible !important; }
        #desk-temp3 > .desk-card { padding: 0 !important; background: transparent !important; box-shadow: none !important; }

        .work-schedule-page {
            width: 100%;
            color: #2f4858;
        }

        .work-control-card {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
            background: rgba(255,255,255,.96);
            border: 1px solid #eadbbe;
            border-radius: 22px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 26px rgba(0,0,0,.08);
        }

        .work-control-card label {
            display: flex;
            flex-direction: column;
            gap: 7px;
            color: #2f4858;
            font-size: 14px;
            font-weight: 900;
        }

        .work-control-card input,
        .work-control-card select {
            height: 42px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #fff;
            padding: 0 10px;
            font-size: 15px;
            font-weight: 800;
            color: #2f4858;
            outline: none;
            box-sizing: border-box;
        }

        .work-control-card button {
            height: 42px;
            border: none;
            border-radius: 12px;
            padding: 0 16px;
            background: #e5e7eb;
            color: #2f4858;
            font-size: 15px;
            font-weight: 900;
            cursor: pointer;
        }

        .work-control-card .work-primary-btn {
            background: #2f4858;
            color: #fff;
        }

        .work-view-card {
            background: rgba(255,255,255,.96);
            border: 1px solid #eadbbe;
            border-radius: 22px;
            padding: 24px;
            box-shadow: 0 10px 26px rgba(0,0,0,.08);
        }

        .work-section-title {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
        }

        .work-section-title h2 {
            margin: 0 0 6px;
            color: #2f4858;
            font-size: 24px;
            font-weight: 900;
        }

        .work-section-title p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
            font-weight: 700;
        }

        .work-daily-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .work-daily-table th,
        .work-daily-table td {
            border: 1px solid #d8dee6;
            padding: 8px;
            text-align: center;
            background: #fff;
        }

        .work-daily-table th {
            background: #f1f5f9;
            color: #2f4858;
            font-weight: 900;
        }

        .work-daily-table input,
        .work-daily-table select {
            width: 100%;
            height: 38px;
            border: 1px solid #cbd5e1;
            border-radius: 9px;
            padding: 0 8px;
            font-size: 14px;
            font-weight: 800;
            color: #2f4858;
            outline: none;
            box-sizing: border-box;
            background: #fff;
        }

        .work-time-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }

        .work-ot-cell {
            color: #2563eb;
            font-weight: 900;
        }

        .work-early-cell {
            color: #dc2626;
            font-weight: 900;
        }

        .work-month-head {
            align-items: flex-start;
        }

        .work-month-total-box {
            min-width: 330px;
            background: #fff;
            border: 1px solid #d8dee6;
            border-radius: 14px;
            overflow: hidden;
        }

        .work-month-total-box table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .work-month-total-box th,
        .work-month-total-box td {
            border: 1px solid #e5e7eb;
            padding: 6px 8px;
            text-align: center;
        }

        .work-month-total-box th {
            background: #f1f5f9;
            font-weight: 900;
        }

        .work-calendar-week,
        .work-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
        }

        .work-calendar-week div {
            height: 34px;
            line-height: 34px;
            text-align: center;
            border-radius: 10px;
            background: #f1f5f9;
            color: #2f4858;
            font-weight: 900;
        }

        .work-calendar-grid {
            margin-top: 6px;
        }

        .work-calendar-cell {
            min-height: 128px;
            border: 1px solid #d8dee6;
            border-radius: 14px;
            background: #fff;
            padding: 8px;
            box-sizing: border-box;
            overflow: hidden;
        }

        .work-calendar-cell.empty {
            background: rgba(248,250,252,.7);
        }

        .work-day-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            border-bottom: 1px solid #edf2f7;
            padding-bottom: 5px;
        }

        .work-day-number {
            color: #2f4858;
            font-size: 18px;
            font-weight: 900;
        }

        .work-day-total {
            color: #64748b;
            font-size: 11px;
            font-weight: 900;
        }

        .work-employee-line {
            display: flex;
            justify-content: space-between;
            gap: 4px;
            margin-top: 4px;
            padding: 4px 5px;
            border-radius: 8px;
            background: #f8fafc;
            color: #334155;
            font-size: 11px;
            font-weight: 800;
        }

        .work-employee-line.off {
            background: #f1f5f9;
            color: #94a3b8;
        }
    `;
    document.head.appendChild(style);
}
window.renderTempOT = renderTempOT;

/* =========================
   청소 페이지
========================= */

const tempCleaningToday = new Date();
let tempCleaningYear = tempCleaningToday.getFullYear();
let tempCleaningMonth = tempCleaningToday.getMonth() + 1;
let tempCleaningLoadedKey = "";

function tempCleaningContainer() {
    return document.querySelector("#desk-temp4 .desk-card") ||
        document.getElementById("desk-temp4");
}

function getTempCleaningMonthKey() {
    return `${tempCleaningYear}-${String(tempCleaningMonth).padStart(2, "0")}`;
}

async function loadTempCleaningMonth() {
    const monthKey = getTempCleaningMonthKey();
    if (tempCleaningLoadedKey === monthKey) return;

    const localKey = `desk_tempCleaning_${monthKey}`;
    let saved = null;

    try {
        const snap = await getDoc(doc(db, "deskCleaning", monthKey));
        if (snap.exists()) {
            saved = snap.data()?.tempCleaning || null;
        }
    } catch (e) {
        console.warn("청소 Firebase 불러오기 실패, 로컬 저장값 사용", e);
    }

    if (!saved) {
        try {
            saved = JSON.parse(localStorage.getItem(localKey) || "null");
        } catch (e) {
            saved = null;
        }
    }

    deskExtraData.tempCleaning = {
        ...getDefaultTempCleaningData(),
        ...(saved || {}),
        cells: saved?.cells && typeof saved.cells === "object" ? saved.cells : {}
    };

    tempCleaningLoadedKey = monthKey;
}

async function saveTempCleaningMonth() {
    const monthKey = getTempCleaningMonthKey();
    const localKey = `desk_tempCleaning_${monthKey}`;
    const tempCleaning = deskExtraData.tempCleaning || getDefaultTempCleaningData();

    try {
        localStorage.setItem(localKey, JSON.stringify(tempCleaning));
    } catch (e) {
        console.warn("청소 로컬 저장 실패", e);
    }

    try {
        await setDoc(
            doc(db, "deskCleaning", monthKey),
            {
                tempCleaning,
                updatedAt: Date.now()
            },
            { merge: true }
        );
    } catch (e) {
        console.warn("청소 Firebase 저장 실패", e);
    }
}

function changeTempCleaningMonth(diff) {
    const date = new Date(tempCleaningYear, tempCleaningMonth - 1 + diff, 1);
    tempCleaningYear = date.getFullYear();
    tempCleaningMonth = date.getMonth() + 1;
    tempCleaningLoadedKey = "";
    renderTempCleaning();
}

function cleanNameHtml(value) {
    const text = String(value || "").trim();

    if (!text) return "";

    return text
        .split(/\n+/)
        .map(name => {
            const n = name.trim();
            if (n === "송희") {
                return `<span class="clean-name-songhee">송희<img src="./포차코.png" class="pochacco-icon"></span>`;
            }
            return n;
        })
        .join("<br>");
}

function cleanNameText(element) {
    return element.innerText.replace(/\n+$/g, "");
}
function decorateCleaningName(value) {
    const text = String(value || "").trim();

    if (!text) return "";

    return text
        .split(/\s+/)
        .map(name => {
            if (name === "송희") return "송희 🐶";
            if (name === "송희🐶") return "송희 🐶";
            return name;
        })
        .join("\n");
}

function renderTempCleaning() {
    const container = tempCleaningContainer();
    if (!container) return;

    injectTempCleaningStyle();

    container.innerHTML = `
        <section class="temp-clean-page">
            <div class="temp-clean-head">
                <div>
                    <p class="temp-clean-eyebrow">CLEANING MANAGER</p>
                    <h2>청소</h2>
                    <p>월별 청소 담당을 엑셀처럼 칸에 직접 입력합니다.</p>
                </div>
                <div class="temp-clean-actions">
                    <button type="button" id="tempCleaningSaveBtn">저장</button>
                    <button type="button" id="tempCleaningClearBtn" class="danger">초기화</button>
                </div>
            </div>

            <div class="clean-month-bar">
                <button type="button" id="tempCleaningPrevMonth">◀</button>
                <select id="tempCleaningYearSelect"></select>
                <select id="tempCleaningMonthSelect"></select>
                <button type="button" id="tempCleaningNextMonth">▶</button>
            </div>

            <div class="temp-clean-card">
                <div class="temp-clean-title">
                    <h3 id="tempCleaningTitle">청소 담당표</h3>
                    <span>날짜 칸 아래 담당자명을 직접 입력</span>
                </div>
                <div id="tempCleaningCalendar"></div>
                <textarea id="tempCleaningMemo" placeholder="메모" class="temp-clean-memo"></textarea>
            </div>
        </section>
    `;

    const ySel = document.getElementById("tempCleaningYearSelect");
    const mSel = document.getElementById("tempCleaningMonthSelect");

    for (let y = 2024; y <= 2035; y++) {
        ySel.innerHTML += `<option value="${y}">${y}년</option>`;
    }

    for (let m = 1; m <= 12; m++) {
        mSel.innerHTML += `<option value="${m}">${m}월</option>`;
    }

    ySel.value = tempCleaningYear;
    mSel.value = tempCleaningMonth;

    ySel.onchange = () => {
        tempCleaningYear = Number(ySel.value);
        tempCleaningLoadedKey = "";
        renderTempCleaningCalendar();
    };

    mSel.onchange = () => {
        tempCleaningMonth = Number(mSel.value);
        tempCleaningLoadedKey = "";
        renderTempCleaningCalendar();
    };

    document.getElementById("tempCleaningPrevMonth").onclick = () => {
        changeTempCleaningMonth(-1);
    };

    document.getElementById("tempCleaningNextMonth").onclick = () => {
        changeTempCleaningMonth(1);
    };

    document.getElementById("tempCleaningSaveBtn").onclick = async () => {
        await saveTempCleaningMonth();
        alert("청소 담당 저장 완료");
    };

    document.getElementById("tempCleaningClearBtn").onclick = async () => {
        if (!confirm("이번 달 청소 담당표를 초기화할까요?")) return;

        deskExtraData.tempCleaning = getDefaultTempCleaningData();

        await saveTempCleaningMonth();
        await renderTempCleaningCalendar();
    };

    renderTempCleaningCalendar();
}

async function renderTempCleaningCalendar() {
    await loadTempCleaningMonth();

    const box = document.getElementById("tempCleaningCalendar");
    if (!box) return;

    const year = Number(tempCleaningYear);
    const month = Number(tempCleaningMonth);

    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const startDay = first.getDay();

    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const data = deskExtraData.tempCleaning || getDefaultTempCleaningData();

    const title = document.getElementById("tempCleaningTitle");
    if (title) {
        title.textContent = `${year}년 ${month}월 청소 담당표`;
    }

    let html = `
        <table id="tempCleaningTable">
            <thead>
                <tr>
                    ${days.map(day => `<th>${day}</th>`).join("")}
                </tr>
            </thead>
            <tbody>
    `;

    let day = 1;

    for (let week = 0; week < 6; week++) {
        html += "<tr>";

        for (let dow = 0; dow < 7; dow++) {
            if ((week === 0 && dow < startDay) || day > lastDay) {
                html += `<td class="empty"></td>`;
            } else {
                const key = String(day);
                const value = data.cells?.[key] || "";

                html += `
                    <td>
                        <div class="clean-day">${day}</div>
                        <div
    class="clean-cell"
    data-day="${key}"
    contenteditable="true"
    data-placeholder="담당자"
>${cleanNameHtml(value)}</div>
                    </td>
                `;

                day++;
            }
        }

        html += "</tr>";

        if (day > lastDay) break;
    }

    html += `
            </tbody>
        </table>
    `;

    box.innerHTML = html;

    const memo = document.getElementById("tempCleaningMemo");

    if (memo) {
        memo.value = data.memo || "";

        memo.oninput = async function () {
            if (!deskExtraData.tempCleaning) {
                deskExtraData.tempCleaning = getDefaultTempCleaningData();
            }

            deskExtraData.tempCleaning.memo = this.value;

            await saveTempCleaningMonth();
        };
    }

    box.querySelectorAll(".clean-cell").forEach(cell => {
    cell.oninput = async () => {
        if (!deskExtraData.tempCleaning) {
            deskExtraData.tempCleaning = getDefaultTempCleaningData();
        }

        if (!deskExtraData.tempCleaning.cells) {
            deskExtraData.tempCleaning.cells = {};
        }

        deskExtraData.tempCleaning.cells[cell.dataset.day] = cleanNameText(cell);

        await saveTempCleaningMonth();
    };

    cell.onblur = async () => {
        const text = cleanNameText(cell);

        cell.innerHTML = cleanNameHtml(text);

        if (!deskExtraData.tempCleaning) {
            deskExtraData.tempCleaning = getDefaultTempCleaningData();
        }

        if (!deskExtraData.tempCleaning.cells) {
            deskExtraData.tempCleaning.cells = {};
        }

        deskExtraData.tempCleaning.cells[cell.dataset.day] = text;

        await saveTempCleaningMonth();
    };
});
}

function injectTempCleaningStyle() {
    const old = document.getElementById("tempCleaningStyle");
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = "tempCleaningStyle";

    style.textContent = `
        #desk-temp4 {
            overflow: visible !important;
        }

        #desk-temp4 > .desk-card {
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
        }

        .temp-clean-page {
            color: #2f4858;
        }

        .temp-clean-head {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            align-items: flex-start;
            margin-bottom: 14px;
            padding: 16px 18px;
            border: 1px solid #eadbbe;
            border-radius: 20px;
            background: rgba(255,255,255,.96);
            box-shadow: 0 8px 18px rgba(0,0,0,.06);
        }

        .temp-clean-head h2 {
            margin: 0 0 4px;
            font-size: 26px;
            line-height: 1.1;
            color: #2f4858;
        }

        .temp-clean-head p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
            font-weight: 700;
        }

        .temp-clean-eyebrow {
            margin: 0 0 4px !important;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .18em;
            color: #c9a46a !important;
        }

        .temp-clean-actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }

        .temp-clean-page button {
            border: 0;
            border-radius: 12px;
            background: #2f4858;
            color: #fff;
            font-weight: 900;
            padding: 9px 14px;
            cursor: pointer;
            white-space: nowrap;
        }

        .temp-clean-page button.danger {
            background: #d94a3f;
        }

        .clean-month-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin: 0 0 14px;
            padding: 12px;
            border: 1px solid #eadbbe;
            border-radius: 18px;
            background: rgba(255,255,255,.96);
            box-shadow: 0 8px 18px rgba(0,0,0,.04);
        }

        .clean-month-bar select {
            width: 120px;
            height: 42px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #fff;
            color: #2f4858;
            font-size: 16px;
            font-weight: 900;
            text-align: center;
            outline: none;
        }

        .clean-month-bar button {
            width: 44px;
            height: 42px;
            padding: 0 !important;
            font-size: 20px;
        }

        .temp-clean-card {
            padding: 18px;
            border: 1px solid #eadbbe;
            border-radius: 20px;
            background: rgba(255,255,255,.96);
            box-shadow: 0 10px 26px rgba(0,0,0,.08);
        }

        .temp-clean-title {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
            gap: 10px;
        }

        .temp-clean-title h3 {
            margin: 0;
            font-size: 22px;
            font-weight: 900;
            color: #2f4858;
        }

        .temp-clean-title span {
            color: #64748b;
            font-size: 13px;
            font-weight: 800;
        }

        #tempCleaningTable {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        #tempCleaningTable th {
            height: 38px;
            border: 1px solid #d8dee6;
            background: #f1f5f9;
            color: #2f4858;
            font-weight: 900;
        }

        #tempCleaningTable td {
            height: 100px;
            border: 1px solid #d8dee6;
            vertical-align: top;
            background: #fff;
            padding: 0;
        }

        #tempCleaningTable td.empty {
            background: #f8fafc;
        }

        #tempCleaningTable .clean-day {
            height: 26px;
            line-height: 26px;
            padding-left: 8px;
            font-weight: 900;
            color: #2f4858;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
        }

        #tempCleaningTable .clean-cell {
            width: 100%;
            height: 72px;
            border: 0;
            resize: none;
            padding: 8px;
            box-sizing: border-box;
            outline: none;
            font-size: 17px;
            font-family: "Comic Sans MS", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
            font-weight: 900;
            color: #334155;
            text-align: center;
            line-height: 1.35;
            background: #fff;
        }



        #tempCleaningTable .clean-cell:empty::before {
            content: attr(data-placeholder);
            color: #94a3b8;
        }

        .clean-name-songhee {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        .pochacco-icon {
            width: 24px;
            height: 24px;
            object-fit: contain;
            vertical-align: middle;
        }

        .temp-clean-memo {
            width: 100%;
            height: 92px;
            margin-top: 14px;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            padding: 12px;
            resize: vertical;
            box-sizing: border-box;
            outline: none;
            font-size: 15px;
            font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        }
    `;

    document.head.appendChild(style);
}

window.renderTempCleaning = renderTempCleaning;