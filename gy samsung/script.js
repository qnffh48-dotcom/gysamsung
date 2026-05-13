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
