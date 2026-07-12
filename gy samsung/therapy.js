import { db, doc, getDoc, setDoc } from "./firebase.js";

const therapyItems = ["도수", "충격파", "신장분사", "페인 스크램블러", "리푸스"];
const therapyCols = ["신환", "재진", "매출", "상담", "예약"];

// 실제 이름으로 name만 변경하면 탭과 화면에 같이 반영됩니다.
const therapistConfig = [
    { pt: 1, name: "최주연" },
    { pt: 2, name: "하영진" },
    { pt: 3, name: "김민지" },
    { pt: 4, name: "박수진" },
    { pt: 5, name: "박영민" },
    { pt: 6, name: "이혜영" },
    { pt: 7, name: "이나현" },
    { pt: 8, name: "정이제" }
];

// PS30, PS50 삭제
const ptItems = [
    "PS33", "PS55",
    "CRYO2", "CRYO3", "CRYO4", "CRYO5", "CRYO6", "CRYO9", "CRYO15",
    "충격파F", "충격파2", "충격파4", "충격파6", "충격파7",
    "충격파10", "충격파11", "충격파15", "충격파16"
];

const adminSummaryRows = ["기간 내", "한달 전 기간 내", "전월 총 현황", "한달 전 기간 내 대비"];
const adminSummaryCols = ["신환", "재진", "합계", "재진 비율", "수익"];

let therapyData = {};
let ptData = {};
let deskExtraData = { reservation: {} };
let rangeSummaryData = null;
let isPtRangeReadOnly = false;

const yearSelect = document.getElementById("therapyYear");
const monthSelect = document.getElementById("therapyMonth");
const daySelect = document.getElementById("therapyDay");
const rangeStartInput = document.getElementById("ptRangeStart");
const rangeEndInput = document.getElementById("ptRangeEnd");
const rangeSearchBtn = document.getElementById("ptRangeSearchBtn");

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth() + 1;
let currentDay = today.getDate();

for (let y = 2024; y <= 2035; y++) yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
for (let m = 1; m <= 12; m++) monthSelect.innerHTML += `<option value="${m}">${m}월</option>`;

function pad2(value) {
    return String(value).padStart(2, "0");
}

