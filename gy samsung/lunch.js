import { db, doc, getDoc, setDoc } from "./firebase.js";
import {
    getHospitalId,
    setHospitalId,
    hospitalCollection
} from "./hospital.js";

/* =========================
   병원 선택
========================= */

const hospitalSelect = document.getElementById("hospitalSelect");

if (hospitalSelect) {
    hospitalSelect.value = getHospitalId();

    hospitalSelect.addEventListener("change", e => {
        setHospitalId(e.target.value);
    });
}

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
   날짜
========================= */

let lunchCurrentYear = new Date().getFullYear();
let lunchCurrentMonth = new Date().getMonth();

const lunchYearSelect = document.getElementById("lunchYearSelect");
const lunchMonthSelect = document.getElementById("lunchMonthSelect");

for (let y = 2024; y <= 2035; y++) {
    lunchYearSelect.innerHTML += `
        <option value="${y}">${y}년</option>
    `;
}

for (let m = 0; m < 12; m++) {
    lunchMonthSelect.innerHTML += `
        <option value="${m}">${m + 1}월</option>
    `;
}

lunchYearSelect.value = lunchCurrentYear;
lunchMonthSelect.value = lunchCurrentMonth;

lunchYearSelect.addEventListener("change", () => {
    lunchCurrentYear = Number(lunchYearSelect.value);
    renderLunchSchedule();
});

lunchMonthSelect.addEventListener("change", () => {
    lunchCurrentMonth = Number(lunchMonthSelect.value);
    renderLunchSchedule();
});

function changeLunchMonth(diff) {
    lunchCurrentMonth += diff;

    if (lunchCurrentMonth < 0) {
        lunchCurrentMonth = 11;
        lunchCurrentYear--;
    }

    if (lunchCurrentMonth > 11) {
        lunchCurrentMonth = 0;
        lunchCurrentYear++;
    }

    lunchYearSelect.value = lunchCurrentYear;
    lunchMonthSelect.value = lunchCurrentMonth;

    renderLunchSchedule();
}

window.changeLunchMonth = changeLunchMonth;

/* =========================
   직원 그룹
========================= */

const defaultLunchGroups = [
    {
        title: "방사선과",
        members: ["권", "진영", "도영", "한솔"]
    },
    {
        title: "간호과",
        members: ["윤아", "수현", "다은", "유진", "임시", "임시", "임시", "임시", "임시", "임시", "임시"]
    },
    {
        title: "원무과",
        members: ["송희", "빈", "예지", "유빈"]
    }
];

let lunchGroups = structuredClone(defaultLunchGroups);
let isLunchDragging = false;
let lunchDragValue = "";
let lunchDragMoved = false;
const lunchValues = ["", "12", "13", "14", "1진", "2진"];

function getLunchMonthKey() {
    return `${lunchCurrentYear}-${lunchCurrentMonth + 1}`;
}
let activeLunchCell = null;

function getLunchKey(groupIndex, memberIndex, day) {
    return `lunch-${groupIndex}-${memberIndex}-${day}`;
}

function getLunchClass(value) {
    if (value === "12") return "time-12";
    if (value === "13") return "time-13";
    if (value === "14") return "time-14";
    if (value === "1진") return "assist-1";
    if (value === "2진") return "assist-23";
    if (value === "23진") return "assist-23";
    if (value === "2,3진") return "assist-23";
    return "";
}

/* =========================
   불러오기 / 저장
========================= */

async function loadLunchData() {
    const snap = await getDoc(
        doc(db, hospitalCollection("lunchSchedules"), getLunchMonthKey())
    );

    return snap.exists() ? snap.data() : {};
}

async function saveLunchData(key, value) {
    await setDoc(
        doc(db, hospitalCollection("lunchSchedules"), getLunchMonthKey()),
        {
            [key]: value || ""
        },
        {
            merge: true
        }
    );
}

async function loadLunchNames() {
    const snap = await getDoc(
        doc(db, hospitalCollection("lunchNames"), "default")
    );

    if (!snap.exists()) {
        lunchGroups = structuredClone(defaultLunchGroups);
        return;
    }

    const data = snap.data();

    if (Array.isArray(data.groups)) {
        lunchGroups = data.groups;
    } else {
        lunchGroups = structuredClone(defaultLunchGroups);
    }
}

async function saveLunchNames() {
    await setDoc(
        doc(db, hospitalCollection("lunchNames"), "default"),
        {
            groups: lunchGroups
        },
        {
            merge: true
        }
    );
}

/* =========================
   칸 값 변경
========================= */

