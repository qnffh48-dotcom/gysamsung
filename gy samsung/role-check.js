import {
    auth,
    onAuthStateChanged
} from "./firebase.js";

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
    "schedule-maker.html": "schedule"
};

/* 공통 PT 권한 생성 */
function createPtRule(tabId, therapyAdmin = false) {
    return {
        editPages: ["schedule", "therapy"],
        viewPages: [
            "main",
            "closing",
            "desk",
            "radiology",
            "nurse"
        ],
        blockedPages: [
            "stats",
            "closingReport"
        ],
        allowedPtTabs: [tabId],
        therapyAdmin
    };
}

/* 계정별 권한 */
const roleRules = {
    "desk@gy.med": {
        editPages: ["schedule", "desk"],
        viewPages: [
            "main",
            "closing",
            "radiology",
            "nurse",
            "therapy"
        ],
        blockedPages: [
            "stats",
            "closingReport"
        ],
        allowedPtTabs: [],
        therapyAdmin: false
    },

    "rad@gy.med": {
        editPages: ["schedule", "radiology"],
        viewPages: [
            "main",
            "closing",
            "desk",
            "nurse",
            "therapy"
        ],
        blockedPages: [
            "stats",
            "closingReport"
        ],
        allowedPtTabs: [],
        therapyAdmin: false
    },

    "nurse@gy.med": {
        editPages: ["schedule", "nurse"],
        viewPages: [
            "main",
            "closing",
            "desk",
            "radiology",
            "therapy"
        ],
        blockedPages: [
            "stats",
            "closingReport"
        ],
        allowedPtTabs: [],
        therapyAdmin: false
    },

    "doc@gy.med": {
        editPages: ["schedule"],
        viewPages: [
            "main",
            "desk",
            "radiology",
            "nurse",
            "therapy"
        ],
        blockedPages: [
            "stats",
            "closing",
            "closingReport"
        ],
        allowedPtTabs: [],
        therapyAdmin: false
    },

    /* PT1: 관리자 - 마감일지 + PT1~PT8 전체 수정 가능 */
    "pt1@gy.med": {
        editPages: ["schedule", "therapy"],
        viewPages: [
            "main",
            "closing",
            "desk",
            "radiology",
            "nurse"
        ],
        blockedPages: [
            "stats",
            "closingReport"
        ],
        allowedPtTabs: [
            "therapy-temp1",
            "therapy-temp2",
            "therapy-temp3",
            "therapy-temp4",
            "therapy-temp5",
            "therapy-temp6",
            "therapy-temp7",
            "therapy-temp8"
        ],
        therapyAdmin: true
    },

    /* PT2~PT8: 마감일지 수정 가능 + 자기 탭만 표시/수정 가능 */
    "pt2@gy.med": createPtRule("therapy-temp2"),
    "pt3@gy.med": createPtRule("therapy-temp3"),
    "pt4@gy.med": createPtRule("therapy-temp4"),
    "pt5@gy.med": createPtRule("therapy-temp5"),
    "pt6@gy.med": createPtRule("therapy-temp6"),
    "pt7@gy.med": createPtRule("therapy-temp7"),
    "pt8@gy.med": createPtRule("therapy-temp8")
};

onAuthStateChanged(auth, user => {
    if (!user) {
        location.href = "login.html";
        return;
    }

    const email = (user.email || "").toLowerCase();

    let path = location.pathname.split("/").pop();

    if (!path) {
        path = "index.html";
    } else if (!path.includes(".")) {
        path += ".html";
    }

    const page = pageMap[path];

    /* 물품 신청 페이지는 기존 방식 유지 */
    if (page === "purchase") {
        return;
    }

    /* 전체 관리자 */
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

    /* 물리치료 탭 제어 */
    if (page === "therapy") {
        controlPtTabs({
            allowedPtTabs: rule.allowedPtTabs || [],
            isTherapyAdmin: rule.therapyAdmin === true
        });
    }

    /*
     * 보기 전용 페이지 처리
     * PT 계정은 therapy가 editPages에 있으므로
     * 물리치료 마감일지와 자기 탭 모두 수정 가능
     */
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

                /* 저장성 버튼 숨김 */
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

function controlPtTabs({
    allowedPtTabs = [],
    isTherapyAdmin = false
}) {
    const mainTabId = "therapy-main-page";
    const nonpayTabId = "therapy-nonpay-page";

    const allPtTabs = [
        "therapy-temp1",
        "therapy-temp2",
        "therapy-temp3",
        "therapy-temp4",
        "therapy-temp5",
        "therapy-temp6",
        "therapy-temp7",
        "therapy-temp8"
    ];

    let applying = false;

    function applyTabPermissions() {
        if (applying) return;
        applying = true;

        try {
            /*
             * PT1 관리자:
             * 마감일지 + PT1~PT8 전체 표시
             *
             * PT2~PT8:
             * 마감일지 + 자기 PT 탭만 표시
             */
            const visibleTabs = isTherapyAdmin
                ? [mainTabId, nonpayTabId, ...allPtTabs]
                : [mainTabId, ...allowedPtTabs];

            document
                .querySelectorAll(".therapy-top-tab")
                .forEach(tab => {
                    const target = tab.dataset.tab;

                    if (visibleTabs.includes(target)) {
                        tab.style.display = "";
                    } else {
                        tab.style.display = "none";
                        tab.classList.remove("active");
                    }
                });

            document
                .querySelectorAll(".therapy-top-page")
                .forEach(page => {
                    if (visibleTabs.includes(page.id)) {
                        page.style.display = "";
                    } else {
                        page.style.display = "none";
                        page.classList.remove("active");
                    }
                });

            /*
             * 현재 활성 탭이 숨겨졌다면 마감일지로 이동
             */
            const activeTab = document.querySelector(
                ".therapy-top-tab.active"
            );

            const activeTarget = activeTab?.dataset.tab;

            if (
                !activeTarget ||
                !visibleTabs.includes(activeTarget)
            ) {
                document
                    .querySelectorAll(".therapy-top-tab")
                    .forEach(tab => {
                        tab.classList.toggle(
                            "active",
                            tab.dataset.tab === mainTabId
                        );
                    });

                document
                    .querySelectorAll(".therapy-top-page")
                    .forEach(page => {
                        page.classList.toggle(
                            "active",
                            page.id === mainTabId
                        );
                    });
            }
        } finally {
            applying = false;
        }
    }

    applyTabPermissions();

    new MutationObserver(applyTabPermissions).observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}
