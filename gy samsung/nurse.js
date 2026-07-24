import { db, doc, getDoc, setDoc } from "./firebase.js";

/* =========================
   사이드바 스크롤
========================= */

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
   탭 버튼 활성화
========================= */

const nurseCard = document.querySelector(".nurse-card");
const nurseTabs = document.querySelectorAll(".nurse-tab");

function setupNurseTabs() {
    const originalContent = document.createElement("div");
    originalContent.className = "nurse-tab-page active";
    originalContent.dataset.page = "closing";

    while (nurseCard.firstChild) {
        originalContent.appendChild(nurseCard.firstChild);
    }

    nurseCard.appendChild(originalContent);

    nurseCard.appendChild(makeFluidPage());
    nurseCard.appendChild(makeSchedulePage());

    nurseCard.appendChild(makeTempPage(
        "temp2",
        "임시2",
        "임시 페이지입니다."
    ));

    nurseCard.appendChild(makeTempPage(
        "temp3",
        "임시3",
        "임시 페이지입니다."
    ));

    nurseTabs.forEach((tab, index) => {
        const pageKey = ["closing", "fluid", "schedule", "temp2", "temp3"][index];

        tab.dataset.page = pageKey;

        tab.addEventListener("click", () => {
            activateNurseTab(pageKey);
        });
    });
}

function makeTempPage(pageKey, title, text) {
    const page = document.createElement("div");
    page.className = "nurse-tab-page";
    page.dataset.page = pageKey;

    page.innerHTML = `
        <div class="nurse-temp-page">
            <h1>${title}</h1>
            <p>${text}</p>
        </div>
    `;

    return page;
}

let fluidWorkers = JSON.parse(localStorage.getItem("fluidWorkers")) || ["민숙희", "박윤아", "황수현", "김다운", "김유진", "이은정", "알바(월)", "N2"];
let fluidReady = false;

// fluidWorkers 초기화 이후 탭을 구성해야 수액 페이지 생성 중 오류가 나지 않습니다.
if (nurseCard && nurseTabs.length > 0) {
    setupNurseTabs();
}

const fluidPayOptions = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2.5, 2, 1.5, 1];

function makeFluidPage() {
    const page = document.createElement("div");
    page.className = "nurse-tab-page";
    page.dataset.page = "fluid";

    page.innerHTML = `
        <div class="fluid-page">
            <div class="fluid-control-card">
                <label>날짜 <input type="date" id="fluidDate"></label>
                <button type="button" id="fluidSaveBtn" class="fluid-primary-btn">저장</button>
                <button type="button" id="fluidDayBtn">하루치</button>
                <button type="button" id="fluidMonthBtn">한달치</button>
                <button type="button" id="fluidSummaryBtn">합계</button>
            </div>

            <section id="fluidDayView" class="fluid-view-card">
                <div class="fluid-section-title">
                    <div>
                        <h2 id="fluidDayTitle">수액 하루치</h2>
                        <p>환자 입력 후 수액 종류를 선택하세요. F는 프리, 숫자+B는 비급여 금액(만원)입니다.</p>
                    </div>
                </div>
                <div class="fluid-table-wrap">
                    <table class="fluid-day-table">
                        <thead><tr>${fluidWorkers.map((name, index) => `<th><input class="fluid-worker-name" data-worker-index="${index}" value="${escapeFluidText(name)}" aria-label="직원 이름"></th>`).join("")}</tr></thead>
                        <tbody><tr id="fluidDayRow"></tr></tbody>
                    </table>
                </div>
            </section>

            <section id="fluidMonthView" class="fluid-view-card" style="display:none;">
                <div class="fluid-section-title"><div><h2 id="fluidMonthTitle">수액 한달치</h2><p>날짜별 환자와 수액 종류를 확인합니다.</p></div></div>
                <div id="fluidMonthWrap" class="fluid-month-wrap"></div>
            </section>

            <section id="fluidSummaryView" class="fluid-view-card" style="display:none;">
                <div class="fluid-section-title">
                    <div><h2 id="fluidSummaryTitle">수액 합계</h2><p>비급여는 금액의 5%, 프리는 건당 1,200원으로 계산합니다.</p></div>
                </div>
                <div id="fluidSummaryWrap" class="fluid-summary-wrap"></div>
            </section>
        </div>
    `;
    return page;
}

function getFluidStorageKey(date) {
    return `fluidLog_${date}`;
}

