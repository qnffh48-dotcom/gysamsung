import { db, doc, getDoc } from "./firebase.js";

async function loadTodaySchedule() {

  const today = new Date();

  const date =
    today.getFullYear() +
    "-" +
    (today.getMonth() + 1) +
    "-" +
    today.getDate();

  const snap = await getDoc(doc(db, "schedules", date));

  if (!snap.exists()) {
    console.log("오늘 스케줄 없음");
    return;
  }

  const data = snap.data();

  document.querySelector(".today-doctor").textContent =
    data.doctor || "미입력";

  document.querySelector(".today-room").textContent =
    data.room || "미입력";

  document.querySelector(".today-nurse").textContent =
    data.nurse || "미입력";

  document.querySelector(".today-desk").textContent =
    data.desk || "미입력";

  document.querySelector(".today-therapy").textContent =
    data.therapy || "미입력";
}

window.addEventListener("load", loadTodaySchedule);

function openRoom(event, roomId) {

    const pages =
        document.querySelectorAll(".room-page");

    const tabs =
        document.querySelectorAll(".room-tab");

    pages.forEach(page =>
        page.classList.remove("active")
    );

    tabs.forEach(tab =>
        tab.classList.remove("active")
    );

    document.getElementById(roomId)
        .classList.add("active");

    event.currentTarget
        .classList.add("active");
}
/* X-RAY 달력 */
let currentDate = new Date();

const rowNames = ["OFF", "X-RAY"];

function renderCalendar() {
    const title = document.getElementById("calendarTitle");
    const body = document.getElementById("calendarBody");

    if (!title || !body) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    title.textContent = `${year}년 ${month + 1}월`;
    body.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    let startDate = new Date(firstDay);

    const day = firstDay.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    startDate.setDate(firstDay.getDate() + diff);

    for (let week = 0; week < 6; week++) {
        const dateRow = document.createElement("tr");
        dateRow.appendChild(document.createElement("td"));

        for (let d = 0; d < 6; d++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + week * 7 + d);

            const td = document.createElement("td");
            td.className = "date-cell";

            if (current.getMonth() === month) {
                td.textContent = current.getDate();

                if (d === 5) {
                    td.classList.add("sat");
                }
            }

            dateRow.appendChild(td);
        }

        body.appendChild(dateRow);

        rowNames.forEach(rowName => {
            const tr = document.createElement("tr");

            const label = document.createElement("th");
            label.textContent = rowName;

            if (rowName === "OFF") {
                label.classList.add("off-label");
            }

            tr.appendChild(label);

            for (let d = 0; d < 6; d++) {
                const current = new Date(startDate);
                current.setDate(startDate.getDate() + week * 7 + d);

                const td = document.createElement("td");

                if (current.getMonth() === month) {
                    const input = document.createElement("input");
                    input.className = "memo-input";

                    const key =
                        `${year}-${month + 1}-${current.getDate()}-${rowName}`;

                    input.value = localStorage.getItem(key) || "";

                    input.addEventListener("input", () => {
                        localStorage.setItem(key, input.value);
                    });

                    td.appendChild(input);
                }

                tr.appendChild(td);
            }

            body.appendChild(tr);
        });
    }
}

window.changeMonth = function(num) {
    currentDate.setMonth(currentDate.getMonth() + num);
    renderCalendar();
};

renderCalendar();


/* 매뉴얼 팝업 + 자동저장 */
window.currentManualKey = "";

const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}