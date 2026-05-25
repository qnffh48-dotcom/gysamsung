import { db, doc, getDoc } from "./firebase.js";
let deskData = {};
let therapyData = {};
let deskExtraData = {};
let closingTimeChart = null;
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
    if (!box) return;

    box.innerHTML = `
        <button 
            class="closing-tab active"
            onclick="openClosingTab(event, '${type}', 'all')"
        >
            전체
        </button>
    `;

    for (let i = 1; i <= 5; i++) {
        box.innerHTML += `
            <button 
                class="closing-tab"
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
window.openClosingTab = openClosingTab;
function renderDeskRoom(roomNum) {
    const target = document.getElementById("deskClosingContent");
    const room = deskData[`room${roomNum}`] || {};

    target.innerHTML = `
       

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

    let roomData = {};

    if (roomNum === "all") {

        therapyItems.forEach(item => {

            roomData[item] = {
                신환: 0,
                재진: 0,
                매출: 0,
                상담: 0,
                예약: 0
            };

            for (let i = 1; i <= 5; i++) {

                const room = therapyData[`room${i}`] || {};
                const row = room[item] || {};

                therapyCols.forEach(col => {
                    roomData[item][col] += Number(row[col] || 0);
                });
            }
        });

    } else {
        roomData = therapyData[`room${roomNum}`] || {};
    }

    const totals = {
        신환: 0,
        재진: 0,
        매출: 0,
        상담: 0,
        예약: 0
    };

    target.innerHTML = `
        <h3>
            ㆍ${roomNum === "all" ? "전체 진료실" : `${roomNum} 진료실`}
            비급여 건수 · 매출 · 상담
        </h3>

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

                    const row = roomData[item] || {};

                    if (item === "수액") {

                        const nurseData = window.nurseClosingData || {};

                        if (roomNum === "all") {

                            row["신환"] =
                                Number(nurseData.room1?.fluidNew || 0) +
                                Number(nurseData.room2?.fluidNew || 0) +
                                Number(nurseData.room3?.fluidNew || 0) +
                                Number(nurseData.room4?.fluidNew || 0) +
                                Number(nurseData.room5?.fluidNew || 0);

                            row["재진"] =
                                Number(nurseData.room1?.fluidRevisit || 0) +
                                Number(nurseData.room2?.fluidRevisit || 0) +
                                Number(nurseData.room3?.fluidRevisit || 0) +
                                Number(nurseData.room4?.fluidRevisit || 0) +
                                Number(nurseData.room5?.fluidRevisit || 0);

                        } else {

                            row["신환"] =
                                Number(nurseData[`room${roomNum}`]?.fluidNew || 0);

                            row["재진"] =
                                Number(nurseData[`room${roomNum}`]?.fluidRevisit || 0);
                        }
                    }

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


makeTabs("therapyClosingTabs", "therapy");

renderDeskRoom(1);
renderTherapyRoom("all");

function getDateKey() {
    return `${closingYear.value}-${closingMonth.value}-${closingDay.value}`;
}

async function reloadClosingData() {
    const key = getDateKey();

    const snap = await getDoc(doc(db, "closings", key));

    const data = snap.exists() ? snap.data() : {};

    deskData = data.deskData || {};
    therapyData = data.therapyData || {};
    deskExtraData = data.deskExtraData || {
        reservation: {},
        injectionReserve: {},
        expense: {},
        income: {},
        memo: ""
    };

    window.radiologyClosingData = data.radiologyData || {};
    window.nurseClosingData = data.nurseData || {};
    

    renderDeskRoom(1);
    renderTherapyRoom("all");

    renderReservationClosing();
    renderInjectionReserveClosing();
    renderExpenseClosing();
    renderIncomeClosing();
    renderMemoClosing();

    renderRadiologyClosing();
    renderTimeChartClosing();
    renderClosingRouteSales();
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
                    ${cols.map(col => {

    const reserve =
        Number(deskExtraData.reservation?.[row]?.["예약"] || 0);

    const cancel =
        Number(deskExtraData.reservation?.[row]?.["취소"] || 0);

    const visit = reserve - cancel;

    const visitRate =
        reserve
            ? ((visit / reserve) * 100).toFixed(1) + "%"
            : "0%";

    let value =
        deskExtraData.reservation?.[row]?.[col] || "0";

    if (col === "내원") {
        value = visit;
    }

    if (col === "내원율") {
        value = visitRate;
    }

    return `<td>${value}</td>`;

}).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderInjectionReserveClosing() {

    const table = document.getElementById("injectionReserveClosingTable");
    if (!table) return;

    const data = deskExtraData.injectionReserve || {};

    function num(v) {
        return Number(v || 0);
    }

    function percent(v) {
        return `${v.toFixed(1)}%`;
    }

    // 초진
    const newX = num(data["X"]?.["초진 X block"]);
    const newFollow = num(data["주사경과만"]?.["초진 X block"]);
    const newInjection = num(data["주사만"]?.["초진 X block"]);
    const newBoth = num(data["주사경과+주사"]?.["초진 X block"]);
    const newEtc = num(data["이외예약O"]?.["초진 X block"]);

    const newTotal =
        newX +
        newFollow +
        newInjection +
        newBoth +
        newEtc;

    // 재진
    const revisitX = num(data["X"]?.["재진 X block"]);
    const revisitFollow = num(data["주사경과만"]?.["재진 X block"]);
    const revisitInjection = num(data["주사만"]?.["재진 X block"]);
    const revisitBoth = num(data["주사경과+주사"]?.["재진 X block"]);
    const revisitEtc = num(data["이외예약O"]?.["재진 X block"]);

    const revisitTotal =
        revisitX +
        revisitFollow +
        revisitInjection +
        revisitBoth +
        revisitEtc;

    // 퍼센트 계산
const newFollowRate =
    newTotal
        ? ((newBoth + newFollow) / newTotal) * 100
        : 0;

const newInjectionRate =
    newTotal
        ? ((newBoth + newInjection) / newTotal) * 100
        : 0;

const revisitFollowRate =
    revisitTotal
        ? ((revisitBoth + revisitFollow) / revisitTotal) * 100
        : 0;

const revisitInjectionRate =
    revisitTotal
        ? ((revisitBoth + revisitInjection) / revisitTotal) * 100
        : 0;

    table.innerHTML = `
        <thead>
            <tr>
                <th></th>
                <th>주사 경과</th>
                <th>주사</th>
            </tr>
        </thead>

        <tbody>

            <tr>
                <th style="color:#ff4d4f;">초진</th>
                <td style="color:#ff4d4f;">
                    ${percent(newFollowRate)}
                </td>
                <td style="color:#ff4d4f;">
                    ${percent(newInjectionRate)}
                </td>
            </tr>

            <tr>
                <th style="color:#2563eb;">재진</th>
                <td style="color:#2563eb;">
                    ${percent(revisitFollowRate)}
                </td>
                <td style="color:#2563eb;">
                    ${percent(revisitInjectionRate)}
                </td>
            </tr>

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
    
}

