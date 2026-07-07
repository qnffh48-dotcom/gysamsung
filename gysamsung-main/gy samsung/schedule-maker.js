import {
    db,
    auth,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    onAuthStateChanged
} from "./firebase.js";

import {
    hospitalCollection,
    getHospitalInfo,
    getHospitalId
} from "./hospital.js";


const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
const defaultNames = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

const SUNDAY_MIN_TARGET = 1;
const WEEKLY_WORK_TARGET = 5;
const BALANCE_STORAGE_KEY = "schedule_balance_v5";

let latestScheduleState = null;
function setupMakerDateSelects() {
    const yearSelect = document.getElementById("yearInput");
    const monthSelect = document.getElementById("monthInput");

    if (!yearSelect || !monthSelect) return;

    const today = new Date();
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1;

    yearSelect.innerHTML = "";
    monthSelect.innerHTML = "";

    for (let y = 2024; y <= 2035; y++) {
        yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
    }

    for (let m = 1; m <= 12; m++) {
        monthSelect.innerHTML += `<option value="${m}">${m}월</option>`;
    }

    yearSelect.value = thisYear;
    monthSelect.value = thisMonth;
}
async function handleMakerMonthChange() {
    latestScheduleState = null;

    renderVacationSettings();
    renderWantSettings();

    const calendarBody = document.getElementById("calendarBody");
    const summaryBox = document.getElementById("summaryBox");

    if (calendarBody) calendarBody.innerHTML = "";
    if (summaryBox) summaryBox.innerHTML = "";

    await loadSavedScheduleFromCloud(true);
}
async function initScheduleMaker() {
    initMakerPage();

    setupMakerDateSelects();

    syncDepartmentTabs();
    renderEmployeeInputs();
    renderDaySettings();
    renderVacationSettings();
    renderWantSettings();

    await loadSavedScheduleFromCloud(true);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScheduleMaker);
} else {
    initScheduleMaker();
}
function initMakerPage() {
    const hospitalName = document.getElementById("hospitalName");
    const hospitalLogo = document.getElementById("hospitalLogo");

    try {
        const info = getHospitalInfo();
        if (hospitalName) hospitalName.textContent = info.name || "스케줄 생성";
        if (hospitalLogo && info.logo) hospitalLogo.src = info.logo;
    } catch (e) {
        if (hospitalName) hospitalName.textContent = "스케줄 생성";
    }
}

function setSaveStatus(message, type = "") {
    const box = document.getElementById("saveStatus");
    if (!box) return;

    box.textContent = message || "";
    box.className = `save-status ${type}`.trim();
}

function getDepartment() {
    const select = document.getElementById("departmentSelect");
    return select ? select.value : "common";
}

function getDepartmentText() {
    const select = document.getElementById("departmentSelect");
    return select?.selectedOptions?.[0]?.textContent || "공통";
}

function syncDepartmentTabs() {
    const current = getDepartment();
    const label = document.getElementById("activeDepartmentName");

    document.querySelectorAll(".department-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.dept === current);
    });

    if (label) {
        label.textContent = getDepartmentText();
    }
}

async function changeScheduleDepartment(department) {
    const select = document.getElementById("departmentSelect");
    if (!select) return;

    select.value = department;
    latestScheduleState = null;
    setSaveStatus(`${getDepartmentText()} 선택됨`, "");

    const calendarBody = document.getElementById("calendarBody");
    const summaryBox = document.getElementById("summaryBox");

    if (calendarBody) calendarBody.innerHTML = "";
    if (summaryBox) summaryBox.innerHTML = "";

    syncDepartmentTabs();

    await loadSavedScheduleFromCloud(true);
}

function getScheduleDocId(year, month, department = getDepartment()) {
    return `${year}-${String(month).padStart(2, "0")}_${department}`;
}

function getSettingsSnapshot() {
    const dayConditions = {};

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        dayConditions[dayIndex] = getDayCondition(dayIndex);
    }

    return {
        employees: getEmployees(),
        dayConditions,
        vacations: Object.fromEntries(
            Object.entries(getVacationMap()).map(([name, set]) => [name, [...set]])
        ),
        wants: getWantMap()
    };
}


function handleEmployeeCountChange() {
    renderEmployeeInputs();
    renderDaySettings();
    renderVacationSettings();
    renderWantSettings();
}

function handleEmployeeNameChange() {
    renderDaySettings();
    renderVacationSettings();
    renderWantSettings();
}

function getEmployeeCount() {
    return Number(document.getElementById("employeeCount").value);
}

function getEmployees() {
    const employees = [];

    for (let i = 0; i < getEmployeeCount(); i++) {
        const input = document.getElementById(`employeeName${i}`);
        const name = input ? input.value.trim() : "";

        if (name) {
            employees.push(name);
        }
    }

    return employees;
}

function renderEmployeeInputs() {
    const box = document.getElementById("employeeInputs");
    box.innerHTML = "";

    for (let i = 0; i < getEmployeeCount(); i++) {
        const label = document.createElement("label");

        label.innerHTML = `
            근무자 ${i + 1}
            <input
                type="text"
                id="employeeName${i}"
                value="${defaultNames[i] || `직원${i + 1}`}"
                oninput="handleEmployeeNameChange()"
            >
        `;

        box.appendChild(label);
    }
}

function makeWorkerOptions(employeeCount) {
    let html = "";

    for (let i = 1; i <= employeeCount; i++) {
        html += `<option value="${i}">${i}명</option>`;
    }

    return html;
}