function dateToInputValue(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseInputDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function isSameCalendarDate(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function syncClosingDateTo(date) {
    currentYear = date.getFullYear();
    currentMonth = date.getMonth() + 1;
    currentDay = date.getDate();
    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;
    updateDays();
    daySelect.value = currentDay;
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function shiftMonthClamped(date, amount) {
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + amount);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
}

function updateDays() {
    const lastDay = new Date(Number(yearSelect.value), Number(monthSelect.value), 0).getDate();
    daySelect.innerHTML = "";
    for (let d = 1; d <= lastDay; d++) daySelect.innerHTML += `<option value="${d}">${d}일</option>`;
    if (currentDay > lastDay) currentDay = lastDay;
    daySelect.value = currentDay;
}

yearSelect.value = currentYear;
monthSelect.value = currentMonth;
updateDays();
daySelect.value = currentDay;

function getSelectedDate() {
    return new Date(Number(yearSelect.value), Number(monthSelect.value) - 1, Number(daySelect.value));
}

function getDateKeyFromDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getDateKey() {
    return getDateKeyFromDate(getSelectedDate());
}

function initializeRangeInputs(force = false) {
    if (!rangeStartInput || !rangeEndInput) return;
    if (!force && rangeStartInput.value && rangeEndInput.value) return;

    const selected = getSelectedDate();
    const selectedValue = dateToInputValue(selected);

    rangeStartInput.value = selectedValue;
    rangeEndInput.value = selectedValue;
}
function normalizeInputValue(value) {
    if (value === "") return "";
    return Number(value) || 0;
}

function displayInputValue(value) {
    return value === undefined || value === null ? "" : value;
}

function numericValue(value) {
    return Number(value) || 0;
}

function formatWon(value) {
    return `${numericValue(value).toLocaleString("ko-KR")}원`;
}

function getPtItemData(sourcePtData, ptNum, item) {
    return sourcePtData?.[`pt${ptNum}`]?.[item] || {};
}

function getStoredTreatmentValue(sourcePtData, ptNum, item, col) {
    const data = getPtItemData(sourcePtData, ptNum, item);

    // 이전 버전의 일반/W 분리 자료도 새 단일 건수·매출 칸에 합산해 표시합니다.
    if (col === "건수" && data[col] === undefined) {
        return numericValue(data["일반건수"]) + numericValue(data["W건수"]);
    }
    if (col === "매출" && data[col] === undefined) {
        return numericValue(data["일반매출"]) + numericValue(data["W매출"]);
    }

    return data[col];
}

function getPtNumberFrom(sourcePtData, ptNum, item, col) {
    return numericValue(getStoredTreatmentValue(sourcePtData, ptNum, item, col));
}

function getPatientStatsFrom(sourcePtData, ptNum) {
    const patientStats = sourcePtData?.[`pt${ptNum}`]?.patientStats || {};
    const newCount = numericValue(patientStats["신환"]);
    const revisitCount = numericValue(patientStats["재진"]);
    const total = newCount + revisitCount;
    const revisitRate = total > 0 ? Math.round((revisitCount / total) * 100) : 0;
    return { newCount, revisitCount, total, revisitRate };
}

function getTherapistTotalsFrom(sourcePtData, ptNum) {
    return ptItems.reduce((total, item) => {
        total.count += getPtNumberFrom(sourcePtData, ptNum, item, "건수");
        total.sales += getPtNumberFrom(sourcePtData, ptNum, item, "매출");
        total.incentive += getPtNumberFrom(sourcePtData, ptNum, item, "인센티브");
        return total;
    }, { count: 0, sales: 0, incentive: 0 });
}

function getGrandTotalsFrom(sourcePtData) {
    return therapistConfig.reduce((total, therapist) => {
        const patient = getPatientStatsFrom(sourcePtData, therapist.pt);
        const treatment = getTherapistTotalsFrom(sourcePtData, therapist.pt);
        total.newCount += patient.newCount;
        total.revisitCount += patient.revisitCount;
        total.sales += treatment.sales;
        return total;
    }, { newCount: 0, revisitCount: 0, sales: 0 });
}

function emptySummary() {
    return { newCount: 0, revisitCount: 0, total: 0, revisitRate: 0, sales: 0 };
}

function finalizeSummary(summary) {
    summary.total = summary.newCount + summary.revisitCount;
    summary.revisitRate = summary.total > 0 ? Math.round((summary.revisitCount / summary.total) * 100) : 0;
    return summary;
}

async function loadTherapyData() {
    const snap = await getDoc(doc(db, "closings", getDateKey()));
    const data = snap.exists() ? snap.data() : {};
    therapyData = data.therapyData || {};
    ptData = data.ptData || {};
    deskExtraData = data.deskExtraData || { reservation: {} };
    if (!deskExtraData.reservation) deskExtraData.reservation = {};
}

async function loadRangeAggregate(startDate, endDate) {
    const summary = emptySummary();
    let cursor = new Date(startDate);

    while (cursor <= endDate) {
        const snap = await getDoc(doc(db, "closings", getDateKeyFromDate(cursor)));
        if (snap.exists()) {
            const dayPtData = snap.data().ptData || {};
            const dayTotal = getGrandTotalsFrom(dayPtData);
            summary.newCount += dayTotal.newCount;
            summary.revisitCount += dayTotal.revisitCount;
            summary.sales += dayTotal.sales;
        }
        cursor = addDays(cursor, 1);
    }

    return finalizeSummary(summary);
}

async function refreshRangeSummary() {
    if (!rangeStartInput || !rangeEndInput) return;
    const start = parseInputDate(rangeStartInput.value);
    const end = parseInputDate(rangeEndInput.value);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        alert("조회 기간을 올바르게 선택해주세요.");
        return;
    }

    isPtRangeReadOnly = !isSameCalendarDate(start, end);

    // 하루만 조회할 때는 해당 날짜의 원본 자료를 불러와 편집 대상으로 사용합니다.
    if (!isPtRangeReadOnly) {
        syncClosingDateTo(start);
        await loadTherapyData();
    }

    if (rangeSearchBtn) {
        rangeSearchBtn.disabled = true;
        rangeSearchBtn.textContent = "조회 중...";
    }

    try {
        const previousStart = shiftMonthClamped(start, -1);
        const previousEnd = shiftMonthClamped(end, -1);
        const previousMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
        const previousMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);

        const [currentRange, previousRange, previousMonth] = await Promise.all([
            loadRangeAggregate(start, end),
            loadRangeAggregate(previousStart, previousEnd),
            loadRangeAggregate(previousMonthStart, previousMonthEnd)
        ]);

        rangeSummaryData = {
            "기간 내": currentRange,
            "한달 전 기간 내": previousRange,
            "전월 총 현황": previousMonth,
            "한달 전 기간 내 대비": {
                newCount: currentRange.newCount - previousRange.newCount,
                revisitCount: currentRange.revisitCount - previousRange.revisitCount,
                total: currentRange.total - previousRange.total,
                revisitRate: currentRange.revisitRate - previousRange.revisitRate,
                sales: currentRange.sales - previousRange.sales
            }
        };
        renderPtPages();
    } finally {
        if (rangeSearchBtn) {
            rangeSearchBtn.disabled = false;
            rangeSearchBtn.textContent = "기간 조회";
        }
    }
}

