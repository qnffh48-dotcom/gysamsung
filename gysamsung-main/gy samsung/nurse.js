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

if (nurseCard && nurseTabs.length > 0) {
    setupNurseTabs();
}

function setupNurseTabs() {
    const originalContent = document.createElement("div");
    originalContent.className = "nurse-tab-page active";
    originalContent.dataset.page = "closing";

    while (nurseCard.firstChild) {
        originalContent.appendChild(nurseCard.firstChild);
    }

    nurseCard.appendChild(originalContent);

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
        const pageKey = ["closing", "schedule", "temp2", "temp3"][index];

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