function renderDaySettings() {
    const employees = getEmployees();
    const box = document.getElementById("daySettings");
    box.innerHTML = "";

    dayNames.forEach((dayName, dayIndex) => {
        const fixedCheckboxes = employees.map(employee => {
            return `
                <label>
                    <input type="checkbox" class="fixed-member" data-day="${dayIndex}" value="${employee}">
                    ${employee}
                </label>
            `;
        }).join("");

        const row = document.createElement("div");
        row.className = "day-row";

        row.innerHTML = `
            <div class="day-title">${dayName}요일</div>

            <label>
                바쁨 정도
                <select id="busyLevel${dayIndex}">
                    <option value="low">한가함</option>
                    <option value="normal" selected>보통</option>
                    <option value="high">바쁨</option>
                </select>
            </label>

            <label>
                최소 인원
                <select id="minWorkers${dayIndex}">
                    ${makeWorkerOptions(employees.length)}
                </select>
            </label>

            <label>
                최대 인원
                <select id="maxWorkers${dayIndex}">
                    ${makeWorkerOptions(employees.length)}
                </select>
            </label>

            <div>
                <div style="font-weight:bold; margin-bottom:6px;">고정멤버</div>
                <div class="fixed-members">
                    ${fixedCheckboxes}
                </div>
            </div>
        `;

        box.appendChild(row);
    });

    setDefaultDayValues();
}

function setDefaultDayValues() {
    const count = getEmployeeCount();

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const busySelect = document.getElementById(`busyLevel${dayIndex}`);
        const minSelect = document.getElementById(`minWorkers${dayIndex}`);
        const maxSelect = document.getElementById(`maxWorkers${dayIndex}`);

        if (!busySelect || !minSelect || !maxSelect) continue;

        if (dayIndex === 0) {
            busySelect.value = "normal";
            minSelect.value = Math.min(2, count);
            maxSelect.value = Math.min(2, count);
        } else if (dayIndex === 1 || dayIndex === 5) {
            busySelect.value = "high";
            minSelect.value = Math.min(3, count);
            maxSelect.value = Math.min(4, count);
        } else if (dayIndex === 3) {
            busySelect.value = "low";
            minSelect.value = Math.min(2, count);
            maxSelect.value = Math.min(2, count);
        } else if (dayIndex === 6) {
            busySelect.value = "normal";
            minSelect.value = Math.min(2, count);
            maxSelect.value = Math.min(2, count);
        } else {
            busySelect.value = "normal";
            minSelect.value = Math.min(3, count);
            maxSelect.value = Math.min(3, count);
        }
    }
}

function getDayCondition(dayIndex) {
    return {
        busyLevel: document.getElementById(`busyLevel${dayIndex}`).value,
        minWorkers: Number(document.getElementById(`minWorkers${dayIndex}`).value),
        maxWorkers: Number(document.getElementById(`maxWorkers${dayIndex}`).value),
        fixedMembers: [...document.querySelectorAll(`.fixed-member[data-day="${dayIndex}"]:checked`)].map(input => input.value)
    };
}

