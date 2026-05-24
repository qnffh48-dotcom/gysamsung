import { db, doc, getDoc, setDoc } from "./firebase.js";

/* =========================
   오늘 스케줄
========================= */

async function loadTodaySchedule() {
    const today = new Date();

    const date =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        today.getDate();

    const snap = await getDoc(doc(db, "schedules", date));

    const data = snap.exists() ? snap.data() : {};

    document.querySelector(".today-doctor").textContent = data.doctor || "미입력";
    document.querySelector(".today-room").textContent = data.room || "미입력";
    document.querySelector(".today-nurse").textContent = data.nurse || "미입력";
    document.querySelector(".today-desk").textContent = data.desk || "미입력";
    document.querySelector(".today-therapy").textContent = data.therapy || "미입력";
}

/* =========================
   공지사항 Firebase
========================= */

let notices = [];

async function loadNotices() {
    const snap = await getDoc(doc(db, "mainData", "notices"));

    notices = snap.exists() ? (snap.data().items || [""]) : [""];
    renderNotices();
}

async function saveNotices() {
    await setDoc(
        doc(db, "mainData", "notices"),
        { items: notices },
        { merge: true }
    );
}

function renderNotices() {
    const noticeList = document.getElementById("noticeList");
    if (!noticeList) return;

    noticeList.innerHTML = "";

    notices.forEach((text, index) => {
        noticeList.innerHTML += `
            <div class="notice-item">
                <span class="dot"></span>

                <textarea class="notice-text"
                    oninput="updateNotice(${index}, this); autoResize(this);">${text}</textarea>

                <button class="notice-delete-btn" onclick="deleteNotice(${index})">삭제</button>
            </div>
        `;
    });

    document.querySelectorAll(".notice-text").forEach(autoResize);
}

async function addNotice() {
    notices.push("");
    await saveNotices();
    renderNotices();
}

async function deleteNotice(index) {
    notices.splice(index, 1);
    await saveNotices();
    renderNotices();
}

async function updateNotice(index, textarea) {
    notices[index] = textarea.value;
    await saveNotices();
}

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}

window.addNotice = addNotice;
window.deleteNotice = deleteNotice;
window.updateNotice = updateNotice;
window.autoResize = autoResize;

/* =========================
   URL 모음 Firebase
========================= */

let savedUrls = [];

async function loadUrls() {
    const snap = await getDoc(doc(db, "mainData", "urls"));

    savedUrls = snap.exists() ? (snap.data().items || []) : [];
    renderUrls();
}

async function saveUrls() {
    await setDoc(
        doc(db, "mainData", "urls"),
        { items: savedUrls },
        { merge: true }
    );
}

function renderUrls() {
    const urlList = document.getElementById("urlList");
    if (!urlList) return;

    urlList.innerHTML = "";

    savedUrls.forEach((url, index) => {
        urlList.innerHTML += `
            <div class="url-link-item">
                <a href="${url.link}" target="_blank">${url.name}</a>
                <button type="button" onclick="deleteUrl(${index})">삭제</button>
            </div>
        `;
    });
}

async function addUrl() {
    const nameInput = document.getElementById("urlName");
    const linkInput = document.getElementById("urlLink");

    const name = nameInput.value.trim();
    let link = linkInput.value.trim();

    if (!name || !link) {
        alert("사이트 이름이랑 주소 둘 다 입력해주세용");
        return;
    }

    if (!link.startsWith("http://") && !link.startsWith("https://")) {
        link = "https://" + link;
    }

    savedUrls.push({ name, link });
    await saveUrls();

    nameInput.value = "";
    linkInput.value = "";

    renderUrls();
}

async function deleteUrl(index) {
    savedUrls.splice(index, 1);
    await saveUrls();
    renderUrls();
}

window.addUrl = addUrl;
window.deleteUrl = deleteUrl;

/* =========================
   업무 매뉴얼 Firebase
========================= */

let currentManualKey = "";

async function openModal(key, title, basicContent) {
    currentManualKey = key;

    const modal = document.getElementById("manualModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    modal.classList.add("active");
    modalTitle.textContent = title;

    const snap = await getDoc(doc(db, "manualContents", key));

    modalContent.value = snap.exists()
        ? (snap.data().content || "")
        : basicContent;

    modalContent.oninput = async function () {
        await setDoc(
            doc(db, "manualContents", currentManualKey),
            { content: modalContent.value },
            { merge: true }
        );
    };
}

function closeModal() {
    document.getElementById("manualModal").classList.remove("active");
}

async function saveManualCards() {
    const cards = document.querySelectorAll(".manual-card");
    const items = [];

    cards.forEach(card => {
        items.push({
            tag: card.querySelector(".manual-tag-input")?.value || "",
            title: card.querySelector(".manual-title-input")?.value || "",
            desc: card.querySelector(".manual-desc-input")?.value || ""
        });
    });

    await setDoc(
        doc(db, "mainData", "manualCards"),
        { items },
        { merge: true }
    );
}

async function loadManualCards() {
    const snap = await getDoc(doc(db, "mainData", "manualCards"));
    if (!snap.exists()) return;

    const items = snap.data().items || [];
    const cards = document.querySelectorAll(".manual-card");

    cards.forEach((card, index) => {
        const data = items[index];
        if (!data) return;

        card.querySelector(".manual-tag-input").value = data.tag || "";
        card.querySelector(".manual-title-input").value = data.title || "";
        card.querySelector(".manual-desc-input").value = data.desc || "";
    });
}

window.openModal = openModal;
window.closeModal = closeModal;

/* =========================
   사이드바 시계
========================= */

function updateSidebarClock() {
    const now = new Date();

    const dateText =
        now.getFullYear() + "." +
        String(now.getMonth() + 1).padStart(2, "0") + "." +
        String(now.getDate()).padStart(2, "0");

    const timeText =
        String(now.getHours()).padStart(2, "0") + ":" +
        String(now.getMinutes()).padStart(2, "0") + ":" +
        String(now.getSeconds()).padStart(2, "0");

    const dateEl = document.getElementById("clockDate");
    const timeEl = document.getElementById("clockTime");

    if (dateEl) dateEl.textContent = dateText;
    if (timeEl) timeEl.textContent = timeText;
}

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

/* =========================
   시작
========================= */

window.addEventListener("load", async () => {
    await loadTodaySchedule();
    await loadNotices();
    await loadUrls();
    await loadManualCards();

    document.querySelectorAll(
        ".manual-tag-input, .manual-title-input, .manual-desc-input"
    ).forEach(input => {
        input.addEventListener("input", saveManualCards);
    });

    updateSidebarClock();
    setInterval(updateSidebarClock, 1000);
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeModal();
    }
});