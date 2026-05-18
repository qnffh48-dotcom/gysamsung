const therapyItems = [
    "도수",
    "충격파",
    "신장분사",
    "페인 스크램블러",
    "수액",
    "근전도(신경전도)",
    "리푸스"
];

const therapyCols = ["신환", "재진", "매출", "상담", "예약"];

let therapyData = {};

/* =========================
   날짜
========================= */

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

/* =========================
   저장 / 불러오기
========================= */

function loadTherapyData() {
    therapyData =
        JSON.parse(
            localStorage.getItem(
                "therapyData-" + getDateKey()
            )
        ) || {};
}

function saveTherapyData(roomNum, item, col, value) {
    if (!therapyData[`room${roomNum}`]) {
        therapyData[`room${roomNum}`] = {};
    }

    if (!therapyData[`room${roomNum}`][item]) {
        therapyData[`room${roomNum}`][item] = {};
    }

    therapyData[`room${roomNum}`][item][col] =
        Number(value) || 0;

    localStorage.setItem(
        "therapyData-" + getDateKey(),
        JSON.stringify(therapyData)
    );
}

/* =========================
   진료실 표 생성
========================= */

function renderTherapyRooms() {
    for (let i = 1; i <= 5; i++) {
        if (!therapyData[`room${i}`]) {
            therapyData[`room${i}`] = {};
        }

        const page =
            document.getElementById(`therapyRoom${i}`);

        if (!page) continue;

        page.innerHTML = `
            <h3><span class="big-dot"></span>진료실 비급여 건수 / 매출 / 상담 정보 입력</h3>

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

/* =========================
   날짜 변경
========================= */

function reloadTherapyPage() {
    loadTherapyData();
    renderTherapyRooms();
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

document
    .getElementById("prevDay")
    .addEventListener("click", () => changeDate(-1));

document
    .getElementById("nextDay")
    .addEventListener("click", () => changeDate(1));

/* =========================
   진료실 탭
========================= */

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

/* =========================
   상단 탭
========================= */

const therapyTopTabs =
    document.querySelectorAll(".therapy-top-tab");

const therapyTopPages =
    document.querySelectorAll(".therapy-top-page");

therapyTopTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        therapyTopTabs.forEach(t =>
            t.classList.remove("active")
        );

        therapyTopPages.forEach(page =>
            page.classList.remove("active")
        );

        tab.classList.add("active");

        document
            .getElementById(tab.dataset.tab)
            .classList.add("active");
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

/* =========================
   최초 실행
========================= */

reloadTherapyPage();