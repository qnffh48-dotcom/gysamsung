import { db, doc, setDoc, getDoc } from "./firebase.js";
import {
    getHospitalId,
    setHospitalId,
    hospitalCollection
} from "./hospital.js";

const hospitalSelect = document.getElementById("hospitalSelect");

if (hospitalSelect) {
    hospitalSelect.value = getHospitalId();

    hospitalSelect.addEventListener("change", e => {
        setHospitalId(e.target.value);
    });
}
console.log("schedule.js 자동저장 모드");

function getKey(ta) {
  if (ta.classList.contains("doctor")) return "doctor";
  if (ta.classList.contains("room")) return "room";
  if (ta.classList.contains("nurse")) return "nurse";
  if (ta.classList.contains("desk")) return "desk";
  if (ta.classList.contains("therapy")) return "therapy";
  return null;
}

async function saveOneTextarea(ta) {
  const date = ta.dataset.date;
  const key = getKey(ta);

  if (!date || !key) return;

  await setDoc(
    doc(db, hospitalCollection("schedules"), date),
    {
      [key]: ta.value
    },
    { merge: true }
  );

  console.log("자동저장:", date, key, ta.value);
}

async function loadAllSchedules() {
  const textareas = [...document.querySelectorAll("textarea[data-date]")];

  const dates = [...new Set(textareas.map(ta => ta.dataset.date))];

  for (const date of dates) {
    const snap = await getDoc(doc(db, hospitalCollection("schedules"), date));

    if (!snap.exists()) continue;

    const data = snap.data();

    textareas
      .filter(ta => ta.dataset.date === date)
      .forEach(ta => {
        const key = getKey(ta);
        if (!key) return;

        ta.value = data[key] || "";
      });
  }

  console.log("전체 불러오기 완료");
}

// 입력할 때마다 자동저장
document.addEventListener("input", function (e) {
  if (!e.target.matches("textarea[data-date]")) return;

  clearTimeout(e.target.saveTimer);

  e.target.saveTimer = setTimeout(() => {
    saveOneTextarea(e.target);
  }, 200);
});

// 페이지 열 때 불러오기
window.addEventListener("load", loadAllSchedules);
// 달력 DOM이 바뀔 때마다 다시 불러오기
const observer = new MutationObserver(() => {
  clearTimeout(window.loadTimer);

  window.loadTimer = setTimeout(() => {
    loadAllSchedules();
  }, 100);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        const targetY = window.scrollY;

        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${targetY}px)`;
        });
    });
}



function getLunchKey(year, month, name, day) {
    return `lunch-${year}-${month}-${name}-${day}`;
}

function getLunchClass(value) {
    if (value === "12") return "time-12";
    if (value === "13") return "time-13";
    if (value === "14") return "time-14";
    return "";
}

async function renderLunchSchedule() {
    const table = document.getElementById("monthlyLunchTable");
    if (!table) return;

    const year = lunchCurrentYear;
    const month = lunchCurrentMonth + 1;
    const lastDay = new Date(year, month, 0).getDate();

    const saved = await loadLunchData();

    const title2 = document.getElementById("lunchMonthText2");
    if (title2) {
        title2.textContent = `${year}년 ${month}월`;
    }

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

    html += `</tr><tr>`;

    for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month - 1, d).getDay();
        let cls = day === 6 ? "sat" : day === 0 ? "sun" : "";
        html += `<th class="day-cell ${cls}">${d}</th>`;
    }

    html += `</tr></thead><tbody>`;

    lunchGroups.forEach((group, groupIndex) => {
        group.forEach(name => {
            html += `<tr><td class="name-cell" contenteditable="true">${name}</td>`;

            for (let d = 1; d <= lastDay; d++) {
                const key = getLunchKey(year, month, name, d);
                const value = saved[key] || "";
                const cls = getLunchClass(value);

                html += `
    <td class="lunch-cell"
        data-key="${key}"
        data-value="${value}">
        ${value ? `<span class="lunch-badge ${cls}">${value}</span>` : ""}
    </td>
`;
            }

            html += `</tr>`;
        });

        if (groupIndex !== lunchGroups.length - 1) {
            html += `<tr class="divider"><td colspan="${lastDay + 1}"></td></tr>`;
        }
    });

    html += `</tbody>`;
    table.innerHTML = html;

    document.querySelectorAll(".lunch-cell").forEach(cell => {
        cell.onclick = async function () {
            let current = cell.dataset.value || "";
            let index = lunchTimes.indexOf(current);
            let next = lunchTimes[(index + 1) % lunchTimes.length];

            cell.dataset.value = next;
cell.innerHTML =
    next
        ? `<span class="lunch-badge ${getLunchClass(next)}">${next}</span>`
        : "";

cell.classList.remove("time-12", "time-13", "time-14");

if (next) {
    cell.classList.add(getLunchClass(next));
}

await saveLunchData(cell.dataset.key, next);
        };
    });
}

setTimeout(renderLunchSchedule, 100);

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

    renderLunchSchedule();
}

window.changeLunchMonth = changeLunchMonth;
window.renderLunchSchedule = renderLunchSchedule;
function printScheduleOnly() {

    document
        .querySelectorAll("textarea")
        .forEach(t => {

            t.innerHTML = t.value;

        });

    window.print();
}

window.printScheduleOnly = printScheduleOnly;

function getLunchMonthKey() {
    return `${lunchCurrentYear}-${lunchCurrentMonth + 1}`;
}

async function loadLunchData() {
    const snap = await getDoc(
        doc(db, hospitalCollection("lunchSchedules"), getLunchMonthKey())
    );

    return snap.exists() ? snap.data() : {};
}

async function saveLunchData(key, value) {
    if (value) {
        await setDoc(
            doc(db, hospitalCollection("lunchSchedules"), getLunchMonthKey()),
            { [key]: value },
            { merge: true }
        );
    } else {
        await setDoc(
            doc(db, hospitalCollection("lunchSchedules"), getLunchMonthKey()),
            { [key]: "" },
            { merge: true }
        );
    }
}