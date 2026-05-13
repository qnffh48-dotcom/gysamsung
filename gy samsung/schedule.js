import { db, doc, setDoc, getDoc } from "./firebase.js";

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
    doc(db, "schedules", date),
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
    const snap = await getDoc(doc(db, "schedules", date));

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