async function persistPtData() {
    await setDoc(doc(db, "closings", getDateKey()), { ptData }, { merge: true });
}

async function saveTherapyData(roomNum, item, col, value) {
    if (!therapyData[`room${roomNum}`]) therapyData[`room${roomNum}`] = {};
    if (!therapyData[`room${roomNum}`][item]) therapyData[`room${roomNum}`][item] = {};
    therapyData[`room${roomNum}`][item][col] = Number(value) || 0;
    await setDoc(doc(db, "closings", getDateKey()), { therapyData }, { merge: true });
}

async function saveReservationInput(row, col, value) {
    if (!deskExtraData.reservation[row]) deskExtraData.reservation[row] = {};
    deskExtraData.reservation[row][col] = Number(value) || 0;
    await setDoc(doc(db, "closings", getDateKey()), {
        deskExtraData: { ...deskExtraData, reservation: deskExtraData.reservation }
    }, { merge: true });
}

async function savePtInput(ptNum, item, col, value) {
    if (isPtRangeReadOnly) {
        alert("하루를 초과한 기간 조회에서는 데이터를 수정할 수 없습니다.");
        return;
    }
    const ptKey = `pt${ptNum}`;
    if (!ptData[ptKey]) ptData[ptKey] = {};
    if (!ptData[ptKey][item]) ptData[ptKey][item] = {};
    ptData[ptKey][item][col] = normalizeInputValue(value);
    await persistPtData();
}

async function savePtPatientStat(ptNum, col, value) {
    if (isPtRangeReadOnly) {
        alert("하루를 초과한 기간 조회에서는 데이터를 수정할 수 없습니다.");
        return;
    }
    const ptKey = `pt${ptNum}`;
    if (!ptData[ptKey]) ptData[ptKey] = {};
    if (!ptData[ptKey].patientStats) ptData[ptKey].patientStats = {};
    ptData[ptKey].patientStats[col] = normalizeInputValue(value);
    await persistPtData();
}

function renderTherapyRooms() {
    for (let i = 1; i <= 5; i++) {
        if (!therapyData[`room${i}`]) therapyData[`room${i}`] = {};
        const page = document.getElementById(`therapyRoom${i}`);
        if (!page) continue;
        page.innerHTML = `
            <h3><span class="big-dot"></span>진료실 비급여 건수 / 매출 / 상담 정보 입력</h3>
            <table class="therapy-table">
                <thead><tr><th>구분</th>${therapyCols.map(col => `<th>${col}</th>`).join("")}</tr></thead>
                <tbody>${therapyItems.map(item => {
                    if (!therapyData[`room${i}`][item]) therapyData[`room${i}`][item] = {};
                    return `<tr><td>${item}</td>${therapyCols.map(col => `<td><input type="number" value="${therapyData[`room${i}`][item][col] || 0}" oninput="saveTherapyData(${i}, '${item}', '${col}', this.value)"></td>`).join("")}</tr>`;
                }).join("")}</tbody>
            </table>`;
    }
}

