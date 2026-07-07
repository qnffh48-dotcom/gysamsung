import { db, doc, getDoc, setDoc } from "./firebase.js";

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

function getDateKey() {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const d = selectedDate.getDate();

    return `${y}-${m}-${d}`;
}

async function saveRadiologyData() {
    const data = {};

    document.querySelectorAll(".report-input").forEach(input => {
        const key = input.dataset.key;
        if (!key) return;

        data[key] = input.value;
    });

    await setDoc(
        doc(db, "closings", getDateKey()),
        {
            radiologyData: data
        },
        { merge: true }
    );

    updateCarmTotal();
}

async function loadRadiologyData() {
    const snap = await getDoc(doc(db, "closings", getDateKey()));
    const saved = snap.exists() ? (snap.data().radiologyData || {}) : {};

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

/* =========================
   X-ray 스케줄 Firebase 저장
========================= */

let xrayCurrentDate = new Date();
const xrayRowNames = ["OFF", "X-RAY"];

function getXrayMonthKey() {
    const year = xrayCurrentDate.getFullYear();
    const month = xrayCurrentDate.getMonth() + 1;

    return `${year}-${month}`;
}

async function saveXrayData(key, value) {
    await setDoc(
        doc(db, "xraySchedules", getXrayMonthKey()),
        {
            [key]: value
        },
        { merge: true }
    );
}

async function loadXrayMonthData() {
    const snap = await getDoc(
        doc(db, "xraySchedules", getXrayMonthKey())
    );

    return snap.exists() ? snap.data() : {};
}

async function renderXray() {
    const title = document.getElementById("xrayTitle");
    const body = document.getElementById("xrayBody");

    if (!title || !body) return;

    const saved = await loadXrayMonthData();

    const year = xrayCurrentDate.getFullYear();
    const month = xrayCurrentDate.getMonth();

    title.textContent = year + "년 " + (month + 1) + "월";
    body.innerHTML = "";

    const first = new Date(year, month, 1);
    const start = new Date(first);

    const day = first.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(first.getDate() + diff);

    for (let week = 0; week < 6; week++) {
        const dateTr = document.createElement("tr");

        const emptyTd = document.createElement("td");
        dateTr.appendChild(emptyTd);

        for (let d = 0; d < 6; d++) {
            const now = new Date(start);
            now.setDate(start.getDate() + week * 7 + d);

            const td = document.createElement("td");

            if (now.getMonth() === month) {
                td.textContent = now.getDate();

                if (d === 5) {
                    td.classList.add("sat");
                }
            }

            dateTr.appendChild(td);
        }

        body.appendChild(dateTr);

        xrayRowNames.forEach(rowName => {
            const tr = document.createElement("tr");

            const th = document.createElement("th");
            th.textContent = rowName;

            if (rowName === "OFF") {
                th.classList.add("off-label");
            }

            tr.appendChild(th);

            for (let d = 0; d < 6; d++) {
                const now = new Date(start);
                now.setDate(start.getDate() + week * 7 + d);

                const td = document.createElement("td");

                if (now.getMonth() === month) {
                    const input = document.createElement("input");
                    input.className = "xray-input";

                    const key =
                        year + "-" +
                        (month + 1) + "-" +
                        now.getDate() + "-" +
                        rowName;

                    input.value = saved[key] || "";

                    input.oninput = function () {
                        saveXrayData(key, input.value);
                    };

                    td.appendChild(input);
                }

                tr.appendChild(td);
            }

            body.appendChild(tr);
        });
    }
}

function changeXrayMonth(num) {
    xrayCurrentDate.setMonth(xrayCurrentDate.getMonth() + num);
    renderXray();
}

window.changeXrayMonth = changeXrayMonth;

setTimeout(renderXray, 100);

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