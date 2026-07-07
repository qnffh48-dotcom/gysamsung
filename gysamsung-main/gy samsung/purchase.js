import {
    db,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs
} from "./firebase.js";

let purchaseItems = [];

const yearSelect = document.getElementById("purchaseYear");
const monthSelect = document.getElementById("purchaseMonth");
const roundSelect = document.getElementById("purchaseRound");

const itemName = document.getElementById("itemName");
const itemQty = document.getElementById("itemQty");
const itemPrice = document.getElementById("itemPrice");
const itemDept = document.getElementById("itemDept");
const itemType = document.getElementById("itemType");

const supplyList = document.getElementById("supplyList");
const snackList = document.getElementById("snackList");

const supplyTotal = document.getElementById("supplyTotal");
const snackTotal = document.getElementById("snackTotal");

const today = new Date();

for (let y = 2024; y <= 2035; y++) {
    yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
}

for (let m = 1; m <= 12; m++) {
    monthSelect.innerHTML += `<option value="${m}">${m}월</option>`;
}

yearSelect.value = today.getFullYear();
monthSelect.value = today.getMonth() + 1;

function getPurchaseKey() {
    return `${yearSelect.value}-${monthSelect.value}-${roundSelect.value}`;
}

function money(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
}

function clearForm() {
    itemName.value = "";
    itemQty.value = 1;
    itemPrice.value = "";
    itemDept.value = "";
    itemType.value = "물품";
}

document.getElementById("addItemBtn").addEventListener("click", () => {
    const item = {
        name: itemName.value.trim(),
        qty: Number(itemQty.value) || 1,
        price: Number(itemPrice.value) || 0,
        dept: itemDept.value.trim() || "미지정",
        type: itemType.value
    };

    if (!item.name) {
        alert("품목명을 입력해주세요");
        return;
    }

    purchaseItems.push(item);
    clearForm();
    renderLists();
});

function groupSort(items) {
    return [...items].sort((a, b) => {
        if (a.dept === b.dept) return a.name.localeCompare(b.name, "ko");
        return a.dept.localeCompare(b.dept, "ko");
    });
}

function renderLists() {
    const supplies = groupSort(purchaseItems.filter(item => item.type === "물품"));
    const snacks = groupSort(purchaseItems.filter(item => item.type === "간식"));

    supplyList.innerHTML = supplies.map(item => renderRow(item)).join("");
    snackList.innerHTML = snacks.map(item => renderRow(item)).join("");

    const supplySum = supplies.reduce((sum, item) => sum + item.qty * item.price, 0);
    const snackSum = snacks.reduce((sum, item) => sum + item.qty * item.price, 0);

    supplyTotal.textContent = money(supplySum);
    snackTotal.textContent = money(snackSum);
}

function renderRow(item) {
    const index = purchaseItems.indexOf(item);

    return `
        <tr>
            <td>${item.dept}</td>
            <td>${item.name}</td>
            <td>${item.qty}개</td>
            <td>${money(item.qty * item.price)}</td>
            <td>
                <button class="delete-btn" onclick="deletePurchaseItem(${index})">
                    삭제
                </button>
            </td>
        </tr>
    `;
}

window.deletePurchaseItem = function(index) {
    purchaseItems.splice(index, 1);
    renderLists();
};

document.getElementById("saveBtn").addEventListener("click", async () => {
    const key = getPurchaseKey();

    await setDoc(
        doc(db, "purchaseRequests", key),
        {
            year: Number(yearSelect.value),
            month: Number(monthSelect.value),
            round: Number(roundSelect.value),
            items: purchaseItems,
            updatedAt: Date.now()
        },
        { merge: true }
    );

    alert(`${yearSelect.value}년 ${monthSelect.value}월 ${roundSelect.value}일 신청 저장 완료`);
});

yearSelect.addEventListener("change", loadPurchase);
monthSelect.addEventListener("change", loadPurchase);
roundSelect.addEventListener("change", loadPurchase);

async function loadPurchase() {
    const key = getPurchaseKey();

    const snap = await getDoc(doc(db, "purchaseRequests", key));

    if (!snap.exists()) {
        purchaseItems = [];
        renderLists();
        alert("저장된 신청 목록이 없습니다");
        return;
    }

    purchaseItems = snap.data().items || [];
    renderLists();
}

document.getElementById("searchBtn").addEventListener("click", searchPurchase);

async function searchPurchase() {
    const keyword = document.getElementById("searchInput").value.trim();
    const tbody = document.getElementById("searchResult");

    if (!keyword) {
        alert("검색어를 입력해주세요");
        return;
    }

    const snap = await getDocs(collection(db, "purchaseRequests"));

    const results = [];

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const items = data.items || [];

        items.forEach(item => {
            const targetText = `${item.name} ${item.dept} ${item.type}`;

            if (targetText.includes(keyword)) {
                results.push({
                    date: `${data.year}년 ${data.month}월 ${data.round}일`,
                    ...item
                });
            }
        });
    });

    tbody.innerHTML = results.map(item => `
        <tr>
            <td>${item.date}</td>
            <td>${item.type}</td>
            <td>${item.dept}</td>
            <td>${item.name}</td>
            <td>${item.qty}개</td>
            <td>${money(item.qty * item.price)}</td>
        </tr>
    `).join("");

    if (results.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">검색 결과가 없습니다</td>
            </tr>
        `;
    }
}

loadPurchase();