function renderPatientStatsTable(ptNum, editable = true) {
    const canEdit = editable && !isPtRangeReadOnly;
    const stats = getPatientStatsFrom(ptData, ptNum);
    const raw = ptData[`pt${ptNum}`]?.patientStats || {};
    return `
        <table class="therapy-table pt-patient-table">
            <thead><tr><th>신환</th><th>재진</th><th>합계</th><th>재진 전환율</th></tr></thead>
            <tbody><tr>
                <td>${canEdit ? `<input type="number" min="0" value="${displayInputValue(raw["신환"])}" oninput="savePtPatientStat(${ptNum}, '신환', this.value)">` : `${stats.newCount}명`}</td>
                <td>${canEdit ? `<input type="number" min="0" value="${displayInputValue(raw["재진"])}" oninput="savePtPatientStat(${ptNum}, '재진', this.value)">` : `${stats.revisitCount}명`}</td>
                <td>${stats.total}명</td><td>${stats.revisitRate}%</td>
            </tr></tbody>
        </table>`;
}

function renderTreatmentInputTable(ptNum) {
    const disabledAttr = isPtRangeReadOnly ? "disabled" : "";
    const ptKey = `pt${ptNum}`;
    if (!ptData[ptKey]) ptData[ptKey] = {};

    return `
        <table class="therapy-table pt-treatment-table">
            <thead>
                <tr>
                    <th>치료 내역</th>
                    <th>건수</th>
                    <th>매출</th>
                    <th>인센티브</th>
                </tr>
            </thead>
            <tbody>${ptItems.map(item => {
                if (!ptData[ptKey][item]) ptData[ptKey][item] = {};
                return `<tr>
                    <td class="pt-item-name"><span>${item}</span></td>
                    <td><input type="number" min="0" ${disabledAttr} value="${displayInputValue(getStoredTreatmentValue(ptData, ptNum, item, "건수"))}" oninput="savePtInput(${ptNum}, '${item}', '건수', this.value)"></td>
                    <td><input type="number" min="0" ${disabledAttr} value="${displayInputValue(getStoredTreatmentValue(ptData, ptNum, item, "매출"))}" oninput="savePtInput(${ptNum}, '${item}', '매출', this.value)"></td>
                    <td><input type="number" min="0" ${disabledAttr} placeholder="" value="${displayInputValue(getStoredTreatmentValue(ptData, ptNum, item, "인센티브"))}" oninput="savePtInput(${ptNum}, '${item}', '인센티브', this.value)"></td>
                </tr>`;
            }).join("")}</tbody>
        </table>`;
}

function signedNumber(value, suffix = "") {
    const number = numericValue(value);
    if (number > 0) return `<span class="pt-up">▲${number.toLocaleString("ko-KR")}${suffix}</span>`;
    if (number < 0) return `<span class="pt-down">▼${Math.abs(number).toLocaleString("ko-KR")}${suffix}</span>`;
    return `<span class="pt-same">0${suffix}</span>`;
}

function renderAdminSummaryTable() {
    const data = rangeSummaryData || Object.fromEntries(adminSummaryRows.map(row => [row, emptySummary()]));
    return `
        <table class="therapy-table pt-summary-table">
            <thead><tr><th></th>${adminSummaryCols.map(col => `<th>${col}</th>`).join("")}</tr></thead>
            <tbody>${adminSummaryRows.map(row => {
                const value = data[row] || emptySummary();
                const compare = row === "한달 전 기간 내 대비";
                return `<tr><th>${row}</th>
                    <td>${compare ? signedNumber(value.newCount, "명") : `${value.newCount}명`}</td>
                    <td>${compare ? signedNumber(value.revisitCount, "명") : `${value.revisitCount}명`}</td>
                    <td>${compare ? signedNumber(value.total, "명") : `${value.total}명`}</td>
                    <td>${compare ? signedNumber(value.revisitRate, "%p") : `${value.revisitRate}%`}</td>
                    <td>${compare ? signedNumber(value.sales, "원") : formatWon(value.sales)}</td>
                </tr>`;
            }).join("")}</tbody>
        </table>`;
}