function loadFluidDayData(date) {
    const raw = JSON.parse(localStorage.getItem(getFluidStorageKey(date))) || {};
    const normalized = {};
    fluidWorkers.forEach(name => {
        const value = raw[name];
        if (Array.isArray(value)) {
            normalized[name] = value.map(item => ({
                chartNo: String(item.chartNo || ""),
                patientName: String(item.patientName || item.patient || ""),
                room: String(item.room || "room1"),
                type: String(item.type || "F")
            }));
        } else if (typeof value === "string") {
            normalized[name] = value.split("\n").map(v => v.trim()).filter(Boolean).map(patientName => ({ chartNo: "", patientName, room: "room1", type: "F" }));
        } else {
            normalized[name] = [];
        }
    });
    return normalized;
}

function saveFluidDayData(date, data) {
    localStorage.setItem(getFluidStorageKey(date), JSON.stringify(data));
}

function fluidTypeOptions(selected = "F") {
    return [`<option value="F" ${selected === "F" ? "selected" : ""}>F (프리)</option>`]
        .concat(fluidPayOptions.map(amount => {
            const code = `${amount}B`;
            return `<option value="${code}" ${selected === code ? "selected" : ""}>${code}</option>`;
        })).join("");
}

function escapeFluidText(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', '&quot;');
}

function initFluidPage() {
    const fluidDate = document.getElementById("fluidDate");
    if (!fluidDate || fluidReady) return;
    fluidReady = true;
    fluidDate.value = new Date().toISOString().slice(0, 10);
    document.getElementById("fluidSaveBtn").addEventListener("click", () => saveFluidDay(true));
    document.getElementById("fluidDayBtn").addEventListener("click", showFluidDay);
    document.getElementById("fluidMonthBtn").addEventListener("click", showFluidMonth);
    document.getElementById("fluidSummaryBtn").addEventListener("click", showFluidSummary);
    fluidDate.addEventListener("change", renderFluidDay);
    renderFluidDay();
}

function fluidRoomOptions(selected = "room1") {
    return nurseRooms.map(room => `<option value="${room.key}" ${selected === room.key ? "selected" : ""}>${room.name}</option>`).join("");
}

function makeFluidEntryRow(worker, item = {}) {
    const chartNo = item.chartNo || "";
    const patientName = item.patientName || item.patient || "";
    const visitType = chartNo ? getFluidVisitType(document.getElementById("fluidDate")?.value || "", chartNo) : "";
    return `
        <div class="fluid-entry-row" data-fluid-entry data-worker="${escapeFluidText(worker)}">
            <div class="fluid-entry-top">
                <select class="fluid-room-select" aria-label="진료실">${fluidRoomOptions(item.room || "room1")}</select>
                <span class="fluid-visit-badge ${visitType === "재진" ? "revisit" : "new"}">${visitType || "구분"}</span>
            </div>
            <input type="text" class="fluid-chart-input" inputmode="numeric" value="${escapeFluidText(chartNo)}" placeholder="차트번호">
            <input type="text" class="fluid-name-input" value="${escapeFluidText(patientName)}" placeholder="환자이름">
            <select class="fluid-type-select">${fluidTypeOptions(item.type || "F")}</select>
            <button type="button" class="fluid-remove-btn" title="삭제">×</button>
        </div>`;
}

function bindFluidWorkerNameEvents() {
    document.querySelectorAll(".fluid-worker-name").forEach(input => {
        input.addEventListener("change", () => renameFluidWorker(Number(input.dataset.workerIndex), input.value));
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") input.blur();
        });
    });
}

function renameFluidWorker(index, value) {
    const oldName = fluidWorkers[index];
    const newName = value.trim();
    if (!newName) {
        alert("이름은 비워둘 수 없음");
        renderFluidDay();
        return;
    }
    if (newName !== oldName && fluidWorkers.includes(newName)) {
        alert("이미 있는 이름임");
        renderFluidDay();
        return;
    }
    if (newName === oldName) return;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("fluidLog_")) continue;
        try {
            const data = JSON.parse(localStorage.getItem(key)) || {};
            data[newName] = Array.isArray(data[oldName]) ? data[oldName] : [];
            delete data[oldName];
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn("수액 이름 변경 중 데이터 변환 실패", key, error);
        }
    }

    fluidWorkers[index] = newName;
    localStorage.setItem("fluidWorkers", JSON.stringify(fluidWorkers));
    renderFluidDay();
}

function renderFluidDay() {
    const date = document.getElementById("fluidDate").value;
    const saved = loadFluidDayData(date);
    const row = document.getElementById("fluidDayRow");
    document.getElementById("fluidDayTitle").innerText = `${date} 수액 하루치`;

    row.innerHTML = fluidWorkers.map(name => {
        const entries = saved[name].length ? saved[name] : [{ chartNo: "", patientName: "", room: "room1", type: "F" }];
        return `<td><div class="fluid-worker-list" data-fluid-worker-list="${escapeFluidText(name)}">
            ${entries.map(item => makeFluidEntryRow(name, item)).join("")}
            <button type="button" class="fluid-add-btn" data-add-worker="${escapeFluidText(name)}">+ 환자 추가</button>
        </div></td>`;
    }).join("");

    bindFluidWorkerNameEvents();
    row.querySelectorAll("[data-add-worker]").forEach(btn => btn.addEventListener("click", () => {
        btn.insertAdjacentHTML("beforebegin", makeFluidEntryRow(btn.dataset.addWorker, { room: "room1", type: "F" }));
        bindFluidEntryEvents();
    }));
    bindFluidEntryEvents();
}

