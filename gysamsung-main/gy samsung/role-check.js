import {
    auth,
    onAuthStateChanged
}
from "./firebase.js";

/* 전체 관리자 */
const fullAccessUsers = [
    "admin@gy.med",
    "os1@gy.med",
    "admin@bh.med"
];

/* 페이지 정의 */
const pageMap = {
    "index.html": "main",
    "": "main",
    "schedule.html": "schedule",
    "desk.html": "desk",
    "nurse.html": "nurse",
    "radiology.html": "radiology",
    "therapy.html": "therapy",
    "closing.html": "closing",
    "closing-report.html": "closingReport",
    "stats.html": "stats",
    "purchase.html": "purchase",
    "schedule-maker.html": "schedule",
};

/* 계정별 권한 */
const roleRules = {
    "desk@gy.med": {
        editPages: ["schedule", "desk"],
        viewPages: ["main", "closing", "radiology", "nurse", "therapy"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: []
    },

    "rad@gy.med": {
        editPages: ["schedule", "radiology"],
        viewPages: ["main", "closing", "desk", "nurse", "therapy"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: []
    },

    "nurse@gy.med": {
        editPages: ["schedule", "nurse"],
        viewPages: ["main", "closing", "desk", "radiology", "therapy"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: []
    },

    "doc@gy.med": {
        editPages: ["schedule"],
        viewPages: ["main", "desk", "radiology", "nurse", "therapy"],
        blockedPages: ["stats", "closing", "closingReport"],
        allowedPtTabs: []
    },

    "pt1@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: ["main", "closing", "desk", "radiology", "nurse"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: ["therapy-temp1"]
    },

    "pt2@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: ["main", "closing", "desk", "radiology", "nurse"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: ["therapy-temp2"]
    },

    "pt3@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: ["main", "closing", "desk", "radiology", "nurse"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: ["therapy-temp3"]
    },

    "pt4@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: ["main", "closing", "desk", "radiology", "nurse"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: ["therapy-temp4"]
    },

    "pt5@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: ["main", "closing", "desk", "radiology", "nurse"],
        blockedPages: ["stats", "closingReport"],
        allowedPtTabs: ["therapy-temp5"]
    }
};

onAuthStateChanged(auth, (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    const email = (user.email || "").toLowerCase();
    let path = location.pathname.split("/").pop();

if (!path || path === "") {
    path = "index.html";
}
else if (!path.includes(".")) {
    path = path + ".html";
}


const page = pageMap[path];

if (page === "purchase") {
    return;
}


    if (fullAccessUsers.includes(email)) {
        return;
    }

    const rule = roleRules[email];

    if (!rule) {
        alert("등록되지 않은 계정입니다.");
        location.href = "login.html";
        return;
    }

    if (!page) {
        alert("접근 권한이 없습니다.");
        location.href = "index.html";
        return;
    }

    /* 완전 차단 */
    if (rule.blockedPages.includes(page)) {
        alert("접근 권한이 없습니다.");
        location.href = "index.html";
        return;
    }

    /* 보기/수정 둘 다 없는 페이지 차단 */
    if (
        !rule.editPages.includes(page) &&
        !rule.viewPages.includes(page)
    ) {
        alert("접근 권한이 없습니다.");
        location.href = "index.html";
        return;
    }

    /* 물리치료 PT 탭 제어 */
    if (page === "therapy") {
        controlPtTabs(rule.allowedPtTabs || []);
    }

    /* 보기만 가능한 페이지 */
    if (rule.viewPages.includes(page)) {
        makeReadOnly(page);
    }

});

/* =========================
   읽기 전용 처리
========================= */

function makeReadOnly(page) {

    function lock() {

        document
            .querySelectorAll("input, textarea")
            .forEach(el => {
                el.disabled = true;
                el.style.cursor = "not-allowed";
            });

        document
            .querySelectorAll("button")
            .forEach(btn => {

                if (btn.closest(".sidebar")) return;

                const text = btn.textContent.trim();

                /* 날짜 이동 / 탭 이동은 허용 */
                if (
                    text === "◀" ||
                    text === "▶" ||
                    btn.classList.contains("therapy-tab") ||
                    btn.classList.contains("therapy-top-tab") ||
                    btn.classList.contains("closing-tab") ||
                    btn.classList.contains("desk-top-tab")
                ) {
                    return;
                }

                /* 저장성 버튼만 숨김 */
                if (
                    text.includes("추가") ||
                    text.includes("삭제") ||
                    text.includes("저장") ||
                    text.includes("업로드") ||
                    text.includes("등록") ||
                    text.includes("불러오기") ||
                    text.includes("마감 리포트")
                ) {
                    btn.disabled = true;
                    btn.style.display = "none";
                }
            });

        /* 파일 업로드 input 차단 */
        document
            .querySelectorAll('input[type="file"]')
            .forEach(input => {
                input.disabled = true;
            });
    }

    lock();

    new MutationObserver(lock).observe(document.body, {
        childList: true,
        subtree: true
    });
}

/* =========================
   물리치료 PT 탭 제어
========================= */

function controlPtTabs(allowedPtTabs) {

    const allPtTabs = [
        "therapy-temp1",
        "therapy-temp2",
        "therapy-temp3",
        "therapy-temp4",
        "therapy-temp5"
    ];

    function lock() {

        document
            .querySelectorAll(".therapy-top-tab")
            .forEach(tab => {

                const target = tab.dataset.tab;

                if (
                    allPtTabs.includes(target) &&
                    !allowedPtTabs.includes(target)
                ) {
                    tab.style.display = "none";
                }
            });

        allPtTabs.forEach(id => {
            if (!allowedPtTabs.includes(id)) {
                const page = document.getElementById(id);
                if (page) page.remove();
            }
        });
    }

    lock();

    new MutationObserver(lock).observe(document.body, {
        childList: true,
        subtree: true
    });
}