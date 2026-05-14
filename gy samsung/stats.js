const excelFile = document.getElementById("excelFile");

let mainChart = null;

excelFile.addEventListener("change", async function (e) {
    const file = e.target.files[0];

    if (!file) return;

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
        type: "array"
    });

    const sheetName = workbook.SheetNames.includes("통계")
        ? "통계"
        : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
    });

    localStorage.setItem("stats_rows", JSON.stringify(rows));

    renderStats(rows);
});

function renderStats(rows) {
    const tableInfo = findMainTable(rows);

    if (!tableInfo) {
        alert("진료실 통계표를 찾지 못했습니다.");
        return;
    }

    const { headers, dataRows } = tableInfo;

    renderSummary(headers, dataRows);
    renderMainTable(headers, dataRows);
    renderChart(headers, dataRows);
    renderInjectionStats(rows);
}

function findMainTable(rows) {
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];

        const startCol = row.findIndex(cell =>
            String(cell).trim() === "진료실"
        );

        if (startCol === -1) continue;

        const headers = row.slice(startCol).filter(h => h !== "");

        const dataRows = [];

        for (let i = r + 1; i < rows.length; i++) {
            const line = rows[i].slice(startCol);

            if (!line[0]) break;

            dataRows.push(line);

            if (String(line[0]).includes("총합")) break;
        }

        return {
            headers,
            dataRows
        };
    }

    return null;
}

function col(headers, name) {
    return headers.findIndex(h =>
        String(h).trim() === name
    );
}

function num(value) {
    if (typeof value === "number") return value;

    return Number(
        String(value)
            .replace(/[₩,%]/g, "")
            .replace(/,/g, "")
            .trim()
    ) || 0;
}

function renderSummary(headers, rows) {
    const total = rows.find(row =>
        String(row[0]).includes("총합")
    );

    const summaryGrid = document.getElementById("summaryGrid");

    summaryGrid.innerHTML = `
        <div class="summary-card">
            <span>초진수</span>
            <strong>${total?.[col(headers, "초진수")] || 0}</strong>
        </div>

        <div class="summary-card">
            <span>재진수</span>
            <strong>${total?.[col(headers, "재진수")] || 0}</strong>
        </div>

        <div class="summary-card">
            <span>총 내원</span>
            <strong>${total?.[col(headers, "합계")] || 0}</strong>
        </div>

        <div class="summary-card">
            <span>재진률</span>
            <strong>${total?.[col(headers, "재진률")] || "-"}</strong>
        </div>

        <div class="summary-card wide">
            <span>총 진료비</span>
            <strong>${total?.[col(headers, "총 진료비")] || "-"}</strong>
        </div>
    `;
}

function renderMainTable(headers, rows) {
    const table = document.getElementById("mainStatsTable");

    table.innerHTML = `
        <thead>
            <tr>
                ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
        </thead>

        <tbody>
            ${rows.map(row => `
                <tr class="${String(row[0]).includes("총합") ? "total-row" : ""}">
                    ${headers.map((_, i) => `
<td>${
    !isNaN(parseFloat(
        String(row[i]).replace(/[₩,%]/g, "")
    ))
        ? Number(
            String(row[i]).replace(/[₩,%]/g, "")
        ).toFixed(2) +
          (String(row[i]).includes("%") ? "%" : "")
        : row[i]
}</td>
`).join("")}
                </tr>
            `).join("")}
        </tbody>
    `;
}

function renderChart(headers, rows) {
    const normalRows = rows.filter(row =>
        !String(row[0]).includes("총합")
    );

    const labels = normalRows.map(row => row[0]);

    const injectionRateIndex = col(headers, "주사 처방률");
    const revisitRateIndex = col(headers, "재내원률");
    const avgInjectionIndex = col(headers, "평균 주사 횟수");

    const injectionRates = normalRows.map(row =>
    Number(num(row[injectionRateIndex]).toFixed(2))
);

const revisitRates = normalRows.map(row =>
    Number(num(row[revisitRateIndex]).toFixed(2))
);

const avgInjections = normalRows.map(row =>
    Number(num(row[avgInjectionIndex]).toFixed(2))
);

    if (mainChart) {
        mainChart.destroy();
    }

    mainChart = new Chart(document.getElementById("mainChart"), {
        data: {
            labels,
            datasets: [
                {
    type: "bar",
    label: "주사 처방률",
    data: injectionRates,
    barThickness: 32
},
                {
                    type: "bar",
                    label: "재내원률",
                    data: revisitRates,
                    barThickness: 32
                },
                {
    type: "line",
    label: "평균 주사 횟수",
    data: avgInjections,
    borderWidth: 2,
    pointRadius: 3
}
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderInjectionStats(rows) {
    const grid = document.getElementById("injectionGrid");

    grid.innerHTML = "";

    const blocks = [];

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];

        const startCol = row.findIndex(cell =>
            String(cell).trim() === "초진주사"
        );

        if (startCol === -1) continue;

        const title = row[startCol + 1] || "";
        const headers = row.slice(startCol + 2, startCol + 8);
        const values = rows[r + 1]?.slice(startCol + 2, startCol + 8) || [];
        const rates = rows[r + 2]?.slice(startCol + 2, startCol + 8) || [];

        blocks.push({
            title,
            total: rows[r + 1]?.[startCol] || "",
            avg: rows[r + 2]?.[startCol] || "",
            headers,
            values,
            rates
        });
    }

    blocks.forEach(block => {
        grid.innerHTML += `
            <div class="injection-card">
                <h3>${String(block.title).replace(/\n/g, "<br>")}</h3>

                <div class="inject-info">
                    <span>초진주사 ${block.total}</span>
                    <strong>평균 ${block.avg}</strong>
                </div>

                <table>
                    <thead>
                        <tr>
                            ${block.headers.map(h => `<th>${h}</th>`).join("")}
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            ${block.values.map(v => `<td>${v}</td>`).join("")}
                        </tr>

                        <tr>
                            ${block.rates.map(v => `<td>${v}</td>`).join("")}
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });
}

const savedRows = localStorage.getItem("stats_rows");

if (savedRows) {
    renderStats(JSON.parse(savedRows));
}