function bindFluidEntryEvents() {
    document.querySelectorAll("#fluidDayRow .fluid-remove-btn").forEach(btn => {
        if (btn.dataset.ready) return;
        btn.dataset.ready = "1";
        btn.addEventListener("click", () => {
            btn.closest(".fluid-entry-row")?.remove();
            saveFluidDay(false);
        });
    });
    document.querySelectorAll("#fluidDayRow input, #fluidDayRow select").forEach(el => {
        if (el.dataset.ready) return;
        el.dataset.ready = "1";
        el.addEventListener("input", () => {
            if (el.classList.contains("fluid-chart-input")) updateFluidVisitBadges(document.getElementById("fluidDate").value);
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => saveFluidDay(false), 400);
        });
        el.addEventListener("change", () => saveFluidDay(false));
    });
}

async function saveFluidDay(showAlert = true) {
    const date = document.getElementById("fluidDate").value;
    const data = Object.fromEntries(fluidWorkers.map(name => [name, []]));
    document.querySelectorAll("#fluidDayRow [data-fluid-entry]").forEach(row => {
        const chartNo = row.querySelector(".fluid-chart-input")?.value.trim() || "";
        const patientName = row.querySelector(".fluid-name-input")?.value.trim() || "";
        const room = row.querySelector(".fluid-room-select")?.value || "room1";
        const type = row.querySelector(".fluid-type-select")?.value || "F";
        if (chartNo || patientName) data[row.dataset.worker].push({ chartNo, patientName, room, type });
    });
    saveFluidDayData(date, data);
    updateFluidVisitBadges(date);
    try {
        await syncFluidToNurseClosing(date, data);
        if (showAlert) alert("수액 기록 저장 및 마감일지 연동 완료");
    } catch (error) {
        console.error("수액 마감일지 연동 실패", error);
        if (showAlert) alert("수액 기록은 저장됐지만 마감일지 연동에 실패함");
    }
}

function normalizeChartNo(value) {
    return String(value || "").replace(/\s/g, "").toUpperCase();
}

function getFluidVisitType(date, chartNo) {
    const target = normalizeChartNo(chartNo);
    if (!target || !date) return "";
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("fluidLog_")) continue;
        const savedDate = key.replace("fluidLog_", "");
        if (savedDate >= date) continue;
        try {
            const data = JSON.parse(localStorage.getItem(key)) || {};
            const found = Object.values(data).some(entries => Array.isArray(entries) && entries.some(item => normalizeChartNo(item.chartNo) === target));
            if (found) return "재진";
        } catch (_) {}
    }
    return "신환";
}

function updateFluidVisitBadges(date) {
    document.querySelectorAll("#fluidDayRow [data-fluid-entry]").forEach(row => {
        const chartNo = row.querySelector(".fluid-chart-input")?.value || "";
        const badge = row.querySelector(".fluid-visit-badge");
        const visitType = getFluidVisitType(date, chartNo);
        if (!badge) return;
        badge.textContent = visitType || "구분";
        badge.classList.toggle("revisit", visitType === "재진");
        badge.classList.toggle("new", visitType === "신환");
    });
}

function toClosingDateKey(date) {
    const [year, month, day] = String(date || "").split("-").map(Number);
    if (!year || !month || !day) return String(date || "");
    return `${year}-${month}-${day}`;
}

async function syncFluidToNurseClosing(date, data) {
    const counts = Object.fromEntries(nurseRooms.map(room => [room.key, { fluidNew: 0, fluidRevisit: 0 }]));
    const seenToday = new Set();

    fluidWorkers.forEach(worker => {
        (data[worker] || []).forEach(item => {
            const chartNo = normalizeChartNo(item.chartNo);
            if (!chartNo || !counts[item.room]) return;
            const previous = getFluidVisitType(date, chartNo) === "재진" || seenToday.has(chartNo);
            counts[item.room][previous ? "fluidRevisit" : "fluidNew"] += 1;
            seenToday.add(chartNo);
        });
    });

    const closingDateKey = toClosingDateKey(date);
    const ref = doc(db, "closings", closingDateKey);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const linkedNurseData = { ...(existing.nurseData || {}) };

    nurseRooms.forEach(room => {
        linkedNurseData[room.key] = {
            ...(linkedNurseData[room.key] || {}),
            fluidNew: counts[room.key].fluidNew,
            fluidRevisit: counts[room.key].fluidRevisit
        };
    });

    await setDoc(ref, { nurseData: linkedNurseData }, { merge: true });

    if (typeof getDateKey === "function" && getDateKey() === closingDateKey) {
        nurseData = linkedNurseData;
        renderNurseTable();
    }
}

