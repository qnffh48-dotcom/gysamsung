import { db, doc, getDoc, setDoc } from "./firebase.js";

const therapyItems = [
    "도수",
    "충격파",
    "신장분사",
    "페인 스크램블러",
    "리푸스"
];

const therapyCols = ["신환", "재진", "매출", "상담", "예약"];

const ptItems = [
    "도수",
    "충격파",
    "비급여치료1",
    "비급여치료2"
];

const ptCols = ["건수", "매출"];

let therapyData = {};
let ptData = {};
let deskExtraData = { reservation: {} };

const yearSelect = document.getElementById("therapyYear");
const monthSelect = document.getElementById("therapyMonth");
const daySelect = document.getElementById("therapyDay");

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

async function loadTherapyData() {
    const snap = await getDoc(doc(db, "closings", getDateKey()));
    const data = snap.exists() ? snap.data() : {};

    therapyData = data.therapyData || {};
    ptData = data.ptData || {};
    deskExtraData = data.deskExtraData || { reservation: {} };

    if (!deskExtraData.reservation) {
        deskExtraData.reservation = {};
    }
}

async function saveTherapyData(roomNum, item, col, value) {
    if (!therapyData[`room${roomNum}`]) {
        therapyData[`room${roomNum}`] = {};
    }

    if (!therapyData[`room${roomNum}`][item]) {
        therapyData[`room${roomNum}`][item] = {};
    }

    therapyData[`room${roomNum}`][item][col] = Number(value) || 0;

    await setDoc(
        doc(db, "closings", getDateKey()),
        { therapyData },
        { merge: true }
    );
}

async function saveReservationInput(row, col, value) {
    if (!deskExtraData.reservation[row]) {
        deskExtraData.reservation[row] = {};
    }

    deskExtraData.reservation[row][col] = Number(value) || 0;

    await setDoc(
        doc(db, "closings", getDateKey()),
        {
            deskExtraData: {
                ...deskExtraData,
                reservation: deskExtraData.reservation
            }
        },
        { merge: true }
    );
}

async function savePtInput(ptNum, item, col, value) {
    const ptKey = `pt${ptNum}`;

    if (!ptData[ptKey]) {
        ptData[ptKey] = {};
    }

    if (!ptData[ptKey][item]) {
        ptData[ptKey][item] = {};
    }

    ptData[ptKey][item][col] = Number(value) || 0;

    await setDoc(
        doc(db, "closings", getDateKey()),
        { ptData },
        { merge: true }
    );
}

function renderTherapyRooms() {
    for (let i = 1; i <= 5; i++) {
        if (!therapyData[`room${i}`]) {
            therapyData[`room${i}`] = {};
        }

        const page = document.getElementById(`therapyRoom${i}`);
        if (!page) continue;

        page.innerHTML = `
            <h3>
                <span class="big-dot"></span>
                진료실 비급여 건수 / 매출 / 상담 정보 입력
            </h3>

            <table class="therapy-table">
                <thead>
                    <tr>
                        <th>구분</th>
                        ${therapyCols.map(col => `<th>${col}</th>`).join("")}
                    </tr>
                </thead>

                <tbody>
                    ${therapyItems.map(item => {
                        if (!therapyData[`room${i}`][item]) {
                            therapyData[`room${i}`][item] = {};
                        }

                        return `
                            <tr>
                                <td>${item}</td>
                                ${therapyCols.map(col => `
                                    <td>
                                        <input
                                            type="number"
                                            value="${therapyData[`room${i}`][item][col] || 0}"
                                            oninput="saveTherapyData(${i}, '${item}', '${col}', this.value)"
                                        >
                                    </td>
                                `).join("")}
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }
}

function renderPtPages() {
    for (let pt = 1; pt <= 5; pt++) {
        const page = document.getElementById(`therapy-temp${pt}`);
        if (!page) continue;

        const ptKey = `pt${pt}`;
        if (!ptData[ptKey]) {
            ptData[ptKey] = {};
        }

        page.innerHTML = `
            <div class="therapy-card">
                <h3>
                    <span class="big-dot"></span>
                    PT${pt} 비급여 치료 관리
                </h3>

                <table class="therapy-table">
                    <thead>
                        <tr>
                            <th>항목</th>
                            <th>건수</th>
                            <th>매출</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ptItems.map(item => {
                            if (!ptData[ptKey][item]) {
                                ptData[ptKey][item] = {};
                            }

                            return `
                                <tr>
                                    <td>${item}</td>

                                    ${ptCols.map(col => `
                                        <td>
                                            <input
                                                type="number"
                                                value="${ptData[ptKey][item][col] || 0}"
                                                oninput="savePtInput(${pt}, '${item}', '${col}', this.value)"
                                            >
                                        </td>
                                    `).join("")}
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }
}

async function loadReservationInputs() {
    const reservation = deskExtraData.reservation || {};

    document.getElementById("therapyReserve").value =
        reservation["도수"]?.["예약"] || 0;

    document.getElementById("therapyChange").value =
        reservation["도수"]?.["변경"] || 0;

    document.getElementById("therapyCancel").value =
        reservation["도수"]?.["취소"] || 0;

    document.getElementById("shockReserve").value =
        reservation["충격파"]?.["예약"] || 0;

    document.getElementById("shockChange").value =
        reservation["충격파"]?.["변경"] || 0;

    document.getElementById("shockCancel").value =
        reservation["충격파"]?.["취소"] || 0;
}

async function reloadTherapyPage() {
    await loadTherapyData();
    renderTherapyRooms();
    renderPtPages();
    await loadReservationInputs();
}

yearSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadTherapyPage();
});

monthSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadTherapyPage();
});

daySelect.addEventListener("change", reloadTherapyPage);

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

    reloadTherapyPage();
}

document.getElementById("prevDay").addEventListener("click", () => {
    changeDate(-1);
});

document.getElementById("nextDay").addEventListener("click", () => {
    changeDate(1);
});

function openTherapyRoom(event, roomId) {
    document.querySelectorAll(".therapy-tab").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".therapy-page").forEach(page => {
        page.classList.remove("active");
    });

    event.currentTarget.classList.add("active");
    document.getElementById(roomId).classList.add("active");
}

const therapyTopTabs = document.querySelectorAll(".therapy-top-tab");
const therapyTopPages = document.querySelectorAll(".therapy-top-page");

therapyTopTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        therapyTopTabs.forEach(t => t.classList.remove("active"));
        therapyTopPages.forEach(page => page.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
    });
});

const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${window.scrollY}px)`;
        });
    });
}

window.openTherapyRoom = openTherapyRoom;
window.saveTherapyData = saveTherapyData;
window.saveReservationInput = saveReservationInput;
window.savePtInput = savePtInput;

reloadTherapyPage();