async function setLunchCellValue(cell, value) {
    cell.dataset.value = value;

    cell.classList.remove(
        "time-12",
        "time-13",
        "time-14",
        "assist-1",
        "assist-23",
        "selected-cell"
    );

    const cls = getLunchClass(value);

    if (value) {
        cell.classList.add(cls);
        cell.innerHTML = `<span class="lunch-badge ${cls}">${value}</span>`;
    } else {
        cell.innerHTML = "";
    }

    await saveLunchData(cell.dataset.key, value);
}
async function applyLunchCellValue(cell, value) {
    cell.dataset.value = value;

    cell.classList.remove(
        "time-12",
        "time-13",
        "time-14",
        "assist-1",
        "assist-23"
    );

    const cls = getLunchClass(value);

    if (value) {
        cell.classList.add(cls);
        cell.innerHTML = `<span class="lunch-badge ${cls}">${value}</span>`;
    } else {
        cell.innerHTML = "";
    }

    await saveLunchData(cell.dataset.key, value);
}
async function changeLunchCell(cell) {
    const current = cell.dataset.value || "";
    const index = lunchValues.indexOf(current);
    const next = lunchValues[(index + 1) % lunchValues.length];

    await applyLunchCellValue(cell, next);
}
/* =========================
   렌더
========================= */
document.addEventListener("mouseup", () => {
    isLunchDragging = false;
    lunchDragValue = "";

    setTimeout(() => {
        lunchDragMoved = false;

        document.querySelectorAll(".lunch-cell").forEach(cell => {
            cell.classList.remove("drag-copy-target");
        });
    }, 80);
});
async function renderLunchSchedule() {
    const table = document.getElementById("monthlyLunchTable");

    if (!table) return;

    await loadLunchNames();

    const year = lunchCurrentYear;
    const month = lunchCurrentMonth + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const saved = await loadLunchData();

    const weekNames = ["일", "월", "화", "수", "목", "금", "토"];

    let html = `
        <thead>
            <tr>
                <th rowspan="2" class="group-head">부서</th>
                <th rowspan="2" class="name-head">직원</th>
    `;

    for (let day = 1; day <= lastDay; day++) {
        const week = new Date(year, month - 1, day).getDay();
        const cls = week === 0 ? "sun" : week === 6 ? "sat" : "";

        html += `
            <th class="${cls}">
                ${weekNames[week]}
            </th>
        `;
    }

    html += `
            </tr>
            <tr>
    `;

    for (let day = 1; day <= lastDay; day++) {
        const week = new Date(year, month - 1, day).getDay();
        const cls = week === 0 ? "sun" : week === 6 ? "sat" : "";

        html += `
            <th class="day-head ${cls}">
                ${day}
            </th>
        `;
    }

    html += `
            </tr>
        </thead>
        <tbody>
    `;

    lunchGroups.forEach((group, groupIndex) => {
        group.members.forEach((name, memberIndex) => {
            html += `
                <tr>
            `;

            if (memberIndex === 0) {
                html += `
                    <td class="group-cell" rowspan="${group.members.length}">
                        ${group.title}
                    </td>
                `;
            }

            html += `
                <td class="name-cell">
                    <input
                        class="lunch-name-input"
                        value="${name}"
                        data-group-index="${groupIndex}"
                        data-member-index="${memberIndex}"
                    >
                </td>
            `;

            for (let day = 1; day <= lastDay; day++) {
                const key = getLunchKey(groupIndex, memberIndex, day);
                const value = saved[key] || "";
                const cls = getLunchClass(value);
                const week = new Date(year, month - 1, day).getDay();
                const dayClass = week === 0 ? "sun-bg" : week === 6 ? "sat-bg" : "";

                html += `
                    <td
                        class="lunch-cell ${dayClass} ${cls}"
                        data-key="${key}"
                        data-value="${value}"
                    >
                        ${value ? `<span class="lunch-badge ${cls}">${value}</span>` : ""}
                    </td>
                `;
            }

            html += `
                </tr>
            `;
        });

        html += `
            <tr class="group-divider">
                <td colspan="${lastDay + 2}"></td>
            </tr>
        `;
    });

    html += `
        </tbody>
    `;

    table.innerHTML = html;

    document.querySelectorAll(".lunch-cell").forEach(cell => {
    cell.tabIndex = 0;

    cell.addEventListener("mousedown", e => {
        e.preventDefault();

        isLunchDragging = true;
        lunchDragMoved = false;
        lunchDragValue = cell.dataset.value || "";

        document.querySelectorAll(".lunch-cell").forEach(item => {
            item.classList.remove("selected-cell");
            item.classList.remove("drag-copy-target");
        });

        activeLunchCell = cell;
        cell.classList.add("selected-cell");
        cell.classList.add("drag-copy-target");
        cell.focus();
    });

    cell.addEventListener("mouseenter", async () => {
    if (!isLunchDragging) return;

    lunchDragMoved = true;

    document.querySelectorAll(".lunch-cell").forEach(item => {
        item.classList.remove("selected-cell");
    });

    activeLunchCell = cell;
    cell.classList.add("selected-cell");
    cell.classList.add("drag-copy-target");

    await applyLunchCellValue(cell, lunchDragValue);
});

    cell.addEventListener("click", async e => {
        if (lunchDragMoved) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        document.querySelectorAll(".lunch-cell").forEach(item => {
            item.classList.remove("selected-cell");
        });

        activeLunchCell = cell;
        cell.classList.add("selected-cell");
        cell.focus();

        await changeLunchCell(cell);
    });

    cell.addEventListener("focus", () => {
        document.querySelectorAll(".lunch-cell").forEach(item => {
            item.classList.remove("selected-cell");
        });

        activeLunchCell = cell;
        cell.classList.add("selected-cell");
    });
});

    document.querySelectorAll(".lunch-name-input").forEach(input => {
        input.addEventListener("input", () => {
            const groupIndex = Number(input.dataset.groupIndex);
            const memberIndex = Number(input.dataset.memberIndex);

            lunchGroups[groupIndex].members[memberIndex] = input.value;

            clearTimeout(input.saveTimer);

            input.saveTimer = setTimeout(async () => {
                await saveLunchNames();
            }, 400);
        });
    });
}

window.renderLunchSchedule = renderLunchSchedule;

/* =========================
   시작
========================= */

renderLunchSchedule();
document.addEventListener("keydown", async e => {
    if (e.key === "Escape" && activeLunchCell) {
        await setLunchCellValue(activeLunchCell, "");
        activeLunchCell.classList.add("selected-cell");
        activeLunchCell.focus();
    }
});