function setFluidView(view) {
    document.getElementById("fluidDayView").style.display = view === "day" ? "block" : "none";
    document.getElementById("fluidMonthView").style.display = view === "month" ? "block" : "none";
    document.getElementById("fluidSummaryView").style.display = view === "summary" ? "block" : "none";
}
function showFluidDay() { setFluidView("day"); renderFluidDay(); }
function showFluidMonth() { saveFluidDay(false); setFluidView("month"); renderFluidMonth(); }
function showFluidSummary() { saveFluidDay(false); setFluidView("summary"); renderFluidSummary(); }

function getFluidMonthInfo() {
    const [year, month] = document.getElementById("fluidDate").value.split("-").map(Number);
    return { year, month, lastDate: new Date(year, month, 0).getDate() };
}

function renderFluidEntries(entries = [], date = "") {
    return entries.map(item => {
        const visitType = item.chartNo ? getFluidVisitType(date, item.chartNo) : "";
        const roomName = nurseRooms.find(room => room.key === item.room)?.name || "1진료";
        return `<div class="fluid-month-entry"><span>${escapeFluidText(item.chartNo)} ${escapeFluidText(item.patientName)}</span><small>${roomName} · ${visitType || "미구분"}</small><b>${escapeFluidText(item.type)}</b></div>`;
    }).join("");
}

function renderFluidMonth() {
    const { year, month, lastDate } = getFluidMonthInfo();
    const wrap = document.getElementById("fluidMonthWrap");
    document.getElementById("fluidMonthTitle").innerText = `${year}년 ${month}월 수액 한달치`;
    let html = `<table class="fluid-month-table"><colgroup><col style="width:58px">${fluidWorkers.map(() => `<col>`).join("")}</colgroup><thead><tr><th>날짜</th>${fluidWorkers.map(name => `<th>${escapeFluidText(name)}</th>`).join("")}</tr></thead><tbody>`;
    for (let day = 1; day <= lastDate; day++) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const saved = loadFluidDayData(date);
        const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(year, month - 1, day).getDay()];
        html += `<tr><th class="date-head">${month}/${day}<br>(${weekday})</th>${fluidWorkers.map(name => `<td>${renderFluidEntries(saved[name], date)}</td>`).join("")}</tr>`;
    }
    wrap.innerHTML = html + `</tbody></table>`;
}

function renderFluidSummary() {
    const { year, month, lastDate } = getFluidMonthInfo();
    const wrap = document.getElementById("fluidSummaryWrap");
    document.getElementById("fluidSummaryTitle").innerText = `${year}년 ${month}월 수액 합계`;

    const quantity = Object.fromEntries(fluidPayOptions.map(v => [String(v), 0]));
    let freeQty = 0;
    for (let day = 1; day <= lastDate; day++) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const saved = loadFluidDayData(date);
        fluidWorkers.forEach(name => saved[name].forEach(item => {
            if (item.type === "F") freeQty++;
            else if (item.type.endsWith("B")) {
                const amount = item.type.slice(0, -1);
                if (Object.hasOwn(quantity, amount)) quantity[amount]++;
            }
        }));
    }

    let bCount = 0;
    let bAmountManwon = 0;
    let bIncentiveWon = 0;
    const rows = fluidPayOptions.map(amount => {
        const qty = quantity[String(amount)] || 0;
        const totalManwon = amount * qty;
        const incentive = Math.round(totalManwon * 10000 * 0.05);
        bCount += qty;
        bAmountManwon += totalManwon;
        bIncentiveWon += incentive;
        return `<tr><td>${amount}</td><td>${qty}</td><td>${totalManwon || 0}</td><td>${incentive.toLocaleString("ko-KR")}원</td></tr>`;
    }).join("");
    const freeIncentive = freeQty * 1200;
    const totalIncentive = bIncentiveWon + freeIncentive;

    wrap.innerHTML = `
        <table class="fluid-summary-table fluid-price-summary">
            <thead><tr><th>구분(만원)</th><th>수량</th><th>합계(만원)</th><th>인센티브</th></tr></thead>
            <tbody>
                ${rows}
                <tr class="fluid-free-row"><td>F (프리)</td><td>${freeQty}</td><td>-</td><td>${freeIncentive.toLocaleString("ko-KR")}원</td></tr>
                <tr class="total-row"><td>계</td><td>${bCount + freeQty}</td><td>${bAmountManwon.toLocaleString("ko-KR")}</td><td>${totalIncentive.toLocaleString("ko-KR")}원</td></tr>
            </tbody>
        </table>
        <div class="fluid-summary-cards">
            <div><span>비급여 수액</span><b>${bCount}건 / ${bAmountManwon.toLocaleString("ko-KR")}만원</b></div>
            <div><span>프리 수액</span><b>${freeQty}건</b></div>
            <div><span>총 인센티브</span><b>${totalIncentive.toLocaleString("ko-KR")}원</b></div>
        </div>`;
}

