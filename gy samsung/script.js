import { db, doc, getDoc, setDoc } from "./firebase.js";

import {
    hospitalCollection,
    applyHospitalUI,
    setHospitalId
} from "./hospital.js";

applyHospitalUI();

window.selectHospital = setHospitalId;
let notices = [];
let savedUrls = [];
let currentManualKey = "";
let manualSaveTimer = null;
let savedScrollY = 0;
let manualCards = [];

function todayKeys() {
    const t = new Date();
    const y = t.getFullYear();
    const m = t.getMonth() + 1;
    const d = t.getDate();

    return [
        `${y}-${m}-${d}`,
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    ];
}

/* TODAY OFF */
async function loadTodaySchedule() {
    let data = {};

    for (const key of todayKeys()) {
        const snap = await getDoc(
    doc(db, hospitalCollection("schedules"), key)
);
        if (snap.exists()) {
            data = snap.data();
            break;
        }
    }

    document.querySelector(".today-doctor").textContent =
        data.doctor || data.의사 || "미입력";

    document.querySelector(".today-room").textContent =
        data.room || data.방과 || "미입력";

    document.querySelector(".today-nurse").textContent =
        data.nurse || data.간호 || "미입력";

    document.querySelector(".today-desk").textContent =
        data.desk || data.원무 || "미입력";

    document.querySelector(".today-therapy").textContent =
        data.therapy || data.물치 || "미입력";
}

/* 공지 */
async function loadNotices() {
    const snap = await getDoc(doc(db, hospitalCollection("mainData"), "notices"));
    notices = snap.exists() ? snap.data().items || [] : [];
    renderNotices();
}

async function saveNotices() {
    await setDoc(
        doc(db, hospitalCollection("mainData"), "notices"),
        { items: notices },
        { merge: true }
    );
}

function renderNotices() {
    const noticeList = document.getElementById("noticeList");
    if (!noticeList) return;

    noticeList.innerHTML = "";

    notices.forEach((text, index) => {
        const item = document.createElement("div");
        item.className = "notice-item";

        const dot = document.createElement("span");
        dot.className = "dot";

        const textarea = document.createElement("textarea");
        textarea.className = "notice-text";
        textarea.value = text || "";

        textarea.addEventListener("input", async function () {
            notices[index] = this.value;
            autoResize(this);
            await saveNotices();
        });

        const btn = document.createElement("button");
        btn.className = "notice-delete-btn";
        btn.textContent = "삭제";

        btn.addEventListener("click", async function () {
            notices.splice(index, 1);
            await saveNotices();
            renderNotices();
        });

        item.appendChild(dot);
        item.appendChild(textarea);
        item.appendChild(btn);

        noticeList.appendChild(item);
        autoResize(textarea);
    });
}

async function addNotice() {
    notices.push("");
    await saveNotices();
    renderNotices();
}

/* URL */
async function loadUrls() {
    const snap = await getDoc(doc(db, hospitalCollection("mainData"), "urls"));
    savedUrls = snap.exists() ? snap.data().items || [] : [];
    renderUrls();
}

async function saveUrls() {
    await setDoc(
        doc(db, hospitalCollection("mainData"), "urls"),
        { items: savedUrls },
        { merge: true }
    );
}

function renderUrls() {
    const urlList = document.getElementById("urlList");
    if (!urlList) return;

    urlList.innerHTML = "";

    savedUrls.forEach((url, index) => {
        const item = document.createElement("div");
        item.className = "url-link-item";

        const a = document.createElement("a");
        a.href = url.link;
        a.target = "_blank";
        a.textContent = url.name;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "삭제";

        btn.addEventListener("click", async function () {
            savedUrls.splice(index, 1);
            await saveUrls();
            renderUrls();
        });

        item.appendChild(a);
        item.appendChild(btn);
        urlList.appendChild(item);
    });
}

