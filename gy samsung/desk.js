const roomFields = [
    "급여",
    "비급여",
    "조합청구액",
    "100/100미만 총액",
    "장애인기금/전액본인",
    "현금",
    "카드",
];

let deskData = {};
let deskExtraData = {
    reservation: {},
    injectionReserve: {},
    expense: {},
    income: {},
    memo: ""
};

/* =========================
   날짜
========================= */

const yearSelect = document.getElementById("deskYear");
const monthSelect = document.getElementById("deskMonth");
const daySelect = document.getElementById("deskDay");

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

function loadDeskStorage() {

    deskData =
        JSON.parse(
            localStorage.getItem(
                "deskData-" + getDateKey()
            )
        ) || {};

    deskExtraData =
        JSON.parse(
            localStorage.getItem(
                "deskExtraData-" + getDateKey()
            )
        ) || {
            reservation: {},
            injectionReserve: {},
            expense: {},
            income: {},
            memo: ""
        };
}

function saveDeskData(roomNum, field, value) {
    if (!deskData[`room${roomNum}`]) {
        deskData[`room${roomNum}`] = {};
    }

    deskData[`room${roomNum}`][field] = Number(value) || 0;

    localStorage.setItem(
        "deskData-" + getDateKey(),
        JSON.stringify(deskData)
    );

    
}

function saveDeskExtra() {
    localStorage.setItem(
        "deskExtraData-" + getDateKey(),
        JSON.stringify(deskExtraData)
    );

    localStorage.setItem(
        "deskExtraData",
        JSON.stringify(deskExtraData)
    );
}

/* =========================
   진료실 입력 생성
========================= */

function renderRooms() {
    for (let i = 1; i <= 5; i++) {
        if (!deskData[`room${i}`]) {
            deskData[`room${i}`] = {};
        }

        const page = document.getElementById(`room${i}`);
        if (!page) continue;

        page.innerHTML = `
            <h3>ㆍ${i} 진료 수납 정보 입력</h3>

            ${roomFields.map(field => `
                <div class="input-row">
                    <label>${field}</label>
                    <input
                        type="number"
                        value="${deskData[`room${i}`][field] ?? 0}"
                        oninput="saveDeskData(${i}, '${field}', this.value)"
                    >
                </div>
            `).join("")}
        `;
    }
}

/* =========================
   추가 입력
========================= */

function setupExtraInputs() {
    setupReservation();
    setupInjectionReserve();
    setupExpense();
    setupIncome();
    setupMemo();
}

function setupReservation() {
    const rows = document.querySelectorAll(".desk-section:nth-of-type(2) tbody tr");

    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const name = cells[0]?.textContent.trim();
        const inputs = row.querySelectorAll("input");

        if (!name) return;

        if (!deskExtraData.reservation[name]) {
            deskExtraData.reservation[name] = {};
        }

        if (name === "실예약환자수") {
            inputs[0].value =
                deskExtraData.reservation[name]["값"] ?? 0;

            inputs[0].oninput = function () {
                deskExtraData.reservation[name]["값"] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };

            return;
        }

        const cols = ["예약", "변경", "취소"];

        inputs.forEach((input, index) => {
            const col = cols[index];

            input.type = "number";
            input.value =
                deskExtraData.reservation[name][col] ?? 0;

            input.oninput = function () {
                deskExtraData.reservation[name][col] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };
        });
    });
}

function setupInjectionReserve() {
    const rows = document.querySelectorAll(".desk-section:nth-of-type(3) tbody tr");
    const cols = ["초진 X block", "재진 X block"];

    rows.forEach(row => {
        const name = row.querySelector("td")?.textContent.trim();
        const inputs = row.querySelectorAll("input");

        if (!name) return;

        if (!deskExtraData.injectionReserve[name]) {
            deskExtraData.injectionReserve[name] = {};
        }

        inputs.forEach((input, index) => {
            const col = cols[index];

            input.type = "number";
            input.value =
                deskExtraData.injectionReserve[name][col] ?? 0;

            input.oninput = function () {
                deskExtraData.injectionReserve[name][col] =
                    Number(this.value) || 0;

                saveDeskExtra();
            };
        });
    });
}

function setupExpense() {
    const box = document.querySelector(
        ".desk-section.two-column > div:nth-child(1)"
    );

    if (!box) return;

    box.querySelectorAll(".input-row").forEach(row => {
        const label = row.querySelector("label")?.textContent.trim();
        const input = row.querySelector("input");

        if (!label || !input) return;

        input.type = "number";
        input.value = deskExtraData.expense[label] ?? 0;

        input.oninput = function () {
            deskExtraData.expense[label] =
                Number(this.value) || 0;

            saveDeskExtra();
        };
    });
}

function setupIncome() {
    const box = document.querySelector(
        ".desk-section.two-column > div:nth-child(2)"
    );

    if (!box) return;

    box.querySelectorAll(".input-row").forEach(row => {
        const label = row.querySelector("label")?.textContent.trim();
        const input = row.querySelector("input");

        if (!label || !input) return;

        input.type = "number";
        input.value = deskExtraData.income[label] ?? 0;

        input.oninput = function () {
            deskExtraData.income[label] =
                Number(this.value) || 0;

            saveDeskExtra();
        };
    });
}

function setupMemo() {
    const memo = document.querySelector(".memo-box");
    if (!memo) return;

    memo.value = deskExtraData.memo || "";

    memo.oninput = function () {
        deskExtraData.memo = this.value;

        saveDeskExtra();
    };
}

/* =========================
   날짜 변경 시 전체 갱신
========================= */

function reloadDeskPage() {
    loadDeskStorage();
    renderRooms();
    setupExtraInputs();
}

yearSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadDeskPage();
});

monthSelect.addEventListener("change", () => {
    currentDay = 1;
    updateDays();
    reloadDeskPage();
});

daySelect.addEventListener("change", reloadDeskPage);

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

    reloadDeskPage();
}

document
    .getElementById("prevDay")
    .addEventListener("click", () => changeDate(-1));

document
    .getElementById("nextDay")
    .addEventListener("click", () => changeDate(1));

/* =========================
   탭
========================= */

function openRoom(event, roomId) {
    document.querySelectorAll(".room-tab").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".room-page").forEach(page => {
        page.classList.remove("active");
    });

    event.currentTarget.classList.add("active");

    document.getElementById(roomId).classList.add("active");
}

document.querySelectorAll(".desk-top-tab").forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.tab;

        document.querySelectorAll(".desk-top-tab").forEach(btn => {
            btn.classList.remove("active");
        });

        document.querySelectorAll(".desk-top-page").forEach(page => {
            page.classList.remove("active");
        });

        button.classList.add("active");

        document.getElementById(target)?.classList.add("active");
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

reloadDeskPage();