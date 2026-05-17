import {
    auth,
    signOut
}
from "./firebase.js";

const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        const ok =
            confirm("로그아웃 하시겠습니까?");

        if (!ok) return;

        try {

            await signOut(auth);

            location.href = "login.html";

        } catch (error) {

            console.error(error);

            alert("로그아웃 실패");
        }

    });

}