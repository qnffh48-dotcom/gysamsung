import {
    auth,
    onAuthStateChanged
}
from "./firebase.js";

const fullAccessUsers = [
    "cjy@gysamsung.med",
    "kyh@gysamsung.med",
    "os1@gysamsung.med"
];

const limitedUsers = [
    "radiology@gysamsung.med",
    "physical@gysamsung.med",
    "nurse@gysamsung.med",
    "doctor@gysamsung.med"
];

onAuthStateChanged(auth, (user) => {

    /* 로그인 안됨 */
    if (!user) {
        location.href = "login.html";
        return;
    }

    const email = user.email;

    const path =
        location.pathname.split("/").pop();

    const isAdmin =
        fullAccessUsers.includes(email);

    const isLimited =
        limitedUsers.includes(email);

    /* =========================
       통계 페이지 차단
    ========================= */

    if (
        path === "stats.html" &&
        isLimited &&
        !isAdmin
    ) {

        alert("통계 페이지 접근 권한이 없습니다.");

        location.href = "index.html";

        return;
    }

    /* =========================
       공지 수정 제한
    ========================= */

    if (isLimited && !isAdmin) {

        function lockNotice() {

            /* 공지 추가 버튼 숨김 */
            const noticeBtn =
                document.getElementById("noticeEditBtn");

            if (noticeBtn) {
                noticeBtn.style.display = "none";
            }

            /* 삭제 버튼 숨김 */
            document
                .querySelectorAll("button")
                .forEach(btn => {

                    if (
                        btn.textContent.includes("삭제")
                    ) {
                        btn.style.display = "none";
                    }

                });

            /* 공지 입력 금지 */
            document
                .querySelectorAll(".notice-text")
                .forEach(area => {

                    area.disabled = true;

                    area.style.opacity = "0.7";

                    area.style.cursor =
                        "not-allowed";
                });

            /* 공지 날짜 수정 금지 */
            document
                .querySelectorAll(".notice-date")
                .forEach(input => {

                    input.disabled = true;

                    input.style.opacity = "0.7";

                    input.style.cursor =
                        "not-allowed";
                });

        }

        lockNotice();

        const observer =
            new MutationObserver(() => {

                lockNotice();

            });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    }

});