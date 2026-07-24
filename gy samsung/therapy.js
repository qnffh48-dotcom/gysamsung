import { db, doc, getDoc, setDoc } from "./firebase.js";

const therapyItems = ["충격파", "신장분사", "페인스크램블러", "리푸스"];
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

const ptItems = [
    "복합운동상담",
    "PS30", "PS33", "PS50", "PS55",
    "CRYO2", "CRYO3", "CRYO4", "CRYO5", "CRYO6", "CRYO6H", "CRYO6W", "CRYO9", "CRYO15",
    "충격파F", "충격파6", "충격파8",
    "충격파10", "충격파11", "충격파15", "충격파16",
    "리푸스"
];

const adminSummaryRows = ["기간 내", "한달 전 기간 내", "전월 총 현황", "한달 전 기간 내 대비"];
const adminSummaryCols = ["신환", "전체 재진", "합계", "전체 재진전환율", "수익"];

let therapyData = {};
let ptData = {};
let deskExtraData = { reservation: {} };
let rangeSummaryData = null;
let currentRangeRecords = null;
let isPtRangeReadOnly = false;
let activeNonpayTherapist = 1;

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

function hasTreatmentIncentive(item) {
    const treatment = String(item || "").trim();

    return treatment === "PS33"
        || treatment === "PS55"
        || ["CRYO6", "CRYO6H", "CRYO6W", "CRYO9", "CRYO15"].includes(treatment)
        || treatment.startsWith("충격파");
}

function getTreatmentIncentive(item, amount) {
    const treatment = String(item || "").trim();
    const sales = numericValue(amount);

    // PS는 PS33, PS55만 7%
    if (treatment === "PS33" || treatment === "PS55") {
        return Math.round(sales * 0.07);
    }

    // CRYO는 6 이상만 7% (6H, 6W 포함)
    if (["CRYO6", "CRYO6H", "CRYO6W", "CRYO9", "CRYO15"].includes(treatment)) {
        return Math.round(sales * 0.07);
    }

    // 충격파F는 건당 1,000원, 나머지 충격파는 7%
    if (treatment === "충격파F") {
        return 1000;
    }
    if (treatment.startsWith("충격파")) {
        return Math.round(sales * 0.07);
    }

    // 복합운동상담, PS30, PS50, CRYO2~5, 리푸스는 인센티브 없음
    return 0;
}

function formatWon(value) {
    return `${numericValue(value).toLocaleString("ko-KR")}원`;
}

function getPtItemData(sourcePtData, ptNum, item) {
    return sourcePtData?.[`pt${ptNum}`]?.[item] || {};
}