function makeSchedulePage() {
    const page = document.createElement("div");
    page.className = "nurse-tab-page";
    page.dataset.page = "schedule";

    page.innerHTML = `
        <div class="work-schedule-page">
            <div class="work-control-card">
                <label>
                    날짜
                    <input type="date" id="workDate">
                </label>

                <label>
                    기준 출근
                    <input type="time" id="baseStart" value="09:00" step="600">
                </label>

                <label>
                    기준 퇴근
                    <input type="time" id="baseEnd" value="19:30" step="600">
                </label>

                <button type="button" id="saveWorkBtn" class="work-primary-btn">저장</button>
                <button type="button" id="showDayBtn">1일 보기</button>
                <button type="button" id="showMonthBtn">한달 보기</button>
            </div>

            <section id="dailyView" class="work-view-card">
                <div class="work-section-title">
                    <h2 id="dailyTitle">1일 보기</h2>
                    <p>출근/퇴근을 비우면 기준시간으로 계산됩니다.</p>
                </div>

                <table class="work-daily-table">
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
                    <tbody id="dailyBody"></tbody>
                </table>
            </section>

            <section id="monthView" class="work-view-card" style="display:none;">
                <div class="work-section-title work-month-head">
                    <div>
                        <h2 id="monthTitle">한달 보기</h2>
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
                            <tbody id="monthTotalBody"></tbody>
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

                <div id="calendarGrid" class="work-calendar-grid"></div>
            </section>
        </div>
    `;

    return page;
}
function activateNurseTab(pageKey) {
    document.querySelectorAll(".nurse-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.page === pageKey);
    });

    document.querySelectorAll(".nurse-tab-page").forEach(page => {
        page.classList.toggle("active", page.dataset.page === pageKey);
    });

    if (pageKey === "fluid") {
        initFluidPage();
    }

    if (pageKey === "schedule") {
        initWorkSchedule();
    }
}

/* =========================
   날짜
========================= */

const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const daySelect = document.getElementById("daySelect");

const prevDateBtn = document.getElementById("prevDateBtn");
const nextDateBtn = document.getElementById("nextDateBtn");

const today = new Date();

let currentYear = today.getFullYear();
let currentMonth = today.getMonth() + 1;
let currentDay = today.getDate();

for (let y = 2024; y <= 2035; y++) {
    yearSelect.innerHTML += `
        <option value="${y}">${y}년</option>
    `;
}

for (let m = 1; m <= 12; m++) {
    monthSelect.innerHTML += `
        <option value="${m}">${m}월</option>
    `;
}

function updateDays() {
    const lastDay = new Date(
        Number(yearSelect.value),
        Number(monthSelect.value),
        0
    ).getDate();

    daySelect.innerHTML = "";

    for (let d = 1; d <= lastDay; d++) {
        daySelect.innerHTML += `
            <option value="${d}">${d}일</option>
        `;
    }

    if (currentDay > lastDay) {
        currentDay = lastDay;
    }

    daySelect.value = currentDay;
}

yearSelect.value = currentYear;
monthSelect.value = currentMonth;

updateDays();

daySelect.value = currentDay;

function getDateKey() {
    return `
        ${yearSelect.value}-
        ${monthSelect.value}-
        ${daySelect.value}
    `.replace(/\s/g, "");
}

/* =========================
   데이터
========================= */

const nurseRooms = [
    { key: "room1", name: "1진료" },
    { key: "room2", name: "2진료" },
    { key: "room3", name: "3진료" },
    { key: "room4", name: "4진료" },
    { key: "room5", name: "5진료" }
];

let nurseData = {};
let saveTimer = null;

/* =========================
   불러오기
========================= */
let employees = JSON.parse(localStorage.getItem("scheduleEmployees")) || [
    "민숙희", "박윤아", "황수현", "김다운", "김유진", "이은정"
];

