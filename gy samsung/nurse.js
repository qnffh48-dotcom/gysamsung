import { db, doc, getDoc, setDoc } from "./firebase.js";

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

    const table =
        document.getElementById("nurseClosingTable");

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

    table.querySelectorAll("input")
        .forEach(input => {
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

    const inputs =
        document.querySelectorAll(
            "#nurseClosingTable input"
        );

    inputs.forEach(input => {

        const room =
            input.dataset.room;

        const field =
            input.dataset.field;

        if (!nurseData[room]) {
            nurseData[room] = {};
        }

        nurseData[room][field] =
            Number(input.value || 0);

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

    date.setDate(
        date.getDate() + diff
    );

    currentYear =
        date.getFullYear();

    currentMonth =
        date.getMonth() + 1;

    currentDay =
        date.getDate();

    yearSelect.value =
        currentYear;

    monthSelect.value =
        currentMonth;

    updateDays();

    daySelect.value =
        currentDay;

    loadNurseData();
}

prevDateBtn.addEventListener(
    "click",
    () => {
        changeDate(-1);
    }
);

nextDateBtn.addEventListener(
    "click",
    () => {
        changeDate(1);
    }
);

yearSelect.addEventListener(
    "change",
    () => {

        currentDay =
            Number(daySelect.value);

        updateDays();

        loadNurseData();
    }
);

monthSelect.addEventListener(
    "change",
    () => {

        currentDay =
            Number(daySelect.value);

        updateDays();

        loadNurseData();
    }
);

daySelect.addEventListener(
    "change",
    () => {

        currentDay =
            Number(daySelect.value);

        loadNurseData();
    }
);

/* =========================
   시작
========================= */

loadNurseData();