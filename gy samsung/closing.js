let deskData = {};
let therapyData = {};
let deskExtraData = {};
const closingYear = document.getElementById("closingYear");
const closingMonth = document.getElementById("closingMonth");
const closingDay = document.getElementById("closingDay");

const today = new Date();

let currentYear = today.getFullYear();
let currentMonth = today.getMonth() + 1;
let currentDay = today.getDate();

for (let y = 2024; y <= 2035; y++) {
    closingYear.innerHTML += `<option value="${y}">${y}년</option>`;
}

for (let m = 1; m <= 12; m++) {
    closingMonth.innerHTML += `<option value="${m}">${m}월</option>`;
}

function updateClosingDays() {
    const lastDay = new Date(
        Number(closingYear.value),
        Number(closingMonth.value),
        0
    ).getDate();

    closingDay.innerHTML = "";

    for (let d = 1; d <= lastDay; d++) {
        closingDay.innerHTML += `<option value="${d}">${d}일</option>`;
    }

    closingDay.value = currentDay;
}

closingYear.value = currentYear;
closingMonth.value = currentMonth;

updateClosingDays();

closingDay.value = currentDay;

const deskFields = [
    "급여",
    "비급여",
    "조합청구액",
    "100/100미만 총액",
    "장애인기금/전액본인",
    "현금",
    "카드",
    "미수 발생건",
    "미수 발생금",
    "미수 입금건",
    "미수 입금"
];

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

function money(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function count(value, unit = "") {
    return Number(value || 0).toLocaleString("ko-KR") + unit;
}

function makeTabs(targetId, type) {
    const box = document.getElementById(targetId);

    box.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
        box.innerHTML += `
            <button 
                class="closing-tab ${i === 1 ? "active" : ""}"
                onclick="openClosingTab(event, '${type}', ${i})"
            >
                ${i} 진료
            </button>
        `;
    }
}

function openClosingTab(event, type, roomNum) {
    event.currentTarget.parentElement.querySelectorAll(".closing-tab").forEach(btn => {
        btn.classList.remove("active");
    });

    event.currentTarget.classList.add("active");

    if (type === "desk") {
        renderDeskRoom(roomNum);
    }

    if (type === "therapy") {
        renderTherapyRoom(roomNum);
    }
}

