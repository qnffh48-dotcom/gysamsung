import {
    auth,
    signInWithEmailAndPassword
}
from "./firebase.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const message = document.getElementById("loginMessage");
const rememberId = document.getElementById("rememberId");

/* 저장된 아이디 불러오기 */
const savedId = localStorage.getItem("savedLoginId");

if (savedId) {
    emailInput.value = savedId;
    rememberId.checked = true;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    message.textContent = "";

    try {
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        if (rememberId.checked) {
            localStorage.setItem("savedLoginId", email);
        } else {
            localStorage.removeItem("savedLoginId");
        }

        message.style.color = "#16a34a";
        message.textContent = "로그인 성공";

        setTimeout(() => {
            location.href = "index.html";
        }, 500);

    } catch (error) {
        console.error(error);

        message.style.color = "#dc2626";

        if (error.code === "auth/invalid-credential") {
            message.textContent =
                "아이디 또는 비밀번호가 올바르지 않습니다.";
        } else {
            message.textContent =
                "로그인에 실패했습니다.";
        }
    }
});