function renderRadiologyClosing() {

    const table = document.getElementById("radiologyClosingTable");
    const dateView = document.getElementById("radiologyDateView");

    if (!table || !dateView) return;

    const y = closingYear.value;
    const m = closingMonth.value;
    const d = closingDay.value;

    const radiologyData = window.radiologyClosingData || {};
    const nurseData = window.nurseClosingData || {};

    dateView.textContent = `${y}년 ${m}월 ${d}일`;

    const total =
        Number(radiologyData.carm_os1 || 0) +
        Number(radiologyData.carm_neuro || 0) +
        Number(radiologyData.carm_os3 || 0) +
        Number(radiologyData.carm_os4 || 0) +
        Number(radiologyData.carm_os5 || 0);

    const arthrogram =
        Number(radiologyData.arthrogram || 0);

    const ultrasound =
        Number(nurseData.room1?.ultrasound || 0) +
        Number(nurseData.room2?.ultrasound || 0) +
        Number(nurseData.room3?.ultrasound || 0) +
        Number(nurseData.room4?.ultrasound || 0) +
        Number(nurseData.room5?.ultrasound || 0);

    table.innerHTML = `
        <thead>
            <tr>
                <th colspan="4">주사 현황</th>
            </tr>
            <tr>
                <th>C-ARM</th>
                <th>관절조영</th>
                <th>초음파</th>
                <th>합계</th>
            </tr>
        </thead>

        <tbody>
            <tr>
                <td>${total}건</td>
                <td>${arthrogram}건</td>
                <td>${ultrasound}건</td>
                <td>${total + arthrogram + ultrasound}건</td>
            </tr>
        </tbody>
    `;
}

const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}

function changeClosingDate(diff) {

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
    });

function startClosingPage() {
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
};function renderTimeChartClosing() {
    const canvas = document.getElementById("closingTimeChart");
    if (!canvas) return;

    if (closingTimeChart) {
        closingTimeChart.destroy();
        closingTimeChart = null;
    }

    const chartData = deskExtraData.timeChart;

    if (!chartData) return;

    const ageGroups = [
        "0~19", "20~29", "30~39",
        "40~49", "50~59", "60~69",
        "70~79", "80~89", "90~100"
    ];

    const colors = [
        "#ef4444", "#f97316", "#eab308",
        "#22c55e", "#14b8a6", "#3b82f6",
        "#6366f1", "#a855f7", "#ec4899"
    ];

    closingTimeChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: [
                "오전(09~12)",
                "오후(12~17)",
                "저녁(17~19:30)"
            ],
            datasets: ageGroups.map((group, index) => ({
                label: group,
                data: [
                    chartData[group]?.오전 || 0,
                    chartData[group]?.오후 || 0,
                    chartData[group]?.저녁 || 0
                ],
                backgroundColor: colors[index]
            }))
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            }
        }
    });
}function renderClosingRouteSales() {
    const tbody = document.querySelector("#closingRouteSalesTable tbody");
    if (!tbody) return;

    const result = deskExtraData.routeSales;

    if (!result) {
        tbody.innerHTML = "";
        return;
    }

    const rows = Object.entries(result);

    const totalCount = rows.reduce((sum, [, row]) => sum + Number(row.count || 0), 0);
    const totalSales = rows.reduce((sum, [, row]) => sum + Number(row.sales || 0), 0);

    tbody.innerHTML = `
        ${rows.map(([route, row]) => `
            <tr>
                <td>${route}</td>
                <td>${Number(row.count || 0)}명</td>
                <td>${Number(row.sales || 0).toLocaleString("ko-KR")}원</td>
            </tr>
        `).join("")}

        <tr class="total-row">
            <td>합계</td>
            <td>${totalCount}명</td>
            <td>${totalSales.toLocaleString("ko-KR")}원</td>
        </tr>
    `;
}