function renderDeskRoom(roomNum) {
    const target = document.getElementById("deskClosingContent");
    const room = deskData[`room${roomNum}`] || {};

    target.innerHTML = `
        <h3>ㆍ${roomNum} 진료 수납 내역</h3>

        <table class="closing-table">
            <thead>
                <tr>
                    <th>급여</th>
                    <th>비급여</th>
                    <th>조합청구액</th>
                    <th>100/100미만 총액</th>
                    <th>장애인기금/전액본인</th>
                </tr>
            </thead>

            <tbody>
                <tr>
                    <td>${money(room["급여"])}</td>
                    <td>${money(room["비급여"])}</td>
                    <td>${money(room["조합청구액"])}</td>
                    <td>${money(room["100/100미만 총액"])}</td>
                    <td>${money(room["장애인기금/전액본인"])}</td>
                </tr>

                <tr>
                    <th>현금</th>
                    <th>카드</th>
                    <th>미수 발생건</th>
                    <th>미수 발생금</th>
                    <th>미수 입금</th>
                </tr>

                <tr>
                    <td>${money(room["현금"])}</td>
                    <td>${money(room["카드"])}</td>
                    <td>${count(room["미수 발생건"], "건")}</td>
                    <td>${money(room["미수 발생금"])}</td>
                    <td>${money(room["미수 입금"])}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function renderTherapyRoom(roomNum) {
    const target = document.getElementById("therapyClosingContent");
    const room = therapyData[`room${roomNum}`] || {};

    const totals = {
        신환: 0,
        재진: 0,
        매출: 0,
        상담: 0,
        예약: 0
    };

    target.innerHTML = `
        <h3>ㆍ${roomNum} 진료실 비급여 건수 · 매출 · 상담</h3>

        <table class="closing-table">
            <thead>
                <tr>
                    <th>구분</th>
                    <th>초진</th>
                    <th>재진</th>
                    <th>매출</th>
                    <th>상담</th>
                    <th>예약</th>
                </tr>
            </thead>

            <tbody>
                ${therapyItems.map(item => {
                    const row = room[item] || {};

                    therapyCols.forEach(col => {
                        totals[col] += Number(row[col] || 0);
                    });

                    return `
                        <tr>
                            <td>${item}</td>
                            <td>${count(row["신환"])}</td>
                            <td>${count(row["재진"])}</td>
                            <td>${money(row["매출"])}</td>
                            <td>${count(row["상담"])}</td>
                            <td>${count(row["예약"])}</td>
                        </tr>
                    `;
                }).join("")}

                <tr class="total-row">
                    <td>합계</td>
                    <td>${count(totals["신환"], "명")}</td>
                    <td>${count(totals["재진"], "명")}</td>
                    <td>${money(totals["매출"])}</td>
                    <td>${count(totals["상담"], "명")}</td>
                    <td>${count(totals["예약"], "명")}</td>
                </tr>
            </tbody>
        </table>
    `;
}

makeTabs("deskClosingTabs", "desk");
makeTabs("therapyClosingTabs", "therapy");

renderDeskRoom(1);
renderTherapyRoom(1);

function getDateKey() {
    return `${closingYear.value}-${closingMonth.value}-${closingDay.value}`;
}

function reloadClosingData() {

    const key = getDateKey();

    deskData =
        JSON.parse(localStorage.getItem("deskData-" + key)) || {};

    therapyData =
        JSON.parse(localStorage.getItem("therapyData-" + key)) || {};

    deskExtraData =
        JSON.parse(localStorage.getItem("deskExtraData-" + key)) || {
            reservation: {},
            injectionReserve: {},
            expense: {},
            income: {},
            memo: ""
        };

    renderDeskRoom(1);
    renderTherapyRoom(1);

    renderReservationClosing();
    renderInjectionReserveClosing();
    renderExpenseClosing();
    renderIncomeClosing();
    renderMemoClosing();

    renderRadiologyClosing();
}
renderReservationClosing();
renderInjectionReserveClosing();
renderExpenseClosing();
renderIncomeClosing();
renderMemoClosing();

function renderReservationClosing() {
    const table = document.getElementById("reservationClosingTable");
    if (!table) return;

    const rows = ["주사", "경과", "도수", "충격파"];
    const cols = ["예약", "변경", "취소", "내원", "내원율"];

    table.innerHTML = `
        <thead>
            <tr>
                <th>구분</th>
                ${cols.map(col => `<th>${col}</th>`).join("")}
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${row}</td>
                    ${cols.map(col => `
                        <td>${deskExtraData.reservation?.[row]?.[col] || "0"}</td>
                    `).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderInjectionReserveClosing() {
    const table = document.getElementById("injectionReserveClosingTable");
    if (!table) return;

    const rows = ["X", "주사경과만", "주사만", "주사경과+주사", "이외예약O", "권장"];
    const cols = ["초진 X block", "재진 X block"];

    table.innerHTML = `
        <thead>
            <tr>
                <th>구분</th>
                ${cols.map(col => `<th>${col}</th>`).join("")}
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${row}</td>
                    ${cols.map(col => `
                        <td>${deskExtraData.injectionReserve?.[row]?.[col] || "0"}</td>
                    `).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderExpenseClosing() {
    const table = document.getElementById("expenseClosingTable");
    if (!table) return;

    const rows = ["현금", "카드", "FREE"];

    table.innerHTML = `
        <thead>
            <tr>
                <th>구분</th>
                <th>금액</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${row}</td>
                    <td>${money(deskExtraData.expense?.[row] || 0)}</td>
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderIncomeClosing() {
    const table = document.getElementById("incomeClosingTable");
    if (!table) return;

    const rows = ["현금", "카드", "계좌"];

    table.innerHTML = `
        <thead>
            <tr>
                <th>구분</th>
                <th>금액</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${row}</td>
                    <td>${money(deskExtraData.income?.[row] || 0)}</td>
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderMemoClosing() {
    const memo = document.getElementById("memoClosingBox");
    if (!memo) return;

    memo.textContent = deskExtraData.memo || "";
    
}renderRadiologyClosing();

function renderRadiologyClosing() {

    const table = document.getElementById("radiologyClosingTable");
    const dateView = document.getElementById("radiologyDateView");

    if (!table || !dateView) return;

    const y = closingYear.value;
const m = closingMonth.value;
const d = closingDay.value;

const key = `radiology-${y}-${m}-${d}`;

const data = JSON.parse(localStorage.getItem(key)) || {};

dateView.textContent =
    `${y}년 ${m}월 ${d}일`;

    const total =
        Number(data.carm_os1 || 0) +
        Number(data.carm_neuro || 0) +
        Number(data.carm_os3 || 0) +
        Number(data.carm_os4 || 0) +
        Number(data.carm_os5 || 0);

    const arthrogram =
        Number(data.arthrogram || 0);

    table.innerHTML = `
        <thead>

            <tr>
                <th colspan="3">
                    주사 현황
                </th>
            </tr>

            <tr>
                <th>C-ARM</th>
                <th>관절조영</th>
                <th>합계</th>
            </tr>

        </thead>

        <tbody>

            <tr>
                <td>${total}건</td>
                <td>${arthrogram}건</td>
                <td>${total + arthrogram}건</td>
            </tr>

        </tbody>
    `;
}const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}function changeClosingDate(diff) {

    const date = new Date(
        Number(closingYear.value),
        Number(closingMonth.value) - 1,
        Number(closingDay.value)
    );

    date.setDate(date.getDate() + diff);

    closingYear.value = date.getFullYear();
    closingMonth.value = date.getMonth() + 1;

    currentDay = date.getDate();

    updateClosingDays();

    closingDay.value = currentDay;

    reloadClosingData();
}

document
    .getElementById("prevDay")
    .addEventListener("click", () => {
        changeClosingDate(-1);
    });

document
    .getElementById("nextDay")
    .addEventListener("click", () => {
        changeClosingDate(1);
    });function startClosingPage() {
    reloadClosingData();
}

window.addEventListener("load", startClosingPage);

closingYear.onchange = function () {
    currentDay = Number(closingDay.value);
    updateClosingDays();
    closingDay.value = currentDay;
    reloadClosingData();
};

closingMonth.onchange = function () {
    currentDay = Number(closingDay.value);
    updateClosingDays();
    closingDay.value = currentDay;
    reloadClosingData();
};

closingDay.onchange = function () {
    currentDay = Number(closingDay.value);
    reloadClosingData();
};