async function addUrl() {
    const nameInput = document.getElementById("urlName");
    const linkInput = document.getElementById("urlLink");

    const name = nameInput.value.trim();
    let link = linkInput.value.trim();

    if (!name || !link) {
        alert("사이트 이름이랑 주소 둘 다 입력");
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

/* 매뉴얼 카드 */
function makeManualKey() {
    return "manual_" + Date.now();
}

async function saveManualCards() {
    await setDoc(
        doc(db, hospitalCollection("mainData"), "manualCards"),
        { items: manualCards },
        { merge: true }
    );
}

async function loadManualCards() {
    const snap = await getDoc(doc(db, hospitalCollection("mainData"), "manualCards"));

    manualCards = snap.exists()
        ? snap.data().items || []
        : [];

    if (manualCards.length === 0) {
        manualCards = [
            {
                key: "manual_001",
                tag: "온보딩",
                title: "신규 입사자 온보딩",
                desc: "병원 시스템 및 기본 업무 안내"
            },
            {
                key: "manual_002",
                tag: "원무",
                title: "환자 접수 프로세스",
                desc: "초진 / 재진 접수 절차"
            }
        ];

        await saveManualCards();
    }

    renderManualCards();
}

function renderManualCards() {
    const grid = document.getElementById("manualGrid");
    if (!grid) return;

    grid.innerHTML = "";

    manualCards.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "manual-card";

        card.onclick = function () {
            openModal(
                item.key,
                item.title || "제목 없음",
                item.desc || ""
            );
        };

        card.innerHTML = `
            <button class="manual-delete-btn" type="button">삭제</button>

            <input class="manual-tag-input"
                value="${item.tag || ""}"
                onclick="event.stopPropagation()">

            <input class="manual-title-input"
                value="${item.title || ""}"
                onclick="event.stopPropagation()">

            <textarea class="manual-desc-input"
                onclick="event.stopPropagation()">${item.desc || ""}</textarea>
        `;

        const tagInput = card.querySelector(".manual-tag-input");
        const titleInput = card.querySelector(".manual-title-input");
        const descInput = card.querySelector(".manual-desc-input");
        const deleteBtn = card.querySelector(".manual-delete-btn");

        tagInput.addEventListener("input", () => {
            manualCards[index].tag = tagInput.value;
            saveManualCards();
        });

        titleInput.addEventListener("input", () => {
            manualCards[index].title = titleInput.value;
            saveManualCards();
        });

        descInput.addEventListener("input", () => {
            manualCards[index].desc = descInput.value;
            saveManualCards();
        });

        deleteBtn.addEventListener("click", async e => {
            e.stopPropagation();

            const ok = confirm("이 매뉴얼을 삭제할까요?");
            if (!ok) return;

            manualCards.splice(index, 1);

            await saveManualCards();
            renderManualCards();
        });

        grid.appendChild(card);
    });
}

async function addManualCard() {
    manualCards.push({
        key: makeManualKey(),
        tag: "기타",
        title: "새 매뉴얼",
        desc: ""
    });

    await saveManualCards();
    renderManualCards();
}

/* 매뉴얼 모달 */
async function openModal(key, title, basicContent) {
    currentManualKey = key;

    const modal = document.getElementById("manualModal");
const modalTitle = document.getElementById("modalTitle");
const modalContent = document.getElementById("modalContent");



modal.classList.add("active");




modalTitle.textContent = title;
    const snap = await getDoc(doc(db, hospitalCollection("manualContents"), key));

    modalContent.value = snap.exists()
        ? snap.data().content || ""
        : basicContent || "";

    modalContent.oninput = async function () {
        await setDoc(
            doc(db, hospitalCollection("manualContents"), currentManualKey),
            { content: modalContent.value },
            { merge: true }
        );
    };
}

function closeModal() {

    document
        .getElementById("manualModal")
        ?.classList.remove("active");

    
}

/* 시계 */
function updateSidebarClock() {
    const now = new Date();

    const dateEl = document.getElementById("clockDate");
    const timeEl = document.getElementById("clockTime");

    if (dateEl) {
        dateEl.textContent =
            now.getFullYear() + "." +
            String(now.getMonth() + 1).padStart(2, "0") + "." +
            String(now.getDate()).padStart(2, "0");
    }

    if (timeEl) {
        timeEl.textContent =
            String(now.getHours()).padStart(2, "0") + ":" +
            String(now.getMinutes()).padStart(2, "0") + ":" +
            String(now.getSeconds()).padStart(2, "0");
    }
}

/* 사이드바 */
const floatingNav = document.querySelector(".sidebar .nav");

if (floatingNav) {
    window.addEventListener("scroll", () => {
        requestAnimationFrame(() => {
            floatingNav.style.transform = `translateY(${window.scrollY}px)`;
        });
    });
}

/* 전역 */
window.addNotice = addNotice;
window.addUrl = addUrl;
window.openModal = openModal;
window.closeModal = closeModal;
window.addManualCard = addManualCard;

/* 시작 */
async function startMainPage() {
    try { await loadTodaySchedule(); } catch (e) { console.error("TODAY OFF 실패", e); }
    try { await loadNotices(); } catch (e) { console.error("공지 실패", e); }
    try { await loadUrls(); } catch (e) { console.error("URL 실패", e); }
    try { await loadManualCards(); } catch (e) { console.error("매뉴얼 실패", e); }

    

    updateSidebarClock();
    setInterval(updateSidebarClock, 1000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMainPage);
} else {
    startMainPage();
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
});

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}const manualModal = document.getElementById("manualModal");
const modalContent = document.getElementById("modalContent");

manualModal?.addEventListener("wheel", function (e) {
    e.preventDefault();
}, { passive: false });

modalContent?.addEventListener("wheel", function (e) {
    e.stopPropagation();
}, { passive: false });
