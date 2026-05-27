import {
    auth,
    onAuthStateChanged
}
from "./firebase.js";

const fullAccessUsers = [
    "admin@gy.med",
    "os1@gy.med",
    "pt@gy.med"
];

const roleRules = {
    "desk@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "radiology.html", "nurse.html", "therapy.html"],
        allowedPtTabs: []
    },

    "rad@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "nurse.html", "therapy.html"],
        allowedPtTabs: []
    },

    "nurse@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "therapy.html"],
        allowedPtTabs: []
    },

    "doc@gy.med": {
        blockedPages: ["stats.html", "closing.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "desk.html", "radiology.html", "nurse.html", "therapy.html"],
        allowedPtTabs: []
    },

    "pt1@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "nurse.html"],
        allowedPtTabs: ["therapy-temp1"]
    },

    "pt2@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "nurse.html"],
        allowedPtTabs: ["therapy-temp2"]
    },

    "pt3@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "nurse.html"],
        allowedPtTabs: ["therapy-temp3"]
    },

    "pt4@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "nurse.html"],
        allowedPtTabs: ["therapy-temp4"]
    },

    "pt5@gy.med": {
        blockedPages: ["stats.html", "closing-report.html"],
        readOnlyPages: ["index.html", "", "closing.html", "desk.html", "radiology.html", "nurse.html"],
        allowedPtTabs: ["therapy-temp5"]
    }
};

onAuthStateChanged(auth, (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    const email =
        (user.email || "").toLowerCase();

    const path =
        location.pathname.split("/").pop() || "index.html";

    if (fullAccessUsers.includes(email)) {
        return;
    }

    const rule = roleRules[email];

    if (!rule) {
        alert("등록되지 않은 계정입니다.");
        location.href = "login.html";
        return;
    }

    if (rule.blockedPages.includes(path)) {
        alert("접근 권한이 없습니다.");
        location.href = "index.html";
        return;
    }

    if (path === "therapy.html") {
        controlPtTabs(rule.allowedPtTabs);
    }

    if (rule.readOnlyPages.includes(path)) {
        makeReadOnly();
    }

});

/* =========================
   읽기 전용
========================= */

function makeReadOnly() {

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

                if (
                    text.includes("추가") ||
                    text.includes("삭제") ||
                    text.includes("저장") ||
                    text.includes("업로드") ||
                    text.includes("등록")
                ) {
                    btn.disabled = true;
                    btn.style.display = "none";
                }
            });
    }

    lock();

    new MutationObserver(lock).observe(document.body, {
        childList: true,
        subtree: true
    });
}

/* =========================
   PT 탭 제어
========================= */

function controlPtTabs(allowedPtTabs) {

    function lock() {

        const ptTabs = [
            "therapy-temp1",
            "therapy-temp2",
            "therapy-temp3",
            "therapy-temp4",
            "therapy-temp5"
        ];

        document
            .querySelectorAll(".therapy-top-tab")
            .forEach(tab => {

                const target = tab.dataset.tab;

                if (
                    ptTabs.includes(target) &&
                    !allowedPtTabs.includes(target)
                ) {
                    tab.style.display = "none";
                }
            });

        ptTabs.forEach(id => {
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