function initWorkSchedule() {
    const workDate = document.getElementById("workDate");
    const baseStart = document.getElementById("baseStart");
    const baseEnd = document.getElementById("baseEnd");

    if (!workDate || workDate.dataset.ready === "true") return;

    workDate.dataset.ready = "true";
    workDate.value = new Date().toISOString().slice(0, 10);

    document.getElementById("saveWorkBtn").addEventListener("click", () => saveWorkDay(true));
    document.getElementById("showDayBtn").addEventListener("click", showWorkDay);
    document.getElementById("showMonthBtn").addEventListener("click", showWorkMonth);

    baseStart.addEventListener("change", updateWorkCalc);
    baseEnd.addEventListener("change", updateWorkCalc);
    workDate.addEventListener("change", renderWorkDaily);

    renderWorkDaily();
}

function saveEmployees() {
    localStorage.setItem("scheduleEmployees", JSON.stringify(employees));
}

function timeToMinutes(time) {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function calcWorkTime(start, end, lunch, off) {
    if (off) return { ot: 0, early: 0, total: 0 };

    const baseStart = document.getElementById("baseStart").value;
    const baseEnd = document.getElementById("baseEnd").value;

    const actualStart = start || baseStart;
    const actualEnd = end || baseEnd;

    const s = timeToMinutes(actualStart);
    const e = timeToMinutes(actualEnd);
    const bs = timeToMinutes(baseStart);
    const be = timeToMinutes(baseEnd);

    const ot = Math.max(0, bs - s) + Math.max(0, e - be) + Number(lunch || 0);
    const early = Math.max(0, be - e);
    const total = ot - early;

    return { ot, early, total };
}

function getWorkStorageKey(date) {
    return `workSchedule_${date}`;
}

function loadWorkDayData(date) {
    return JSON.parse(localStorage.getItem(getWorkStorageKey(date))) || {};
}

function saveWorkDayData(date, data) {
    localStorage.setItem(getWorkStorageKey(date), JSON.stringify(data));
}


function makeHourOptions(selectedTime = "") {
    const selectedHour = selectedTime ? selectedTime.split(":")[0] : "";
    let html = `<option value="">시</option>`;

    for (let h = 6; h <= 22; h++) {
        const hour = String(h).padStart(2, "0");
        html += `<option value="${hour}" ${selectedHour === hour ? "selected" : ""}>${hour}</option>`;
    }

    return html;
}

function makeMinuteOptions(selectedTime = "") {
    const selectedMinute = selectedTime ? selectedTime.split(":")[1] : "";
    let html = `<option value="">분</option>`;

    for (let m = 0; m < 60; m += 10) {
        const minute = String(m).padStart(2, "0");
        html += `<option value="${minute}" ${selectedMinute === minute ? "selected" : ""}>${minute}</option>`;
    }

    return html;
}

function getSelectedTime(name, type) {
    const hour = document.querySelector(`[data-name="${name}"][data-type="${type}Hour"]`)?.value;
    const minute = document.querySelector(`[data-name="${name}"][data-type="${type}Minute"]`)?.value;

    if (!hour || !minute) return "";

    return `${hour}:${minute}`;
}
function renderWorkDaily() {
    const workDate = document.getElementById("workDate");
    const dailyTitle = document.getElementById("dailyTitle");
    const dailyBody = document.getElementById("dailyBody");

    const date = workDate.value;
    const saved = loadWorkDayData(date);

    dailyTitle.innerText = `${date} 근무 입력`;
    dailyBody.innerHTML = "";

    employees.forEach(name => {
        const row = saved[name] || {};

        dailyBody.innerHTML += `
            <tr>
                <td>
                    <input class="work-name-input" value="${name}" data-old-name="${name}">
                </td>

                <td>
                    <div class="work-time-group">
                        <select data-name="${name}" data-type="startHour">
                            ${makeHourOptions(row.start || "")}
                        </select>
                        <select data-name="${name}" data-type="startMinute">
                            ${makeMinuteOptions(row.start || "")}
                        </select>
                    </div>
                </td>

                <td>
                    <select data-name="${name}" data-type="lunch">
                        <option value="0" ${Number(row.lunch || 0) === 0 ? "selected" : ""}>0</option>
                        <option value="10" ${Number(row.lunch || 0) === 10 ? "selected" : ""}>10</option>
                        <option value="20" ${Number(row.lunch || 0) === 20 ? "selected" : ""}>20</option>
                        <option value="30" ${Number(row.lunch || 0) === 30 ? "selected" : ""}>30</option>
                        <option value="40" ${Number(row.lunch || 0) === 40 ? "selected" : ""}>40</option>
                        <option value="50" ${Number(row.lunch || 0) === 50 ? "selected" : ""}>50</option>
                        <option value="60" ${Number(row.lunch || 0) === 60 ? "selected" : ""}>60</option>
                    </select>
                </td>

                <td>
                    <div class="work-time-group">
                        <select data-name="${name}" data-type="endHour">
                            ${makeHourOptions(row.end || "")}
                        </select>
                        <select data-name="${name}" data-type="endMinute">
                            ${makeMinuteOptions(row.end || "")}
                        </select>
                    </div>
                </td>

                <td>
                    <input type="checkbox" data-name="${name}" data-type="off" ${row.off ? "checked" : ""}>
                </td>

                <td id="ot-${name}" class="work-ot-cell">${row.ot || 0}</td>
                <td id="early-${name}" class="work-early-cell">${row.early || 0}</td>
            </tr>
        `;
    });

    document.querySelectorAll(".work-name-input").forEach(input => {
        input.addEventListener("change", changeWorkEmployeeName);
    });

    document.querySelectorAll("[data-name]").forEach(input => {
        input.addEventListener("change", updateWorkCalc);
    });

    updateWorkCalc();
}

function changeWorkEmployeeName(e) {
    const input = e.target;
    const oldName = input.dataset.oldName;
    const newName = input.value.trim();

    if (!newName) {
        alert("이름은 비워둘 수 없음");
        input.value = oldName;
        return;
    }

    employees = employees.map(name => name === oldName ? newName : name);
    saveEmployees();
    renderWorkDaily();
}

function updateWorkCalc() {
    employees.forEach(name => {
        const startHour = document.querySelector(`[data-name="${name}"][data-type="startHour"]`);
        const startMinute = document.querySelector(`[data-name="${name}"][data-type="startMinute"]`);
        const endHour = document.querySelector(`[data-name="${name}"][data-type="endHour"]`);
        const endMinute = document.querySelector(`[data-name="${name}"][data-type="endMinute"]`);
        const lunchInput = document.querySelector(`[data-name="${name}"][data-type="lunch"]`);
        const offInput = document.querySelector(`[data-name="${name}"][data-type="off"]`);

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

        const start = getSelectedTime(name, "start");
        const end = getSelectedTime(name, "end");

        const result = calcWorkTime(
            start,
            end,
            lunchInput.value,
            offInput.checked
        );

        document.getElementById(`ot-${name}`).innerText = result.ot;
        document.getElementById(`early-${name}`).innerText = result.early;
    });
}

function saveWorkDay(showAlert = true) {
    const date = document.getElementById("workDate").value;
    const data = {};

    employees.forEach(name => {
        const lunchInput = document.querySelector(`[data-name="${name}"][data-type="lunch"]`);
        const offInput = document.querySelector(`[data-name="${name}"][data-type="off"]`);

        if (!lunchInput || !offInput) return;

        const start = getSelectedTime(name, "start");
        const end = getSelectedTime(name, "end");

        const result = calcWorkTime(
            start,
            end,
            lunchInput.value,
            offInput.checked
        );

        data[name] = {
            start,
            lunch: lunchInput.value,
            end,
            off: offInput.checked,
            ot: result.ot,
            early: result.early,
            total: result.total
        };
    });

    saveWorkDayData(date, data);

    if (showAlert) alert("저장됨");
}
function showWorkDay() {
    document.getElementById("dailyView").style.display = "block";
    document.getElementById("monthView").style.display = "none";
    renderWorkDaily();
}

function showWorkMonth() {
    saveWorkDay(false);

    document.getElementById("dailyView").style.display = "none";
    document.getElementById("monthView").style.display = "block";

    renderWorkMonthCalendar();
}

function renderWorkMonthCalendar() {
    const selectedDate = document.getElementById("workDate").value;
    const [year, month] = selectedDate.split("-").map(Number);

    const firstDay = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0).getDate();
    const startWeek = firstDay.getDay();

    const calendarGrid = document.getElementById("calendarGrid");
    const monthTotalBody = document.getElementById("monthTotalBody");

    document.getElementById("monthTitle").innerText = `${year}년 ${month}월 한달 보기`;

    calendarGrid.innerHTML = "";
    monthTotalBody.innerHTML = "";

    const totals = {};

    employees.forEach(name => {
        totals[name] = { ot: 0, early: 0, total: 0 };
    });

    for (let i = 0; i < startWeek; i++) {
        calendarGrid.innerHTML += `<div class="work-calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const data = loadWorkDayData(date);

        let html = "";
        let dayOtTotal = 0;
let dayEarlyTotal = 0;
        

        employees.forEach(name => {
            const row = data[name];

            if (!row) {
                html += `
                    <div class="work-employee-line normal">
                        <span>${name}</span>
                        <span>0 / 0</span>
                    </div>
                `;
                return;
            }

            totals[name].ot += Number(row.ot || 0);
            totals[name].early += Number(row.early || 0);
            totals[name].total += Number(row.total || ((row.ot || 0) - (row.early || 0)));
            dayOtTotal += Number(row.ot || 0);
dayEarlyTotal += Number(row.early || 0);
            html += row.off
                ? `
                    <div class="work-employee-line off">
                        <span>${name}</span>
                        <span>휴무</span>
                    </div>
                `
                : `
                    <div class="work-employee-line">
                        <span>${name}</span>
                        <span>${row.ot || 0} / ${row.early || 0}</span>
                    </div>
                `;
        });

        calendarGrid.innerHTML += `
            <div class="work-calendar-cell">
                <div class="work-day-head">
    <span class="work-day-number">${day}</span>
    <span class="work-day-total">OT / 조퇴</span>
</div>
                ${html}
            </div>
        `;
    }

    employees.forEach(name => {
    monthTotalBody.innerHTML += `
        <tr>
            <td>${name}</td>
            <td>${totals[name].ot}</td>
            <td>${totals[name].early}</td>
            <td>${totals[name].total}</td>
        </tr>
    `;
});
}
async function loadNurseData() {
    const snap = await getDoc(
        doc(db, "closings", getDateKey())
    );

    const data = snap.exists()
        ? snap.data()
        : {};

    nurseData = data.nurseData || {};

    renderNurseTable();
}

/* =========================
   렌더
========================= */

function renderNurseTable() {
    const table = document.getElementById("nurseClosingTable");

    if (!table) return;

    let totalFluidNew = 0;
    let totalFluidRevisit = 0;
    let totalUltrasound = 0;
    let totalSales = 0;

    table.innerHTML = `
        <thead>
            <tr>
                <th>진료실</th>
                <th>수액 신환</th>
                <th>수액 재진</th>
                <th>초음파</th>
                <th>매출</th>
            </tr>
        </thead>

        <tbody>
            ${nurseRooms.map(room => {
                const row = nurseData[room.key] || {};

                const fluidNew = Number(row.fluidNew || 0);
                const fluidRevisit = Number(row.fluidRevisit || 0);
                const ultrasound = Number(row.ultrasound || 0);
                const sales = Number(row.sales || 0);

                totalFluidNew += fluidNew;
                totalFluidRevisit += fluidRevisit;
                totalUltrasound += ultrasound;
                totalSales += sales;

                return `
                    <tr>
                        <td>${room.name}</td>

                        <td>
                            <input
                                type="number"
                                value="${row.fluidNew || ""}"
                                data-room="${room.key}"
                                data-field="fluidNew"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                value="${row.fluidRevisit || ""}"
                                data-room="${room.key}"
                                data-field="fluidRevisit"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                value="${row.ultrasound || ""}"
                                data-room="${room.key}"
                                data-field="ultrasound"
                            >
                        </td>

                        <td>
                            <input
                                type="number"
                                value="${row.sales || ""}"
                                data-room="${room.key}"
                                data-field="sales"
                            >
                        </td>
                    </tr>
                `;
            }).join("")}

            <tr class="total-row">
                <td>합계</td>
                <td>${totalFluidNew}명</td>
                <td>${totalFluidRevisit}명</td>
                <td>${totalUltrasound}건</td>
                <td>${totalSales.toLocaleString("ko-KR")}원</td>
            </tr>
        </tbody>
    `;

    table.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", () => {
            clearTimeout(saveTimer);

            saveTimer = setTimeout(() => {
                saveNurseData();
            }, 500);
        });
    });
}

/* =========================
   저장
========================= */

async function saveNurseData() {
    const inputs = document.querySelectorAll("#nurseClosingTable input");

    inputs.forEach(input => {
        const room = input.dataset.room;
        const field = input.dataset.field;

        if (!nurseData[room]) {
            nurseData[room] = {};
        }

        nurseData[room][field] = Number(input.value || 0);
    });

    await setDoc(
        doc(db, "closings", getDateKey()),
        {
            nurseData
        },
        {
            merge: true
        }
    );
}

/* =========================
   날짜 이동
========================= */

function changeDate(diff) {
    const date = new Date(
        Number(yearSelect.value),
        Number(monthSelect.value) - 1,
        Number(daySelect.value)
    );

    date.setDate(date.getDate() + diff);

    currentYear = date.getFullYear();
    currentMonth = date.getMonth() + 1;
    currentDay = date.getDate();

    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;

    updateDays();

    daySelect.value = currentDay;

    loadNurseData();
}

prevDateBtn.addEventListener("click", () => {
    changeDate(-1);
});

nextDateBtn.addEventListener("click", () => {
    changeDate(1);
});

yearSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    currentMonth = Number(monthSelect.value);
    currentDay = Number(daySelect.value);

    updateDays();

    loadNurseData();
});

monthSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    currentMonth = Number(monthSelect.value);
    currentDay = Number(daySelect.value);

    updateDays();

    loadNurseData();
});

daySelect.addEventListener("change", () => {
    currentDay = Number(daySelect.value);

    loadNurseData();
});

/* =========================
   시작
========================= */

loadNurseData();