function renderRangeEditNotice() {
    return isPtRangeReadOnly
        ? `<div class="pt-readonly-notice"><span class="pt-readonly-icon">🔒</span><div><strong>기간 조회 · 수정 불가</strong><p>하루를 초과한 기간은 합산 조회 전용입니다. 수정하려면 시작일과 종료일을 같은 날짜로 선택하세요.</p></div></div>`
        : `<div class="pt-editable-notice"><span>●</span> 하루 조회 · 입력 및 수정 가능</div>`;
}

function renderAdminPtPage() {
    const page = document.getElementById("therapy-temp1");
    if (!page) return;
    page.innerHTML = `
        <div class="therapy-card pt-admin-card">
            <h2 class="therapy-title">PT1 관리자 통합 현황</h2>
            <div class="pt-selected-date">조회 기간: <strong>${rangeStartInput?.value || "-"} ~ ${rangeEndInput?.value || "-"}</strong></div>
            ${renderRangeEditNotice()}
            <h3><span class="big-dot"></span>기간별 전체 환자 현황</h3>
            ${renderAdminSummaryTable()}
            <h3 class="pt-section-title"><span class="big-dot"></span>PT1 환자 현황 입력</h3>
            ${renderPatientStatsTable(1, true)}
            <h3 class="pt-section-title"><span class="big-dot"></span>PT1 치료 내역 입력</h3>
            ${renderTreatmentInputTable(1)}
            <h3 class="pt-section-title"><span class="big-dot"></span>치료사별 환자 현황</h3>
            <div class="pt-therapist-list">${therapistConfig.map(therapist => {
                const totals = getTherapistTotalsFrom(ptData, therapist.pt);
                const stats = getPatientStatsFrom(ptData, therapist.pt);
                return `<details class="pt-therapist-detail" ${therapist.pt === 1 ? "open" : ""}>
                    <summary><strong>${therapist.name}</strong><span>신환 ${stats.newCount}명 · 재진 ${stats.revisitCount}명 · ${stats.revisitRate}% · ${formatWon(totals.sales)}</span></summary>
                    ${renderPatientStatsTable(therapist.pt, false)}
                    <table class="therapy-table">
                        <thead><tr><th>치료 내역</th><th>건수</th><th>매출</th><th>인센티브</th></tr></thead>
                        <tbody>${ptItems.map(item => `<tr>
                            <td>${item}</td>
                            <td>${getPtNumberFrom(ptData, therapist.pt, item, "건수")}건</td>
                            <td>${formatWon(getPtNumberFrom(ptData, therapist.pt, item, "매출"))}</td>
                            <td>${getStoredTreatmentValue(ptData, therapist.pt, item, "인센티브") === "" || getStoredTreatmentValue(ptData, therapist.pt, item, "인센티브") === undefined ? "" : formatWon(getPtNumberFrom(ptData, therapist.pt, item, "인센티브"))}</td>
                        </tr>`).join("")}</tbody>
                    </table>
                </details>`;
            }).join("")}</div>
        </div>`;
}

function renderTherapistPtPages() {
    therapistConfig.filter(t => t.pt !== 1).forEach(therapist => {
        const page = document.getElementById(`therapy-temp${therapist.pt}`);
        if (!page) return;
        page.innerHTML = `<div class="therapy-card">
            <h2 class="therapy-title">${therapist.name}</h2>
            <div class="pt-selected-date">조회 기간: <strong>${rangeStartInput?.value || "-"} ~ ${rangeEndInput?.value || "-"}</strong></div>
            ${renderRangeEditNotice()}
            <h3><span class="big-dot"></span>환자 현황 입력</h3>${renderPatientStatsTable(therapist.pt, true)}
            <h3 class="pt-section-title"><span class="big-dot"></span>치료 내역 입력</h3>${renderTreatmentInputTable(therapist.pt)}
        </div>`;
    });
}

