import { db, doc, setDoc, getDoc } from "./firebase.js";

const REPORT_ID = "radiology-closing";

function updateTotal() {

    const inputs = document.querySelectorAll(".carm-count");

    let total = 0;

    inputs.forEach(input => {

        const number =
            parseInt(input.value.replace(/[^0-9]/g, "")) || 0;

        total += number;

    });

    const totalInput =
        document.querySelector(".total-input");

    if (totalInput) {

        totalInput.value = total + "개";

    }
}

async function saveReport() {

    const inputs = document.querySelectorAll(".report-input");

    const data = {};

    inputs.forEach(input => {

        data[input.dataset.key] = input.value;

    });

    await setDoc(
        doc(db, "reports", REPORT_ID),
        data,
        { merge: true }
    );

    console.log("자동저장 완료");
}

async function loadReport() {

    const snap =
        await getDoc(doc(db, "reports", REPORT_ID));

    if (!snap.exists()) return;

    const data = snap.data();

    document.querySelectorAll(".report-input")
        .forEach(input => {

            const key = input.dataset.key;

            input.value =
                data[key] || input.value;

        });

    updateTotal();
}

document.addEventListener("input", e => {

    if (!e.target.classList.contains("report-input"))
        return;

    updateTotal();

    clearTimeout(e.target.saveTimer);

    e.target.saveTimer = setTimeout(() => {

        saveReport();

    }, 300);

});

window.addEventListener("load", loadReport);
const buttons =
    document.querySelectorAll(".tab-btn");

const pages =
    document.querySelectorAll(".tab-page");

buttons.forEach(button => {

    button.addEventListener("click", () => {

        const target =
            button.dataset.tab;

        buttons.forEach(btn =>
            btn.classList.remove("active")
        );

        pages.forEach(page =>
            page.classList.remove("active")
        );

        button.classList.add("active");

        document
            .getElementById(target)
            .classList.add("active");

    });

});