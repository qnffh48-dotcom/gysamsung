const tabButtons = document.querySelectorAll(".tab-btn");
const tabPages = document.querySelectorAll(".tab-page");

tabButtons.forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.tab;

        tabButtons.forEach(btn => btn.classList.remove("active"));
        tabPages.forEach(page => page.classList.remove("active"));

        button.classList.add("active");
        document.getElementById(target).classList.add("active");
    });
});

const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const daySelect = document.getElementById("daySelect");
const prevDayBtn = document.getElementById("prevDayBtn");
const nextDayBtn = document.getElementById("nextDayBtn");

let selectedDate = new Date();

function fillDateSelects() {
    if (!yearSelect || !monthSelect || !daySelect) return;

    yearSelect.innerHTML = "";
    monthSelect.innerHTML = "";

    for (let y = 2024; y <= 2035; y++) {
        yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
    }

    for (let m = 1; m <= 12; m++) {
        monthSelect.innerHTML += `<option value="${m}">${m}월</option>`;
    }

    updateDayOptions();
    syncSelects();
}

function updateDayOptions() {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const currentDay = selectedDate.getDate();

    const lastDay = new Date(year, month, 0).getDate();

    daySelect.innerHTML = "";

    for (let d = 1; d <= lastDay; d++) {
        daySelect.innerHTML += `<option value="${d}">${d}일</option>`;
    }

    if (currentDay > lastDay) {
        selectedDate.setDate(lastDay);
    }
}

function syncSelects() {
    yearSelect.value = selectedDate.getFullYear();
    monthSelect.value = selectedDate.getMonth() + 1;
    daySelect.value = selectedDate.getDate();
}

function setDateFromSelects() {
    selectedDate = new Date(
        Number(yearSelect.value),
        Number(monthSelect.value) - 1,
        Number(daySelect.value)
    );

    updateDayOptions();
    syncSelects();

    loadRadiologyData();
}

function moveDay(amount) {
    selectedDate.setDate(selectedDate.getDate() + amount);

    updateDayOptions();
    syncSelects();

    loadRadiologyData();
}

function getRadiologyDateKey() {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const d = selectedDate.getDate();

    return `radiology-${y}-${m}-${d}`;
}

function saveRadiologyData() {
    const data = {};

    document.querySelectorAll(".report-input").forEach(input => {
        const key = input.dataset.key;
        if (!key) return;

        data[key] = input.value;
    });

    localStorage.setItem(getRadiologyDateKey(), JSON.stringify(data));

    updateCarmTotal();
}

function loadRadiologyData() {
    const saved =
        JSON.parse(localStorage.getItem(getRadiologyDateKey())) || {};

    document.querySelectorAll(".report-input").forEach(input => {
        const key = input.dataset.key;
        if (!key) return;

        input.value = saved[key] ?? "0";
    });

    updateCarmTotal();
}

function updateCarmTotal() {
    let total = 0;

    document.querySelectorAll(".carm-count").forEach(input => {
        total += Number(input.value) || 0;
    });

    const totalInput = document.querySelector(".total-input");

    if (totalInput) {
        totalInput.value = total + "개";
    }
}

document.querySelectorAll(".report-input").forEach(input => {
    input.addEventListener("input", saveRadiologyData);
});

fillDateSelects();

yearSelect?.addEventListener("change", setDateFromSelects);
monthSelect?.addEventListener("change", setDateFromSelects);
daySelect?.addEventListener("change", setDateFromSelects);

prevDayBtn?.addEventListener("click", () => moveDay(-1));
nextDayBtn?.addEventListener("click", () => moveDay(1));

loadRadiologyData();
const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}const lunchGroups = [
    ["권", "진영", "도영", "한솔"],
    ["윤아", "수현", "다운", "유진", "임시", "임시", "임시", "임시", "임시", "임시", "임시"],
    ["송희", "빈", "예지", "유빈"]
];

const lunchTimes = ["", "12", "13", "14"];

function getLunchKey(year, month, name, day) {
    return `lunch-${year}-${month}-${name}-${day}`;
}

function getLunchClass(value) {
    if (value === "12") return "time-12";
    if (value === "13") return "time-13";
    if (value === "14") return "time-14";
    return "";
}

function renderLunchSchedule() {
    const table = document.getElementById("monthlyLunchTable");
    const title = document.getElementById("lunchMonthText");

    if (!table) return;

    const year = currentYear;
    const month = currentMonth + 1;
    const lastDay = new Date(year, month, 0).getDate();

    title.textContent = `(${year}년 ${month}월)`;

    const weekNames = ["일", "월", "화", "수", "목", "금", "토"];

    let html = `
        <thead>
            <tr>
                <th rowspan="2" class="name-head">직원</th>
    `;

    for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month - 1, d).getDay();
        let cls = day === 6 ? "sat" : day === 0 ? "sun" : "";

        html += `<th class="${cls}">${weekNames[day]}</th>`;
    }

    html += `
            </tr>
            <tr>
    `;

    for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month - 1, d).getDay();
        let cls = day === 6 ? "sat" : day === 0 ? "sun" : "";

        html += `<th class="day-cell ${cls}">${d}</th>`;
    }

    html += `
            </tr>
        </thead>
        <tbody>
    `;

    lunchGroups.forEach((group, groupIndex) => {
        group.forEach(name => {
            html += `
                <tr>
                    <td class="name-cell" contenteditable="true">${name}</td>
            `;

            for (let d = 1; d <= lastDay; d++) {
                const key = getLunchKey(year, month, name, d);
                const value = localStorage.getItem(key) || "";
                const cls = getLunchClass(value);

                html += `
                    <td class="lunch-cell ${cls}"
                        data-key="${key}"
                        data-value="${value}">
                        <div class="lunch-dot"></div>
                    </td>
                `;
            }

            html += `</tr>`;
        });

        if (groupIndex !== lunchGroups.length - 1) {
            html += `
                <tr class="divider">
                    <td colspan="${lastDay + 1}"></td>
                </tr>
            `;
        }
    });

    html += `</tbody>`;

    table.innerHTML = html;

    document.querySelectorAll(".lunch-cell").forEach(cell => {
        cell.onclick = function () {
            let current = cell.dataset.value || "";
            let index = lunchTimes.indexOf(current);
            let next = lunchTimes[(index + 1) % lunchTimes.length];

            cell.dataset.value = next;
            cell.classList.remove("time-12", "time-13", "time-14");

            if (next) {
                cell.classList.add(getLunchClass(next));
                localStorage.setItem(cell.dataset.key, next);
            } else {
                localStorage.removeItem(cell.dataset.key);
            }
        };
    });
}

setTimeout(renderLunchSchedule, 100);