function renderPtPages() {
    renderAdminPtPage();
    renderTherapistPtPages();
}

function updatePtTabLabels() {
    therapistConfig.forEach(therapist => {
        const tab = document.querySelector(`[data-tab="therapy-temp${therapist.pt}"]`);
        tab.textContent = therapist.name;
    });
}

async function loadReservationInputs() {
    const reservation = deskExtraData.reservation || {};
    document.getElementById("therapyReserve").value = reservation["도수"]?.["예약"] || 0;
    document.getElementById("therapyChange").value = reservation["도수"]?.["변경"] || 0;
    document.getElementById("therapyCancel").value = reservation["도수"]?.["취소"] || 0;
    document.getElementById("shockReserve").value = reservation["충격파"]?.["예약"] || 0;
    document.getElementById("shockChange").value = reservation["충격파"]?.["변경"] || 0;
    document.getElementById("shockCancel").value = reservation["충격파"]?.["취소"] || 0;
}

async function reloadTherapyPage({ resetRange = false } = {}) {
    await loadTherapyData();
    renderTherapyRooms();
    renderPtPages();
    await loadReservationInputs();
    initializeRangeInputs(resetRange);
    await refreshRangeSummary();
}

yearSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadTherapyPage({ resetRange: true });
});
monthSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadTherapyPage({ resetRange: true });
});
daySelect.addEventListener("change", () => reloadTherapyPage({ resetRange: true }));

function changeDate(diff) {
    const date = getSelectedDate();
    date.setDate(date.getDate() + diff);
    yearSelect.value = date.getFullYear();
    monthSelect.value = date.getMonth() + 1;
    currentDay = date.getDate();
    updateDays();
    daySelect.value = currentDay;
    reloadTherapyPage({ resetRange: true });
}

document.getElementById("prevDay").addEventListener("click", () => changeDate(-1));
document.getElementById("nextDay").addEventListener("click", () => changeDate(1));
if (rangeSearchBtn) rangeSearchBtn.addEventListener("click", refreshRangeSummary);

function openTherapyRoom(event, roomId) {
    document.querySelectorAll(".therapy-tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".therapy-page").forEach(page => page.classList.remove("active"));
    event.currentTarget.classList.add("active");
    document.getElementById(roomId).classList.add("active");
}

const therapyTopTabs = document.querySelectorAll(".therapy-top-tab");
const therapyTopPages = document.querySelectorAll(".therapy-top-page");
const closingDateToolbar = document.getElementById("closingDateToolbar");
const ptRangeToolbar = document.getElementById("ptRangeToolbar");

function updateToolbarForTopTab(tabId) {
    const isClosingPage = tabId === "therapy-main-page";
    if (closingDateToolbar) closingDateToolbar.hidden = !isClosingPage;
    if (ptRangeToolbar) ptRangeToolbar.hidden = isClosingPage;
}

therapyTopTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        therapyTopTabs.forEach(t => t.classList.remove("active"));
        therapyTopPages.forEach(page => page.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
        updateToolbarForTopTab(tab.dataset.tab);
    });
});

updateToolbarForTopTab(document.querySelector(".therapy-top-tab.active")?.dataset.tab || "therapy-main-page");

const floatingNav = document.querySelector(".sidebar .nav");
if (floatingNav) {
    window.addEventListener("scroll", () => requestAnimationFrame(() => {
        floatingNav.style.transform = `translateY(${window.scrollY}px)`;
    }));
}

window.openTherapyRoom = openTherapyRoom;
window.saveTherapyData = saveTherapyData;
window.saveReservationInput = saveReservationInput;
window.savePtInput = savePtInput;
window.savePtPatientStat = savePtPatientStat;

updatePtTabLabels();
initializeRangeInputs(true);
reloadTherapyPage();