function getStoredTreatmentValue(sourcePtData, ptNum, item, col) {
    const records = Array.isArray(sourcePtData?.nonpayRecords) ? sourcePtData.nonpayRecords : [];
    const matchedRecords = records.filter(record =>
        Number(record.pt) === Number(ptNum) && String(record.item || "") === String(item)
    );

    // 비급여치료 입력 내역을 최우선으로 자동 집계합니다.
    if (matchedRecords.length > 0) {
        if (col === "건수") return matchedRecords.length;
        if (col === "매출") {
            return matchedRecords.reduce((sum, record) => sum + numericValue(record.amount), 0);
        }
        if (col === "인센티브") {
            return matchedRecords.reduce((sum, record) => {
                return sum + getTreatmentIncentive(record.item, record.amount);
            }, 0);
        }
    }

    const data = getPtItemData(sourcePtData, ptNum, item);

    // 기존 수기 자료가 남아 있으면 과거 데이터 호환용으로만 표시합니다.
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

function getRecordSortValue(record) {
    const date = String(record.treatmentDate || "").trim();
    const createdAt = String(record.createdAt || "").trim();
    return `${date}T${createdAt}`;
}

function getValidChartNumber(record) {
    return String(record?.chartNumber || "").trim();
}

// 치료사 개인 성과: 같은 치료사가 신환을 보고, 이후 같은 치료사가 재진까지 본 경우만 전환 인정
function getPersonalConversionStats(records, ptNum) {
    const therapistRecords = (Array.isArray(records) ? records : [])
        .filter(record => Number(record.pt) === Number(ptNum) && getValidChartNumber(record))
        .slice()
        .sort((a, b) => getRecordSortValue(a).localeCompare(getRecordSortValue(b)));

    const patients = new Map();
    therapistRecords.forEach(record => {
        const chart = getValidChartNumber(record);
        if (!patients.has(chart)) patients.set(chart, { firstNew: null, converted: false, seen: true });
        const patient = patients.get(chart);
        const order = getRecordSortValue(record);
        if (record.patientType === "신환" && patient.firstNew === null) patient.firstNew = order;
        if (record.patientType === "재진" && patient.firstNew !== null && order >= patient.firstNew) patient.converted = true;
    });

    const newCount = Array.from(patients.values()).filter(patient => patient.firstNew !== null).length;
    const revisitCount = Array.from(patients.values()).filter(patient => patient.firstNew !== null && patient.converted).length;
    const total = patients.size;
    const revisitRate = newCount > 0 ? Math.round((revisitCount / newCount) * 1000) / 10 : 0;
    return { newCount, revisitCount, total, revisitRate };
}

// 병원 전체 성과: 신환 치료사와 재진 치료사가 달라도 차트번호가 같으면 전환 인정
function getOverallConversionStats(records) {
    const sorted = (Array.isArray(records) ? records : [])
        .filter(record => getValidChartNumber(record))
        .slice()
        .sort((a, b) => getRecordSortValue(a).localeCompare(getRecordSortValue(b)));

    const patients = new Map();
    sorted.forEach(record => {
        const chart = getValidChartNumber(record);
        if (!patients.has(chart)) patients.set(chart, { firstNew: null, converted: false });
        const patient = patients.get(chart);
        const order = getRecordSortValue(record);
        if (record.patientType === "신환" && patient.firstNew === null) patient.firstNew = order;
        if (record.patientType === "재진" && patient.firstNew !== null && order >= patient.firstNew) patient.converted = true;
    });

    const newCount = Array.from(patients.values()).filter(patient => patient.firstNew !== null).length;
    const revisitCount = Array.from(patients.values()).filter(patient => patient.firstNew !== null && patient.converted).length;
    const total = patients.size;
    const revisitRate = newCount > 0 ? Math.round((revisitCount / newCount) * 1000) / 10 : 0;
    return { newCount, revisitCount, total, revisitRate };
}

function getPatientStatsFrom(sourcePtData, ptNum) {
    const records = currentRangeRecords || (Array.isArray(sourcePtData?.nonpayRecords) ? sourcePtData.nonpayRecords : []);
    return getPersonalConversionStats(records, ptNum);
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
    const records = currentRangeRecords || (Array.isArray(sourcePtData?.nonpayRecords) ? sourcePtData.nonpayRecords : []);
    const patient = getOverallConversionStats(records);
    const sales = records.reduce((sum, record) => sum + numericValue(record.amount), 0);
    return { newCount: patient.newCount, revisitCount: patient.revisitCount, sales };
}

function emptySummary() {
    return { newCount: 0, revisitCount: 0, total: 0, revisitRate: 0, sales: 0 };
}

function makeOverallSummary(records) {
    const patient = getOverallConversionStats(records);
    return {
        newCount: patient.newCount,
        revisitCount: patient.revisitCount,
        total: patient.total,
        revisitRate: patient.revisitRate,
        sales: (records || []).reduce((sum, record) => sum + numericValue(record.amount), 0)
    };
}

async function loadTherapyData() {
    const snap = await getDoc(doc(db, "closings", getDateKey()));
    const data = snap.exists() ? snap.data() : {};
    therapyData = data.therapyData || {};
    ptData = data.ptData || {};
    if (!Array.isArray(ptData.nonpayRecords)) ptData.nonpayRecords = [];
    rebuildPtAutoData(ptData);

    // 비급여 입력 내역을 기준으로 물리치료 마감일지를 항상 다시 계산합니다.
    // 저장 당시 집계가 누락됐던 기존 자료도 화면에서 즉시 정상 반영됩니다.
    if (ptData.nonpayRecords.length > 0) {
        therapyData = aggregateTherapyDataFromNonpayRecords(ptData.nonpayRecords);
    }

    // 예전 키 이름을 새 표기명으로 자동 이전합니다.
    Object.values(therapyData).forEach(room => {
        if (room?.["페인 스크램블러"] && !room["페인스크램블러"]) {
            room["페인스크램블러"] = room["페인 스크램블러"];
        }
        if (room) delete room["페인 스크램블러"];
        if (room) delete room["도수"];
    });

    deskExtraData = data.deskExtraData || { reservation: {} };
    if (!deskExtraData.reservation) deskExtraData.reservation = {};
}

async function loadRangeRecords(startDate, endDate) {
    const records = [];
    let cursor = new Date(startDate);

    while (cursor <= endDate) {
        const snap = await getDoc(doc(db, "closings", getDateKeyFromDate(cursor)));
        if (snap.exists()) {
            const dayRecords = snap.data()?.ptData?.nonpayRecords;
            if (Array.isArray(dayRecords)) records.push(...dayRecords);
        }
        cursor = addDays(cursor, 1);
    }
    return records;
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

        const [currentRecords, previousRecords, previousMonthRecords] = await Promise.all([
            loadRangeRecords(start, end),
            loadRangeRecords(previousStart, previousEnd),
            loadRangeRecords(previousMonthStart, previousMonthEnd)
        ]);

        currentRangeRecords = currentRecords;
        const currentRange = makeOverallSummary(currentRecords);
        const previousRange = makeOverallSummary(previousRecords);
        const previousMonth = makeOverallSummary(previousMonthRecords);

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


function mapNonpayCategory(item) {
    if (String(item).startsWith("PS")) return "페인스크램블러";
    if (String(item).startsWith("CRYO")) return "신장분사";
    if (String(item).startsWith("충격파")) return "충격파";
    if (item === "리푸스") return "리푸스";
    return null;
}

function createEmptyTherapyAutoData() {
    const result = {};
    for (let room = 1; room <= 5; room++) {
        result[`room${room}`] = {};
        therapyItems.forEach(item => {
            result[`room${room}`][item] = { 신환: 0, 재진: 0, 매출: 0, 상담: 0, 예약: 0 };
        });
    }
    return result;
}

function aggregateTherapyDataFromNonpayRecords(records) {
    const aggregated = createEmptyTherapyAutoData();
    (Array.isArray(records) ? records : []).forEach(record => {
        const category = mapNonpayCategory(record.item);
        const roomNum = Number(record.room);
        if (!category || roomNum < 1 || roomNum > 5) return;

        const target = aggregated[`room${roomNum}`][category];
        if (record.patientType === "신환") target.신환 += 1;
        if (record.patientType === "재진") target.재진 += 1;
        target.매출 += numericValue(record.amount);
        target.상담 += record.consultation ? 1 : 0;
        target.예약 += record.reservation ? 1 : 0;
    });
    return aggregated;
}

async function syncNonpayRecordsToClosing() {
    const records = Array.isArray(ptData.nonpayRecords) ? ptData.nonpayRecords : [];
    therapyData = aggregateTherapyDataFromNonpayRecords(records);
    rebuildPtAutoData(ptData);
    await setDoc(doc(db, "closings", getDateKey()), { therapyData, ptData }, { merge: true });
    renderTherapyRooms();
    renderPtPages();
}


function rebuildPtAutoData(targetPtData) {
    if (!targetPtData || typeof targetPtData !== "object") targetPtData = {};
    const records = Array.isArray(targetPtData.nonpayRecords) ? targetPtData.nonpayRecords : [];

    // 기존 자동 집계값을 치료사별로 다시 생성합니다.
    therapistConfig.forEach(({ pt }) => {
        const ptKey = `pt${pt}`;
        if (!targetPtData[ptKey] || typeof targetPtData[ptKey] !== "object") targetPtData[ptKey] = {};

        ptItems.forEach(item => {
            targetPtData[ptKey][item] = { 건수: 0, 매출: 0, 인센티브: 0 };
        });

        const uniquePatients = new Map();
        records
            .filter(record => Number(record.pt) === Number(pt))
            .forEach(record => {
                const item = String(record.item || "").trim();
                if (ptItems.includes(item)) {
                    const row = targetPtData[ptKey][item];
                    row.건수 += 1;
                    row.매출 += numericValue(record.amount);
                    row.인센티브 += getTreatmentIncentive(record.item, record.amount);
                }

                const patientKey = String(record.chartNumber || record.patientName || record.id || "").trim();
                if (patientKey && !uniquePatients.has(patientKey)) {
                    uniquePatients.set(patientKey, record.patientType);
                }
            });

        let newCount = 0;
        let revisitCount = 0;
        uniquePatients.forEach(type => {
            if (type === "신환") newCount += 1;
            if (type === "재진") revisitCount += 1;
        });
        targetPtData[ptKey].patientStats = { 신환: newCount, 재진: revisitCount };
    });

    return targetPtData;
}

function getTherapistName(ptNum) {
    return therapistConfig.find(item => item.pt === Number(ptNum))?.name || `PT${ptNum}`;
}


function hasPercentageIncentive(item) {
    const treatment = String(item || "").trim();
    return [
        "PS33", "PS55",
        "CRYO6", "CRYO6H", "CRYO6W", "CRYO9", "CRYO15",
        "충격파6", "충격파8", "충격파10", "충격파11", "충격파15", "충격파16"
    ].includes(treatment);
}

function updateNonpayIncentiveRateVisibility() {
    const item = document.getElementById("nonpayItem")?.value || "";
    const rateInput = document.getElementById("nonpayIncentiveRate");
    if (!rateInput) return;

    const isPercentage = hasPercentageIncentive(item);
    const isFixedAmount = item === "충격파F";
    const showIncentive = isPercentage || isFixedAmount;

    // 설정된 인센티브 규칙을 그대로 표시합니다.
    // 7% 항목은 7, 충격파F는 1,000원, 미적용 항목은 행 전체를 숨깁니다.
    if (isPercentage) {
        rateInput.type = "number";
        rateInput.value = "7";
    } else if (isFixedAmount) {
        rateInput.type = "text";
        rateInput.value = "1,000원";
    } else {
        rateInput.type = "number";
        rateInput.value = "";
    }

    rateInput.readOnly = true;
    rateInput.disabled = !showIncentive;

    const fieldContainer = rateInput.closest(
        ".form-group, .input-group, .nonpay-field, .field-row, .form-row, .therapy-input-row, tr"
    );
    const label = document.querySelector('label[for="nonpayIncentiveRate"]');

    if (fieldContainer) {
        fieldContainer.hidden = !showIncentive;
    } else {
        rateInput.hidden = !showIncentive;
        if (label) label.hidden = !showIncentive;
    }
}

function syncNonpayItemOptions() {
    const select = document.getElementById("nonpayItem");
    if (!select) return;

    const previousValue = select.value;
    select.innerHTML = `
        <option value="">선택</option>
        <option value="복합운동상담" style="font-weight:700;">복합운동상담</option>
        <optgroup label="페인스크램블러">
            <option value="PS30">PS30</option>
            <option value="PS33">PS33</option>
            <option value="PS50">PS50</option>
            <option value="PS55">PS55</option>
        </optgroup>
        <optgroup label="신장분사">
            <option value="CRYO2">CRYO2</option>
            <option value="CRYO3">CRYO3</option>
            <option value="CRYO4">CRYO4</option>
            <option value="CRYO5">CRYO5</option>
            <option value="CRYO6">CRYO6</option>
            <option value="CRYO6H">CRYO6H</option>
            <option value="CRYO6W">CRYO6W</option>
            <option value="CRYO9">CRYO9</option>
            <option value="CRYO15">CRYO15</option>
        </optgroup>
        <optgroup label="충격파">
            <option value="충격파F">충격파F</option>
            <option value="충격파6">충격파6</option>
            <option value="충격파8">충격파8</option>
            <option value="충격파10">충격파10</option>
            <option value="충격파11">충격파11</option>
            <option value="충격파15">충격파15</option>
            <option value="충격파16">충격파16</option>
        </optgroup>
        <option value="리푸스" style="font-weight:700;">리푸스</option>
    `;

    if (ptItems.includes(previousValue)) select.value = previousValue;
    select.onchange = updateNonpayIncentiveRateVisibility;
    updateNonpayIncentiveRateVisibility();
}

function openNonpayModal(ptNum) {
    syncNonpayItemOptions();
    if (isPtRangeReadOnly) {
        alert("하루를 초과한 기간 조회에서는 비급여 내역을 입력할 수 없습니다.");
        return;
    }
    activeNonpayTherapist = Number(ptNum);
    const modal = document.getElementById("nonpayModal");
    const therapistLabel = document.getElementById("nonpayTherapistLabel");
    if (therapistLabel) therapistLabel.textContent = getTherapistName(activeNonpayTherapist);
    const treatmentDateInput = document.getElementById("nonpayTreatmentDate");
    if (treatmentDateInput) treatmentDateInput.value = dateToInputValue(getSelectedDate());
    if (modal) modal.hidden = false;
}

function closeNonpayModal() {
    const modal = document.getElementById("nonpayModal");
    if (modal) modal.hidden = true;
}

async function saveNonpayRecord(event) {
    event.preventDefault();
    const chartNumber = document.getElementById("nonpayChartNumber")?.value.trim();
    const patientName = document.getElementById("nonpayPatientName")?.value.trim();
    const patientType = document.querySelector('input[name="nonpayPatientType"]:checked')?.value;
    const room = Number(document.getElementById("nonpayRoom")?.value);
    const item = document.getElementById("nonpayItem")?.value;
    const amount = numericValue(document.getElementById("nonpayAmount")?.value);
    const incentiveRate = hasPercentageIncentive(item) ? 7 : 0;
    const consultation = Boolean(document.getElementById("nonpayConsultation")?.checked);
    const reservation = Boolean(document.getElementById("nonpayReservation")?.checked);
    const treatmentDateValue = document.getElementById("nonpayTreatmentDate")?.value;
    const treatmentDateObject = parseInputDate(treatmentDateValue);

    if (!chartNumber || !patientName || !patientType || !room || !item || Number.isNaN(treatmentDateObject.getTime())) {
        alert("치료 날짜, 차트번호, 환자 이름, 신환/재진, 진료실, 치료 항목을 모두 입력해주세요.");
        return;
    }

    const targetDateKey = getDateKeyFromDate(treatmentDateObject);
    const targetRef = doc(db, "closings", targetDateKey);
    const targetSnap = await getDoc(targetRef);
    const targetData = targetSnap.exists() ? targetSnap.data() : {};
    const targetPtData = targetData.ptData || {};
    if (!Array.isArray(targetPtData.nonpayRecords)) targetPtData.nonpayRecords = [];

    targetPtData.nonpayRecords.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        pt: activeNonpayTherapist,
        therapist: getTherapistName(activeNonpayTherapist),
        chartNumber,
        patientName,
        patientType,
        room,
        item,
        amount,
        incentiveRate,
        consultation,
        reservation,
        treatmentDate: targetDateKey,
        createdAt: new Date().toISOString()
    });

    rebuildPtAutoData(targetPtData);

    const aggregated = aggregateTherapyDataFromNonpayRecords(targetPtData.nonpayRecords);

    await setDoc(targetRef, { ptData: targetPtData, therapyData: aggregated }, { merge: true });

    document.getElementById("nonpayForm")?.reset();
    const incentiveRateEl = document.getElementById("nonpayIncentiveRate");
    if (incentiveRateEl) incentiveRateEl.value = "";
    updateNonpayIncentiveRateVisibility();
    closeNonpayModal();

    syncClosingDateTo(treatmentDateObject);
    initializeRangeInputs(true);
    await reloadTherapyPage({ resetRange: true });
}
async function deleteNonpayRecord(recordId) {
    if (!confirm("이 비급여 치료 내역을 삭제할까요?")) return;
    ptData.nonpayRecords = (ptData.nonpayRecords || []).filter(record => record.id !== recordId);
    await syncNonpayRecordsToClosing();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getGroupedNonpayRecords(ptNum) {
    const records = (ptData.nonpayRecords || []).filter(record => Number(record.pt) === Number(ptNum));
    const groups = new Map();

    records.forEach(record => {
        const key = record.item || "미지정";
        if (!groups.has(key)) {
            groups.set(key, { item: key, count: 0, sales: 0, incentive: 0, consultation: 0, reservation: 0, records: [] });
        }
        const group = groups.get(key);
        group.count += 1;
        group.sales += numericValue(record.amount);
        group.incentive += getTreatmentIncentive(record.item, record.amount);
        group.consultation += record.consultation ? 1 : 0;
        group.reservation += record.reservation ? 1 : 0;
        group.records.push(record);
    });

    return Array.from(groups.values()).sort((a, b) => a.item.localeCompare(b.item, "ko"));
}

function renderNonpayRecords(ptNum) {
    const groups = getGroupedNonpayRecords(ptNum);
    if (!groups.length) return `<div class="nonpay-empty">입력된 비급여 치료 내역이 없습니다.</div>`;

    return `<div class="nonpay-record-list">
        <table class="therapy-table nonpay-record-table">
            <thead><tr><th>치료</th><th>건수</th><th>매출</th><th>인센티브</th><th>상담</th><th>예약</th></tr></thead>
            <tbody>${groups.map(group => `<tr class="nonpay-group-row" onclick="openNonpayDetailModal(${Number(ptNum)}, '${escapeHtml(group.item).replaceAll("'", "\\'")}')" title="클릭하여 환자 명단 보기">
                <td>${escapeHtml(group.item)}</td>
                <td>${group.count}건</td>
                <td>${formatWon(group.sales)}</td>
                <td>${formatWon(group.incentive)}</td>
                <td>${group.consultation}건</td>
                <td>${group.reservation}건</td>
            </tr>`).join("")}</tbody>
        </table>
    </div>`;
}

function openNonpayDetailModal(ptNum, item) {
    const records = (ptData.nonpayRecords || [])
        .filter(record => Number(record.pt) === Number(ptNum) && record.item === item)
        .slice()
        .reverse();
    const modal = document.getElementById("nonpayDetailModal");
    const title = document.getElementById("nonpayDetailTitle");
    const summary = document.getElementById("nonpayDetailSummary");
    const body = document.getElementById("nonpayDetailBody");
    if (!modal || !body) return;

    if (title) title.textContent = `${item} 환자 내역`;
    if (summary) summary.textContent = `${getTherapistName(ptNum)} · 총 ${records.length}건 · ${formatWon(records.reduce((sum, r) => sum + numericValue(r.amount), 0))}`;
    body.innerHTML = records.length ? `<table class="nonpay-detail-table">
        <thead><tr><th>치료일</th><th>차트번호</th><th>환자 이름</th><th>구분</th><th>진료실</th><th>매출</th><th>상담</th><th>예약</th><th></th></tr></thead>
        <tbody>${records.map(record => `<tr>
            <td>${escapeHtml(record.treatmentDate || getDateKey())}</td>
            <td>${escapeHtml(record.chartNumber || "-")}</td>
            <td>${escapeHtml(record.patientName || "-")}</td>
            <td>${escapeHtml(record.patientType)}</td>
            <td>${Number(record.room)}진료실</td>
            <td>${formatWon(record.amount)}</td>
            <td>${record.consultation ? "O" : "-"}</td>
            <td>${record.reservation ? "O" : "-"}</td>
            <td class="nonpay-detail-delete"><button type="button" class="nonpay-delete-btn" onclick="deleteNonpayRecordFromDetail('${record.id}', ${Number(ptNum)}, '${escapeHtml(item).replaceAll("'", "\\'")}')">삭제</button></td>
        </tr>`).join("")}</tbody>
    </table>` : `<div class="nonpay-empty">내역이 없습니다.</div>`;
    modal.hidden = false;
}

function closeNonpayDetailModal() {
    const modal = document.getElementById("nonpayDetailModal");
    if (modal) modal.hidden = true;
}

async function updateNonpayIncentiveRate(recordId, value, ptNum, item) {
    const rate = Math.max(0, Math.min(100, numericValue(value)));
    const record = (ptData.nonpayRecords || []).find(row => row.id === recordId);
    if (!record) return;
    record.incentiveRate = rate;
    await syncNonpayRecordsToClosing();
    openNonpayDetailModal(ptNum, item);
}

async function deleteNonpayRecordFromDetail(recordId, ptNum, item) {
    if (!confirm("이 비급여 치료 내역을 삭제할까요?")) return;
    ptData.nonpayRecords = (ptData.nonpayRecords || []).filter(record => record.id !== recordId);
    await syncNonpayRecordsToClosing();
    const remains = (ptData.nonpayRecords || []).some(record => Number(record.pt) === Number(ptNum) && record.item === item);
    if (remains) openNonpayDetailModal(ptNum, item);
    else closeNonpayDetailModal();
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
            <h3><span class="big-dot"></span>진료실 비급여 건수 / 매출 / 상담 현황</h3>
            <table class="therapy-table">
                <thead><tr><th>구분</th>${therapyCols.map(col => `<th>${col}</th>`).join("")}</tr></thead>
                <tbody>${therapyItems.map(item => {
                    if (!therapyData[`room${i}`][item]) therapyData[`room${i}`][item] = {};
                    return `<tr><td>${item}</td>${therapyCols.map(col => {
                        const value = numericValue(therapyData[`room${i}`][item][col]);
                        const display = col === "매출" ? formatWon(value) : `${value}${col === "신환" || col === "재진" ? "명" : "건"}`;
                        return `<td class="therapy-auto-value">${display}</td>`;
                    }).join("")}</tr>`;
                }).join("")}</tbody>
            </table>`;
    }
}

function renderPatientStatsTable(ptNum) {
    const stats = getPatientStatsFrom(ptData, ptNum);
    return `
        <table class="therapy-table pt-patient-table">
            <thead><tr><th>신환</th><th>개인 재진</th><th>합계</th><th>개인 재진전환율</th></tr></thead>
            <tbody><tr>
                <td class="pt-patient-value">${stats.newCount}명</td>
                <td class="pt-patient-value">${stats.revisitCount}명</td>
                <td class="pt-patient-value">${stats.total}명</td>
                <td class="pt-patient-value">${stats.revisitRate}%</td>
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
                    <td>${compare ? signedNumber(value.revisitRate, "%") : `${value.revisitRate}%`}</td>
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

function getAllGroupedNonpayRecords() {
    const groups = new Map();
    (ptData.nonpayRecords || []).forEach(record => {
        const key = record.item || "미지정";
        if (!groups.has(key)) {
            groups.set(key, { item: key, count: 0, sales: 0, incentive: 0, consultation: 0, reservation: 0 });
        }
        const group = groups.get(key);
        group.count += 1;
        group.sales += numericValue(record.amount);
        group.incentive += getTreatmentIncentive(record.item, record.amount);
        group.consultation += record.consultation ? 1 : 0;
        group.reservation += record.reservation ? 1 : 0;
    });
    return Array.from(groups.values()).sort((a, b) => a.item.localeCompare(b.item, "ko"));
}

function renderAllNonpayRecords() {
    const groups = getAllGroupedNonpayRecords();
    if (!groups.length) {
        return `<div class="nonpay-empty">선택한 날짜에 입력된 비급여 치료 내역이 없습니다.</div>`;
    }

    return `<div class="nonpay-record-list">
        <table class="therapy-table nonpay-record-table">
            <thead><tr><th>치료</th><th>건수</th><th>매출</th><th>인센티브</th><th>상담</th><th>예약</th></tr></thead>
            <tbody>${groups.map(group => `<tr class="nonpay-group-row" onclick="openAllNonpayDetailModal('${escapeHtml(group.item).replaceAll("'", "\\'")}')" title="클릭하여 전체 환자 명단 보기">
                <td>${escapeHtml(group.item)}</td>
                <td>${group.count}건</td>
                <td>${formatWon(group.sales)}</td>
                <td>${formatWon(group.incentive)}</td>
                <td>${group.consultation}건</td>
                <td>${group.reservation}건</td>
            </tr>`).join("")}</tbody>
        </table>
    </div>`;
}

function openAllNonpayDetailModal(item) {
    const records = (ptData.nonpayRecords || [])
        .filter(record => record.item === item)
        .slice()
        .sort((a, b) => String(b.treatmentDate || "").localeCompare(String(a.treatmentDate || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const modal = document.getElementById("nonpayDetailModal");
    const title = document.getElementById("nonpayDetailTitle");
    const summary = document.getElementById("nonpayDetailSummary");
    const body = document.getElementById("nonpayDetailBody");
    if (!modal || !body) return;

    if (title) title.textContent = `${item} 전체 환자 내역`;
    if (summary) summary.textContent = `총 ${records.length}건 · ${formatWon(records.reduce((sum, record) => sum + numericValue(record.amount), 0))}`;
    body.innerHTML = records.length ? `<table class="nonpay-detail-table">
        <thead><tr><th>치료일</th><th>치료사</th><th>차트번호</th><th>환자 이름</th><th>구분</th><th>진료실</th><th>매출</th><th>상담</th><th>예약</th><th></th></tr></thead>
        <tbody>${records.map(record => `<tr>
            <td>${escapeHtml(record.treatmentDate || getDateKey())}</td>
            <td>${escapeHtml(record.therapist || getTherapistName(record.pt))}</td>
            <td>${escapeHtml(record.chartNumber || "-")}</td>
            <td>${escapeHtml(record.patientName || "-")}</td>
            <td>${escapeHtml(record.patientType || "-")}</td>
            <td>${record.room ? `${Number(record.room)}진료실` : "-"}</td>
            <td>${formatWon(record.amount)}</td>
            <td>${record.consultation ? "O" : "-"}</td>
            <td>${record.reservation ? "O" : "-"}</td>
            <td class="nonpay-detail-delete"><button type="button" class="nonpay-delete-btn" onclick="deleteAllNonpayRecordFromDetail('${record.id}', '${escapeHtml(item).replaceAll("'", "\\'")}')">삭제</button></td>
        </tr>`).join("")}</tbody>
    </table>` : `<div class="nonpay-empty">내역이 없습니다.</div>`;
    modal.hidden = false;
}

async function deleteAllNonpayRecordFromDetail(recordId, item) {
    if (!confirm("이 비급여 치료 내역을 삭제할까요?")) return;
    ptData.nonpayRecords = (ptData.nonpayRecords || []).filter(record => record.id !== recordId);
    await syncNonpayRecordsToClosing();
    const remains = (ptData.nonpayRecords || []).some(record => record.item === item);
    if (remains) openAllNonpayDetailModal(item);
    else closeNonpayDetailModal();
}

function renderNonpayAdminPage() {
    const page = document.getElementById("therapy-nonpay-page");
    if (!page) return;

    page.innerHTML = `
        <div class="therapy-card pt-admin-card">
            <h2 class="therapy-title">비급여 통합 현황</h2>

            <h3><span class="big-dot"></span>기간별 전체 환자 현황 · 병원 전체 기준</h3>
            ${renderAdminSummaryTable()}

            <h3 class="pt-section-title"><span class="big-dot"></span>전체 치료사별 환자 현황</h3>
            <div class="pt-therapist-list">${therapistConfig.map(therapist => {
                const totals = getTherapistTotalsFrom(ptData, therapist.pt);
                const stats = getPatientStatsFrom(ptData, therapist.pt);
                return `<details class="pt-therapist-detail">
                    <summary><strong>${therapist.name}</strong><span>신환 ${stats.newCount}명 · 개인 재진 ${stats.revisitCount}명 · 개인 전환율 ${stats.revisitRate}% · ${formatWon(totals.sales)}</span></summary>
                    ${renderPatientStatsTable(therapist.pt)}
                    <table class="therapy-table">
                        <thead><tr><th>치료 내역</th><th>건수</th><th>매출</th><th>인센티브</th></tr></thead>
                        <tbody>${ptItems.map(item => `<tr>
                            <td>${item}</td>
                            <td>${getPtNumberFrom(ptData, therapist.pt, item, "건수")}건</td>
                            <td>${formatWon(getPtNumberFrom(ptData, therapist.pt, item, "매출"))}</td>
                            <td class="${hasTreatmentIncentive(item) ? "" : "pt-no-incentive-cell"}" style="${hasTreatmentIncentive(item) ? "" : "background:#e5e7eb;color:#6b7280;"}">${hasTreatmentIncentive(item) ? formatWon(getPtNumberFrom(ptData, therapist.pt, item, "인센티브")) : ""}</td>
                        </tr>`).join("")}</tbody>
                    </table>
                </details>`;
            }).join("")}</div>

            <h3 class="pt-section-title"><span class="big-dot"></span>비급여 치료 입력 통합 내역</h3>
            ${renderAllNonpayRecords()}
        </div>`;
}

function renderTherapistPtPages() {
    therapistConfig.forEach(therapist => {
        const page = document.getElementById(`therapy-temp${therapist.pt}`);
        if (!page) return;
        page.innerHTML = `<div class="therapy-card">
            <h2 class="therapy-title">${therapist.name}</h2>
            <div class="nonpay-action-row"><button type="button" class="nonpay-open-btn" onclick="openNonpayModal(${therapist.pt})">+ 비급여치료 입력</button></div>
            ${renderNonpayRecords(therapist.pt)}
            <h3><span class="big-dot"></span>환자 현황</h3>${renderPatientStatsTable(therapist.pt)}
        </div>`;
    });
}

function renderPtPages() {
    renderNonpayAdminPage();
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
    const isNonpayPage = tabId === "therapy-nonpay-page";
    const isTherapistPage = /^therapy-temp\d+$/.test(tabId);

    // 입력 날짜 선택은 마감일지에서만 표시합니다.
    if (closingDateToolbar) closingDateToolbar.hidden = !isClosingPage;

    // 기간 조회는 마감일지에서는 숨기고,
    // 비급여 통합 탭과 각 치료사 탭에서만 표시합니다.
    if (ptRangeToolbar) ptRangeToolbar.hidden = !(isNonpayPage || isTherapistPage);
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
window.openNonpayModal = openNonpayModal;
window.closeNonpayModal = closeNonpayModal;
window.saveNonpayRecord = saveNonpayRecord;
window.deleteNonpayRecord = deleteNonpayRecord;
window.openNonpayDetailModal = openNonpayDetailModal;
window.closeNonpayDetailModal = closeNonpayDetailModal;
window.updateNonpayIncentiveRate = updateNonpayIncentiveRate;
window.deleteNonpayRecordFromDetail = deleteNonpayRecordFromDetail;

updatePtTabLabels();
syncNonpayItemOptions();
initializeRangeInputs(true);
reloadTherapyPage();