function getCalendarRange(year, month) {
    const firstDate = new Date(year, month - 1, 1);
    const lastDate = new Date(year, month, 0);

    const startDate = new Date(firstDate);
    startDate.setDate(firstDate.getDate() - firstDate.getDay());

    const endDate = new Date(lastDate);
    endDate.setDate(lastDate.getDate() + (6 - lastDate.getDay()));

    return { startDate, endDate };
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`;
}

function getWeekKey(date) {
    const temp = new Date(date);
    temp.setDate(temp.getDate() - temp.getDay());
    return getDateKey(temp);
}

function buildWeeks(startDate, endDate) {
    const weeks = [];
    const cursor = new Date(startDate);
    let week = [];

    while (cursor <= endDate) {
        week.push(new Date(cursor));

        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return weeks;
}

function renderVacationSettings() {
    const box = document.getElementById("vacationSettings");
    if (!box) return;

    const employees = getEmployees();
    const year = Number(document.getElementById("yearInput").value);
    const month = Number(document.getElementById("monthInput").value);
    const { startDate, endDate } = getCalendarRange(year, month);

    box.innerHTML = "";

    employees.forEach(employee => {
        const personBox = document.createElement("div");
        personBox.className = "vacation-person";

        let html = "";
        const cursor = new Date(startDate);

        while (cursor <= endDate) {
            const dayIndex = cursor.getDay();
            const dateKey = getDateKey(cursor);
            const isOtherMonth = cursor.getMonth() + 1 !== month;

            html += `
                <label class="${dayIndex === 0 ? "sunday" : dayIndex === 6 ? "saturday" : ""} ${isOtherMonth ? "other-month-label" : ""}">
                    <input
                        type="checkbox"
                        class="vacation-check"
                        data-name="${employee}"
                        data-date="${dateKey}"
                    >
                    ${cursor.getMonth() + 1}/${cursor.getDate()}(${dayNames[dayIndex]})
                </label>
            `;

            cursor.setDate(cursor.getDate() + 1);
        }

        personBox.innerHTML = `
            <div class="vacation-name">${employee}</div>
            <div class="vacation-days">
                ${html}
            </div>
        `;

        box.appendChild(personBox);
    });
}

function renderWantSettings() {
    const box = document.getElementById("wantSettings");
    if (!box) return;

    const employees = getEmployees();
    const year = Number(document.getElementById("yearInput").value);
    const month = Number(document.getElementById("monthInput").value);
    const lastDate = new Date(year, month, 0).getDate();

    box.innerHTML = "";

    employees.forEach(employee => {
        let options = `<option value="">선택 안 함</option>`;

        for (let day = 1; day <= lastDate; day++) {
            const date = new Date(year, month - 1, day);
            const dateKey = getDateKey(date);

            options += `<option value="${dateKey}">${month}/${day}(${dayNames[date.getDay()]})</option>`;
        }

        const row = document.createElement("div");
        row.className = "want-person";

        row.innerHTML = `
            <div class="want-person-name">${employee}</div>
            <select class="want-select" data-name="${employee}">
                ${options}
            </select>
        `;

        box.appendChild(row);
    });
}

function getVacationMap() {
    const map = {};
    getEmployees().forEach(name => {
        map[name] = new Set();
    });

    document.querySelectorAll(".vacation-check:checked").forEach(check => {
        const name = check.dataset.name;
        const dateKey = check.dataset.date;

        if (!map[name]) {
            map[name] = new Set();
        }

        map[name].add(dateKey);
    });

    return map;
}

function getWantMap() {
    const map = {};
    getEmployees().forEach(name => {
        map[name] = "";
    });

    document.querySelectorAll(".want-select").forEach(select => {
        map[select.dataset.name] = select.value;
    });

    return map;
}

function generateSchedule() {
    const year = Number(document.getElementById("yearInput").value);
    const month = Number(document.getElementById("monthInput").value);
    const employees = getEmployees();
    const vacationMap = getVacationMap();
    const wantMap = getWantMap();
    const balanceData = loadBalanceData();

    latestScheduleState = null;

    if (employees.length < 2) {
        alert("근무자는 최소 2명 이상이어야 합니다.");
        return;
    }

    const basicMessage = validateBasicConditions(employees);
    if (basicMessage) {
        alert(basicMessage);
        return;
    }

    const sundayMessage = validateTargetMonthSundayRule({ employees, year, month, vacationMap, wantMap });
    if (sundayMessage) {
        alert(sundayMessage);
        return;
    }

    const range = getCalendarRange(year, month);
    const weeks = buildWeeks(range.startDate, range.endDate);

    const scheduleRows = [];
    const workCount = {};
    const targetMonthWorkCount = {};
    const targetMonthBusyCount = {};
    const dayWorkCount = {};
    const offDayCount = {};
    const sundayWorkCount = {};

    employees.forEach(name => {
        workCount[name] = 0;
        targetMonthWorkCount[name] = 0;
        targetMonthBusyCount[name] = 0;
        sundayWorkCount[name] = 0;
        dayWorkCount[name] = {};
        offDayCount[name] = {};

        dayNames.forEach(dayName => {
            dayWorkCount[name][dayName] = 0;
            offDayCount[name][dayName] = 0;
        });
    });

    weeks.forEach(weekDates => {
        const rows = generateOneWeek({
            weekDates,
            employees,
            year,
            month,
            vacationMap,
            wantMap,
            balanceData,
            workCount,
            targetMonthWorkCount,
            targetMonthBusyCount,
            dayWorkCount,
            offDayCount,
            sundayWorkCount
        });

        scheduleRows.push(...rows);
    });

    const warnings = [
        ...checkWeeklyWorkRules(scheduleRows, employees, vacationMap),
        ...checkSundayMinimum(employees, sundayWorkCount)
    ];

    latestScheduleState = {
        employees: [...employees],
        year,
        month,
        department: getDepartment(),
        departmentText: getDepartmentText(),
        settings: getSettingsSnapshot(),
        rows: scheduleRows.map(row => ({
            dateKey: row.dateKey,
            year: row.year,
            month: row.month,
            day: row.day,
            dayIndex: row.dayIndex,
            dayName: row.dayName,
            isTargetMonth: row.isTargetMonth,
            busyLevel: row.condition.busyLevel,
            minWorkers: row.condition.minWorkers,
            maxWorkers: row.condition.maxWorkers,
            fixedMembers: [...row.condition.fixedMembers],
            workers: [...row.workers],
            offWorkers: [...row.offWorkers],
            warning: row.warning
        })),
        targetMonthWorkCount: { ...targetMonthWorkCount },
        targetMonthBusyCount: { ...targetMonthBusyCount }
    };

    renderCalendar(year, month, scheduleRows);
    renderSummary({
        employees,
        dayWorkCount,
        offDayCount,
        workCount,
        sundayWorkCount,
        targetMonthWorkCount,
        targetMonthBusyCount,
        weeklyWarnings: warnings,
        balanceData
    });
}

function validateBasicConditions(employees) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const condition = getDayCondition(dayIndex);

        if (condition.minWorkers > condition.maxWorkers) {
            return `${dayNames[dayIndex]}요일 최소인원이 최대인원보다 큽니다.`;
        }

        if (condition.fixedMembers.length > condition.maxWorkers) {
            return `${dayNames[dayIndex]}요일 고정멤버가 최대인원보다 많습니다.`;
        }

        if (condition.maxWorkers > employees.length) {
            return `${dayNames[dayIndex]}요일 최대인원이 전체 근무자보다 많습니다.`;
        }
    }

    return "";
}

function getTargetMonthSundays(year, month) {
    const sundays = [];
    const lastDate = new Date(year, month, 0).getDate();

    for (let day = 1; day <= lastDate; day++) {
        const date = new Date(year, month - 1, day);

        if (date.getDay() === 0) {
            sundays.push(date);
        }
    }

    return sundays;
}

function validateTargetMonthSundayRule({ employees, year, month, vacationMap, wantMap }) {
    const sundays = getTargetMonthSundays(year, month);
    const sundayMaxSlots = sundays.length * getDayCondition(0).maxWorkers;
    const requiredSlots = employees.length * SUNDAY_MIN_TARGET;

    if (requiredSlots > sundayMaxSlots) {
        return `일요일 ${SUNDAY_MIN_TARGET}회 이상 배치가 불가능합니다.\n일요일 최대인원을 올려야 합니다.`;
    }

    for (const name of employees) {
        let available = 0;

        sundays.forEach(date => {
            const row = {
                date,
                dateKey: getDateKey(date),
                dayIndex: 0
            };

            if (canWorkOnRow(name, row, vacationMap, wantMap)) {
                available++;
            }
        });

        if (available < SUNDAY_MIN_TARGET) {
            return `${name}님은 일요일 근무 가능일이 ${available}번뿐입니다.`;
        }
    }

    return "";
}

function generateOneWeek({
    weekDates,
    employees,
    year,
    month,
    vacationMap,
    wantMap,
    balanceData,
    workCount,
    targetMonthWorkCount,
    targetMonthBusyCount,
    dayWorkCount,
    offDayCount,
    sundayWorkCount
}) {
    const rows = [];
    const weekWork = {};
    const vacationCount = {};
    const weeklyTarget = {};

    function addWorkerToRow(row, name) {
        if (row.workers.includes(name)) return;

        row.workers.push(name);
        weekWork[name]++;

        workCount[name]++;

        if (row.isTargetMonth) {
            dayWorkCount[name][row.dayName]++;
            targetMonthWorkCount[name]++;

            if (row.condition.busyLevel === "high") {
                targetMonthBusyCount[name]++;
            }

            if (row.dayIndex === 0) {
                sundayWorkCount[name]++;
            }
        }
    }

    function removeWorkerFromRow(row, name) {
        if (!row.workers.includes(name)) return;

        row.workers = row.workers.filter(worker => worker !== name);
        weekWork[name]--;

        workCount[name]--;

        if (row.isTargetMonth) {
            dayWorkCount[name][row.dayName]--;
            targetMonthWorkCount[name]--;

            if (row.condition.busyLevel === "high") {
                targetMonthBusyCount[name]--;
            }

            if (row.dayIndex === 0) {
                sundayWorkCount[name]--;
            }
        }
    }

    employees.forEach(name => {
        weekWork[name] = 0;
        vacationCount[name] = 0;
    });

    weekDates.forEach(date => {
        const dateKey = getDateKey(date);

        employees.forEach(name => {
            if (vacationMap[name]?.has(dateKey)) {
                vacationCount[name]++;
            }
        });
    });

    employees.forEach(name => {
        weeklyTarget[name] = Math.max(0, WEEKLY_WORK_TARGET - vacationCount[name]);
    });

    weekDates.forEach(date => {
        const dayIndex = date.getDay();
        const dateKey = getDateKey(date);
        const condition = getDayCondition(dayIndex);

        rows.push({
            date,
            dateKey,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            dayIndex,
            dayName: dayNames[dayIndex],
            isTargetMonth: date.getFullYear() === year && date.getMonth() + 1 === month,
            condition,
            workers: [],
            offWorkers: [],
            warning: ""
        });
    });

    rows.forEach(row => {
        row._weekRows = rows;
    });

    rows.forEach(row => {
        row.condition.fixedMembers.forEach(name => {
            if (row.workers.length >= row.condition.maxWorkers) return;
            if (!employees.includes(name)) return;
            if (row.workers.includes(name)) return;
            if (!canWorkOnRow(name, row, vacationMap, wantMap)) return;

            addWorkerToRow(row, name);
        });
    });

    rows.forEach(row => {
        if (!(row.isTargetMonth && row.dayIndex === 0)) return;

        const candidates = employees
            .filter(name => !row.workers.includes(name))
            .filter(name => canWorkOnRow(name, row, vacationMap, wantMap))
            .filter(name => weekWork[name] < weeklyTarget[name])
            .sort((a, b) => {
                return getWorkerScore({
                    name: a,
                    row,
                    balanceData,
                    workCount,
                    targetMonthWorkCount,
                    targetMonthBusyCount,
                    dayWorkCount,
                    offDayCount,
                    weekWork,
                    sundayWorkCount
                }) - getWorkerScore({
                    name: b,
                    row,
                    balanceData,
                    workCount,
                    targetMonthWorkCount,
                    targetMonthBusyCount,
                    dayWorkCount,
                    offDayCount,
                    weekWork,
                    sundayWorkCount
                });
            });

        for (const name of candidates) {
            if (row.workers.length >= row.condition.maxWorkers) break;

            addWorkerToRow(row, name);
        }
    });

    rows.forEach(row => {
        fillRowToMinimum({
            row,
            employees,
            vacationMap,
            wantMap,
            balanceData,
            workCount,
            targetMonthWorkCount,
            targetMonthBusyCount,
            dayWorkCount,
            offDayCount,
            weekWork,
            weeklyTarget,
            sundayWorkCount,
            addWorkerToRow,
            removeWorkerFromRow
        });
    });

    employees.forEach(name => {
        while (weekWork[name] < weeklyTarget[name]) {
            const availableRows = rows
                .filter(row => !row.workers.includes(name))
                .filter(row => canWorkOnRow(name, row, vacationMap, wantMap))
                .filter(row => row.workers.length < row.condition.maxWorkers)
                .sort((a, b) => {
                    return getRowFillPriority(a, name, dayWorkCount, targetMonthBusyCount, balanceData, offDayCount)
                        - getRowFillPriority(b, name, dayWorkCount, targetMonthBusyCount, balanceData, offDayCount);
                });

            if (availableRows.length === 0) break;

            const row = availableRows[0];
            addWorkerToRow(row, name);
        }
    });

    rows.forEach(row => {
        fillRowToMinimum({
            row,
            employees,
            vacationMap,
            wantMap,
            balanceData,
            workCount,
            targetMonthWorkCount,
            targetMonthBusyCount,
            dayWorkCount,
            offDayCount,
            weekWork,
            weeklyTarget,
            sundayWorkCount,
            addWorkerToRow,
            removeWorkerFromRow
        });
    });

    rows.forEach(row => {
        const rawOffWorkers = employees.filter(name => !row.workers.includes(name));

        rawOffWorkers.forEach(name => {
            if (row.isTargetMonth) {
                offDayCount[name][row.dayName]++;
            }
        });

        row.offWorkers = rawOffWorkers.map(name => {
            if (vacationMap[name]?.has(row.dateKey)) return `${name}(휴가)`;
            if (wantMap[name] === row.dateKey) return `${name}(want)`;
            return name;
        });

        const warnings = [];

        if (row.workers.length < row.condition.minWorkers) {
            warnings.push(`조건 충돌: 최소 ${row.condition.minWorkers}명 필요 / 현재 ${row.workers.length}명`);
        }

        if (row.workers.length > row.condition.maxWorkers) {
            warnings.push(`조건 충돌: 최대 ${row.condition.maxWorkers}명 초과 / 현재 ${row.workers.length}명`);
        }

        row.warning = warnings.join("<br>");
    });

    return rows;
}

function fillRowToMinimum({
    row,
    employees,
    vacationMap,
    wantMap,
    balanceData,
    workCount,
    targetMonthWorkCount,
    targetMonthBusyCount,
    dayWorkCount,
    offDayCount,
    weekWork,
    weeklyTarget,
    sundayWorkCount,
    addWorkerToRow,
    removeWorkerFromRow
}) {
    if (row.workers.length >= row.condition.minWorkers) {
        return;
    }

    const candidates = employees
        .filter(name => !row.workers.includes(name))
        .filter(name => canWorkOnRow(name, row, vacationMap, wantMap))
        .filter(name => weekWork[name] < weeklyTarget[name])
        .sort((a, b) => {
            return getWorkerScore({
                name: a,
                row,
                balanceData,
                workCount,
                targetMonthWorkCount,
                targetMonthBusyCount,
                dayWorkCount,
                offDayCount,
                weekWork,
                sundayWorkCount
            }) - getWorkerScore({
                name: b,
                row,
                balanceData,
                workCount,
                targetMonthWorkCount,
                targetMonthBusyCount,
                dayWorkCount,
                offDayCount,
                weekWork,
                sundayWorkCount
            });
        });

    for (const name of candidates) {
        if (row.workers.length >= row.condition.minWorkers) break;
        if (row.workers.length >= row.condition.maxWorkers) break;

        addWorkerToRow(row, name);
    }

    if (row.workers.length >= row.condition.minWorkers) {
        return;
    }

    const swapCandidates = employees
        .filter(name => !row.workers.includes(name))
        .filter(name => canWorkOnRow(name, row, vacationMap, wantMap))
        .filter(name => weekWork[name] === weeklyTarget[name])
        .sort((a, b) => {
            return getWorkerScore({
                name: a,
                row,
                balanceData,
                workCount,
                targetMonthWorkCount,
                targetMonthBusyCount,
                dayWorkCount,
                offDayCount,
                weekWork,
                sundayWorkCount
            }) - getWorkerScore({
                name: b,
                row,
                balanceData,
                workCount,
                targetMonthWorkCount,
                targetMonthBusyCount,
                dayWorkCount,
                offDayCount,
                weekWork,
                sundayWorkCount
            });
        });

    for (const name of swapCandidates) {
        if (row.workers.length >= row.condition.minWorkers) break;
        if (row.workers.length >= row.condition.maxWorkers) break;

        const removableRow = findRemovableRowForWorker(name, row);

        if (!removableRow) {
            continue;
        }

        removeWorkerFromRow(removableRow, name);
        addWorkerToRow(row, name);
    }
}

function findRemovableRowForWorker(name, targetRow) {
    const allRows = targetRow._weekRows || [];

    const removableRows = allRows
        .filter(row => row !== targetRow)
        .filter(row => row.workers.includes(name))
        .filter(row => row.workers.length > row.condition.minWorkers)
        .filter(row => !row.condition.fixedMembers.includes(name))
        .sort((a, b) => {
            return getRemovePriority(a) - getRemovePriority(b);
        });

    return removableRows[0] || null;
}

function getRemovePriority(row) {
    if (row.condition.busyLevel === "low") return 1;
    if (row.condition.busyLevel === "normal") return 2;
    if (row.condition.busyLevel === "high") return 3;

    return 4;
}

function canWorkOnRow(name, row, vacationMap, wantMap) {
    if (vacationMap[name]?.has(row.dateKey)) return false;
    if (wantMap[name] === row.dateKey) return false;
    if (isAutoSundayOff(name, row, vacationMap, wantMap)) return false;
    return true;
}

function getWorkerScore({
    name,
    row,
    balanceData,
    workCount,
    targetMonthWorkCount,
    targetMonthBusyCount,
    dayWorkCount,
    offDayCount,
    weekWork,
    sundayWorkCount
}) {
    let score = 0;

    const workSameDay = dayWorkCount[name]?.[row.dayName] || 0;
    const offSameDay = offDayCount[name]?.[row.dayName] || 0;

    // 같은 요일 근무가 한 사람에게 몰리는 것 강하게 방지
    score += workSameDay * 12000;

    // 이미 많이 쉰 요일은 근무로 넣어 휴무요일 편중을 완화
    score -= offSameDay * 2500;

    // 일요일도 한 사람에게 몰리지 않게 보정
    if (row.isTargetMonth && row.dayIndex === 0) {
        score += sundayWorkCount[name] * 8000;
    }

    // 바쁜날 공평 보정
    if (row.condition.busyLevel === "high") {
        score += (targetMonthBusyCount[name] || 0) * 5000;
        score += getBusyBalance(name, balanceData) * 5000;
    }

    // 전체 근무일 공평 보정
    score += (targetMonthWorkCount[name] || 0) * 1000;
    score += getTotalBalance(name, balanceData) * 1000;

    // 주간/전체 근무 과다 방지
    score += weekWork[name] * 500;
    score += workCount[name] * 100;

    return score;
}

function getRowFillPriority(row, name, dayWorkCount, targetMonthBusyCount, balanceData, offDayCount = {}) {
    let score = 0;

    const workSameDay = dayWorkCount[name]?.[row.dayName] || 0;
    const offSameDay = offDayCount[name]?.[row.dayName] || 0;

    // 이미 많이 근무한 요일은 피함
    score += workSameDay * 12000;

    // 이미 많이 쉬었던 요일은 근무로 넣어서 휴무요일 편중 완화
    score -= offSameDay * 2500;

    // 바쁜날은 그래도 우선 채움
    if (row.condition.busyLevel === "high") score -= 10000;
    if (row.condition.busyLevel === "normal") score -= 5000;
    if (row.condition.busyLevel === "low") score -= 1000;

    if (row.condition.busyLevel === "high") {
        score += (targetMonthBusyCount[name] || 0) * 500;
        score += getBusyBalance(name, balanceData) * 500;
    }

    return score;
}

function getBusyBalance(name, data) {
    return data.balances?.[name]?.busy || 0;
}

function getTotalBalance(name, data) {
    return data.balances?.[name]?.total || 0;
}

function checkWeeklyWorkRules(rows, employees, vacationMap) {
    const weeklyMap = {};
    const vacationMapByWeek = {};
    const warnings = [];

    rows.forEach(row => {
        const weekKey = getWeekKey(row.date);

        if (!weeklyMap[weekKey]) {
            weeklyMap[weekKey] = {};
            vacationMapByWeek[weekKey] = {};

            employees.forEach(name => {
                weeklyMap[weekKey][name] = 0;
                vacationMapByWeek[weekKey][name] = 0;
            });
        }

        row.workers.forEach(name => {
            weeklyMap[weekKey][name]++;
        });

        employees.forEach(name => {
            if (vacationMap[name]?.has(row.dateKey)) {
                vacationMapByWeek[weekKey][name]++;
            }
        });
    });

    Object.keys(weeklyMap).forEach(weekKey => {
        employees.forEach(name => {
            const target = Math.max(0, WEEKLY_WORK_TARGET - vacationMapByWeek[weekKey][name]);
            const actual = weeklyMap[weekKey][name];

            if (actual !== target) {
                warnings.push(`${weekKey} 주차 / ${name}: 근무 ${actual}일, 휴가 ${vacationMapByWeek[weekKey][name]}일, 목표근무 ${target}일`);
            }
        });
    });

    return warnings;
}

function checkSundayMinimum(employees, sundayWorkCount) {
    return employees
        .filter(name => sundayWorkCount[name] < SUNDAY_MIN_TARGET)
        .map(name => `${name}: 선택월 일요일 근무 ${sundayWorkCount[name]}번 / 최소 ${SUNDAY_MIN_TARGET}번 필요`);
}

function getShiftedDateKey(date, diff) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + diff);
    return getDateKey(newDate);
}

function isAutoSundayOff(name, row, vacationMap, wantMap) {
    if (row.dayIndex !== 0) return false;

    const prevDateKey = getShiftedDateKey(row.date, -1);
    const nextDateKey = getShiftedDateKey(row.date, 1);

    const prevIsRest = vacationMap[name]?.has(prevDateKey) || wantMap[name] === prevDateKey;
    const nextIsRest = vacationMap[name]?.has(nextDateKey) || wantMap[name] === nextDateKey;

    return prevIsRest && nextIsRest;
}

function renderCalendar(year, month, rows) {
    const body = document.getElementById("calendarBody");
    body.innerHTML = "";

    let tr = null;

    rows.forEach((row, index) => {
        if (index % 7 === 0) {
            tr = document.createElement("tr");
            body.appendChild(tr);
        }

        const td = document.createElement("td");

        if (!row.isTargetMonth) {
            td.classList.add("other-month");
        }

        const dayClass = row.dayIndex === 0 ? "sunday" : row.dayIndex === 6 ? "saturday" : "";

        td.innerHTML = `
            <div class="date-line ${dayClass}">
                ${row.month}/${row.day}(${row.dayName})
            </div>

            <div class="worker-line">
                <span class="worker-label">근무</span><br>
                ${row.workers.length ? row.workers.join(", ") : "-"}
            </div>

            <div class="off-line">
                <span class="off-label">휴무</span><br>
                ${row.offWorkers.length ? formatOffWorkers(row.offWorkers) : "-"}
            </div>

            ${row.warning ? `<div class="warning">${row.warning}</div>` : ""}
        `;

        tr.appendChild(td);
    });
}

function formatOffWorkers(offWorkers) {
    return offWorkers.map(name => {
        if (name.includes("(휴가)")) return `<span class="vacation-mark">${name}</span>`;
        if (name.includes("(want)")) return `<span class="want-mark">${name}</span>`;
        return name;
    }).join(", ");
}

function renderSummary({
    employees,
    dayWorkCount,
    offDayCount = {},
    workCount,
    sundayWorkCount,
    targetMonthWorkCount,
    targetMonthBusyCount,
    weeklyWarnings = [],
    balanceData
}) {
    const box = document.getElementById("summaryBox");

    let html = `
        <h2>근무자별 요약</h2>

        <table class="summary-table">
            <thead>
                <tr>
                    <th>근무자</th>
                    <th>전체 표시 근무</th>
                    <th>선택월 근무</th>
                    <th>선택월 바쁜날</th>
                    <th>다음달 바쁜날 보정</th>
                    <th>다음달 전체 보정</th>
                    <th>일요일</th>
                    <th>월</th>
                    <th>화</th>
                    <th>수</th>
                    <th>목</th>
                    <th>금</th>
                    <th>토</th>
                </tr>
            </thead>
            <tbody>
    `;

    employees.forEach(name => {
        html += `
            <tr>
                <td>${name}</td>
                <td>${workCount[name]}일</td>
                <td>${targetMonthWorkCount[name]}일</td>
                <td>${targetMonthBusyCount[name]}일</td>
                <td>${formatBalance(getBusyBalance(name, balanceData))}</td>
                <td>${formatBalance(getTotalBalance(name, balanceData))}</td>
                <td>${sundayWorkCount[name]}번</td>
                <td>${dayWorkCount[name]["월"]}번</td>
                <td>${dayWorkCount[name]["화"]}번</td>
                <td>${dayWorkCount[name]["수"]}번</td>
                <td>${dayWorkCount[name]["목"]}번</td>
                <td>${dayWorkCount[name]["금"]}번</td>
                <td>${dayWorkCount[name]["토"]}번</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>

        <div class="balance-box">
            <h3>공평 보정 안내</h3>
            <p>스케줄이 마음에 들면 <b>이번달 확정</b>을 눌러야 다음달 보정에 반영됩니다.</p>
        </div>
    `;

    if (weeklyWarnings.length) {
        html += `
            <div class="warning-box">
                <h3>조건 확인 필요</h3>
                <ul>
                    ${weeklyWarnings.map(item => `<li>${item}</li>`).join("")}
                </ul>
            </div>
        `;
    }

    box.innerHTML = html;
}

function formatBalance(value) {
    const rounded = Math.round(value * 10) / 10;

    if (rounded > 0) return `<span class="balance-plus">+${rounded}</span>`;
    if (rounded < 0) return `<span class="balance-minus">${rounded}</span>`;

    return "0";
}

function loadBalanceData() {
    try {
        const raw = localStorage.getItem(BALANCE_STORAGE_KEY);

        if (!raw) {
            return { balances: {}, months: {} };
        }

        const data = JSON.parse(raw);

        return {
            balances: data.balances || {},
            months: data.months || {}
        };
    } catch (e) {
        return { balances: {}, months: {} };
    }
}

function confirmMonthBalance() {
    if (!latestScheduleState) {
        alert("먼저 스케줄을 생성해주세요.");
        return;
    }

    const ok = confirm("현재 생성된 스케줄을 이번달 확정으로 저장할까요?\n저장하면 다음달 공평 보정에 반영됩니다.");

    if (!ok) return;

    saveMonthBalance(latestScheduleState);
    saveCurrentScheduleToCloud(true);
    alert("이번달 스케줄이 확정 저장되었습니다.");
    generateSchedule();
}

function resetBalanceData() {
    const ok = confirm("저장된 공평 보정값을 모두 초기화할까요?");

    if (!ok) return;

    localStorage.removeItem(BALANCE_STORAGE_KEY);
    latestScheduleState = null;

    alert("공평 보정값이 초기화되었습니다.");
}

function saveMonthBalance({
    employees,
    year,
    month,
    targetMonthWorkCount,
    targetMonthBusyCount
}) {
    const monthKey = getMonthKey(year, month);
    const data = loadBalanceData();

    if (data.months[monthKey]) {
        Object.keys(data.months[monthKey]).forEach(name => {
            const old = data.months[monthKey][name];

            if (!data.balances[name]) {
                data.balances[name] = { busy: 0, total: 0 };
            }

            data.balances[name].busy -= old.busy || 0;
            data.balances[name].total -= old.total || 0;
        });
    }

    const workSum = employees.reduce((sum, name) => {
        return sum + (targetMonthWorkCount[name] || 0);
    }, 0);

    const busySum = employees.reduce((sum, name) => {
        return sum + (targetMonthBusyCount[name] || 0);
    }, 0);

    const avgWork = employees.length ? workSum / employees.length : 0;
    const avgBusy = employees.length ? busySum / employees.length : 0;

    const delta = {};

    employees.forEach(name => {
        const busy = (targetMonthBusyCount[name] || 0) - avgBusy;
        const total = (targetMonthWorkCount[name] || 0) - avgWork;

        delta[name] = { busy, total };

        if (!data.balances[name]) {
            data.balances[name] = { busy: 0, total: 0 };
        }

        data.balances[name].busy += busy;
        data.balances[name].total += total;
    });

    data.months[monthKey] = delta;
    localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(data));
}

async function waitForAuthUser() {
    if (auth.currentUser) {
        return auth.currentUser;
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            unsubscribe();
            reject(new Error("로그인 확인 시간이 초과되었습니다. login.html에서 다시 로그인해주세요."));
        }, 7000);

        const unsubscribe = onAuthStateChanged(auth, user => {
            clearTimeout(timer);
            unsubscribe();

            if (user) {
                resolve(user);
            } else {
                reject(new Error("로그인된 사용자가 없습니다. login.html에서 다시 로그인해주세요."));
            }
        }, error => {
            clearTimeout(timer);
            unsubscribe();
            reject(error);
        });
    });
}

async function saveCurrentScheduleToCloud(isConfirmed = false) {
    if (!latestScheduleState) {
        alert("먼저 스케줄을 생성해주세요.");
        return;
    }

    try {
        setSaveStatus("저장 중...", "loading");

        const user = await waitForAuthUser();

        console.log("현재 로그인:", user.email || user.uid);
        console.log("저장 컬렉션:", hospitalCollection("scheduleMakers"));

        const { year, month } = latestScheduleState;
        const department = getDepartment();
        const docId = getScheduleDocId(year, month, department);

        await setDoc(doc(db, hospitalCollection("scheduleMakers"), docId), {
            ...latestScheduleState,
            department,
            departmentText: getDepartmentText(),
            hospitalId: getHospitalId(),
            confirmed: Boolean(isConfirmed),
            updatedBy: user.email || user.uid,
            updatedAt: serverTimestamp()
        }, { merge: true });

        setSaveStatus(`저장 완료: ${year}년 ${month}월 / ${getDepartmentText()}`, "success");
        alert("저장 완료");

    } catch (error) {
        console.error("스케줄 저장 실패 원본:", error);

        const message = `
저장 실패

code: ${error.code || "없음"}
message: ${error.message || error}
        `;

        setSaveStatus("저장 실패", "error");
        alert(message);
    }
}

function applySavedSettings(settings = {}) {
    if (!settings || typeof settings !== "object") return;

    const employees = Array.isArray(settings.employees)
        ? settings.employees.filter(Boolean)
        : [];

    if (employees.length) {
        const employeeCountSelect = document.getElementById("employeeCount");

        if (employeeCountSelect) {
            const optionExists = [...employeeCountSelect.options]
                .some(option => option.value === String(employees.length));

            if (optionExists) {
                employeeCountSelect.value = String(employees.length);
            }
        }

        renderEmployeeInputs();

        employees.forEach((name, index) => {
            const input = document.getElementById(`employeeName${index}`);
            if (input) {
                input.value = name;
            }
        });
    }

    renderDaySettings();

    if (settings.dayConditions) {
        applySavedDayConditions(settings.dayConditions);
    }

    renderWantSettings();

    if (settings.wants) {
        applySavedWants(settings.wants);
    }

    renderVacationSettings();

    if (settings.vacations) {
        applySavedVacations(settings.vacations);
    }
}

function applySavedDayConditions(dayConditions = {}) {
    Object.entries(dayConditions || {}).forEach(([dayIndex, condition]) => {
        if (!condition) return;

        const busySelect = document.getElementById(`busyLevel${dayIndex}`);
        const minSelect = document.getElementById(`minWorkers${dayIndex}`);
        const maxSelect = document.getElementById(`maxWorkers${dayIndex}`);

        if (busySelect && condition.busyLevel) {
            busySelect.value = condition.busyLevel;
        }

        if (minSelect && condition.minWorkers !== undefined) {
            minSelect.value = String(condition.minWorkers);
        }

        if (maxSelect && condition.maxWorkers !== undefined) {
            maxSelect.value = String(condition.maxWorkers);
        }

        const fixedMembers = Array.isArray(condition.fixedMembers)
            ? condition.fixedMembers
            : [];

        document
            .querySelectorAll(`.fixed-member[data-day="${dayIndex}"]`)
            .forEach(check => {
                check.checked = fixedMembers.includes(check.value);
            });
    });
}

function applySavedVacations(vacations = {}) {
    document.querySelectorAll(".vacation-check").forEach(check => {
        const name = check.dataset.name;
        const dateKey = check.dataset.date;

        const savedList = Array.isArray(vacations[name])
            ? vacations[name]
            : [];

        check.checked = savedList.includes(dateKey);
    });
}

function applySavedWants(wants = {}) {
    document.querySelectorAll(".want-select").forEach(select => {
        const name = select.dataset.name;

        if (Object.prototype.hasOwnProperty.call(wants, name)) {
            select.value = wants[name] || "";
        }
    });
}


async function loadSavedScheduleFromCloud(silent = false) {
    const year = Number(document.getElementById("yearInput").value);
    const month = Number(document.getElementById("monthInput").value);
    const department = getDepartment();

    try {
        setSaveStatus("불러오는 중...", "loading");

        const snap = await getDoc(doc(db, hospitalCollection("scheduleMakers"), getScheduleDocId(year, month, department)));

        if (!snap.exists()) {
    if (!silent) {
        setSaveStatus("저장된 스케줄이 없습니다.", "error");
        alert("저장된 스케줄이 없습니다.");
    } else {
        setSaveStatus("저장된 스케줄 없음", "");
    }
    return;
}

        const data = snap.data();
        latestScheduleState = data;

        try {
            if (data.settings) {
                applySavedSettings(data.settings);
            }
        } catch (settingError) {
            console.error("설정값 적용 실패:", settingError);
            setSaveStatus("스케줄은 불러왔지만 설정값 적용 실패", "error");
        }

        renderCalendar(year, month, (data.rows || []).map(row => ({
            ...row,
            date: new Date(row.dateKey),
            condition: {
                busyLevel: row.busyLevel,
                minWorkers: row.minWorkers,
                maxWorkers: row.maxWorkers,
                fixedMembers: row.fixedMembers || []
            },
            warning: row.warning || ""
        })));

        if (data.targetMonthWorkCount) {
            const employees = data.employees || [];
            const blankDayWork = {};
            const sundayWorkCount = {};
            const workCount = {};
            employees.forEach(name => {
                blankDayWork[name] = { 일: 0, 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0 };
                sundayWorkCount[name] = 0;
                workCount[name] = 0;
            });

            (data.rows || []).forEach(row => {
                (row.workers || []).forEach(name => {
                    if (!blankDayWork[name]) return;
                    workCount[name]++;
                    blankDayWork[name][row.dayName]++;
                    if (row.isTargetMonth && row.dayIndex === 0) sundayWorkCount[name]++;
                });
            });

            renderSummary({
                employees,
                dayWorkCount: blankDayWork,
                workCount,
                sundayWorkCount,
                targetMonthWorkCount: data.targetMonthWorkCount || {},
                targetMonthBusyCount: data.targetMonthBusyCount || {},
                weeklyWarnings: [],
                balanceData: loadBalanceData()
            });
        }

        setSaveStatus(`불러오기 완료: ${year}년 ${month}월 / ${getDepartmentText()}`, "success");
    } catch (error) {
        console.error("불러오기 실패 원본:", error);

        const message = `
불러오기 실패

code: ${error.code || "없음"}
message: ${error.message || error}
        `;

        setSaveStatus("불러오기 실패", "error");

        if (!silent) {
            alert(message);
        }
    }
}

Object.assign(window, {
    setupMakerDateSelects,
    handleMakerMonthChange,
    renderVacationSettings,
    renderWantSettings,
    handleEmployeeCountChange,
    handleEmployeeNameChange,
    applySavedSettings,
    applySavedDayConditions,
    applySavedVacations,
    applySavedWants,
    generateSchedule,
    confirmMonthBalance,
    resetBalanceData,
    saveCurrentScheduleToCloud,
    loadSavedScheduleFromCloud,
    changeScheduleDepartment,
    syncDepartmentTabs
});
const floatingMakerNav = document.querySelector(".sidebar .nav");

if (floatingMakerNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingMakerNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}