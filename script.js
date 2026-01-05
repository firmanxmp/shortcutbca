let globalData = [];

function clearInput() {
    document.getElementById('inputText').value = '';
    document.getElementById('inputText').focus();
}

function formatRupiah(angka) {
    return "Rp " + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(angka);
}

function processData() {
    const input = document.getElementById('inputText').value;
    const tableBody = document.querySelector('#resultTable tbody');
    const statsDiv = document.getElementById('dashboardStats');
    const emptyState = document.getElementById('emptyState');
    const resultTable = document.getElementById('resultTable');
    
    if (!input.trim()) {
        alert("Silakan tempel data mutasi terlebih dahulu!");
        return;
    }

    const rawLines = input.split('\n');
    let blocks = [];
    let currentBlockLines = [];
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/; 

    rawLines.forEach(lineRaw => {
        let line = lineRaw.trim();
        if (!line) return;

        const isHeader = (line === 'PEND') || dateRegex.test(line);

        if (isHeader) {
            if (currentBlockLines.length > 0) blocks.push(currentBlockLines);
            currentBlockLines = [line];
        } else {
            currentBlockLines.push(line);
        }
    });
    if (currentBlockLines.length > 0) blocks.push(currentBlockLines);

    let validTransactions = [];
    let grandTotal = 0;

    blocks.forEach(lines => {
        if (lines.length < 3) return;

        let isIncoming = false;
        let typeLine = "";
        
        for (let l of lines) {
            if (l.includes('TRSF E-BANKING') || l.includes('BI-FAST') || l.includes('SWITCHING') || l.includes('SETORAN VIA CDM')) {
                typeLine = l;
                break;
            }
        }
        
        if (lines.some(l => l === 'CR' || l.endsWith(' CR'))) isIncoming = true; 
        if (typeLine.includes('DB')) isIncoming = false;

        if (isIncoming) {
            let amount = 0;
            let name = "Unknown";
            
            let rawAmountIndex = lines.findIndex(l => /^\d+\.00$/.test(l));
            
            if (rawAmountIndex !== -1) {
                amount = parseFloat(lines[rawAmountIndex]);
            } else {
                let index0000 = lines.findIndex(l => l === '0000');
                if (index0000 !== -1 && lines[index0000 + 1]) {
                    let potentialAmt = lines[index0000 + 1].replace(/,/g,'');
                    if (!isNaN(parseFloat(potentialAmt))) amount = parseFloat(potentialAmt);
                }
            }

            if (typeLine.includes('SWITCHING')) {
                let trfLine = lines.find(l => l.startsWith('TRF '));
                if (trfLine) {
                    let match = trfLine.match(/TRF\s+(?:\d+\s+)?(.*?)(?=\s+\d{3,}|\s*$)/);
                    if (match && match[1]) {
                        name = match[1];
                    } else {
                        name = trfLine;
                    }
                }
            }
            else if (typeLine.includes('BI-FAST')) {
                let trsfLine = lines.find(l => l.includes('TRANSFER DR'));
                if (trsfLine) {
                    let match = trsfLine.match(/TRANSFER DR\s+(?:\d+\s+)?(.*)/);
                    name = match && match[1] ? match[1] : trsfLine;
                }
            }
            else if (typeLine.includes('SETORAN VIA CDM')) {
                let cdmLine = lines.find(l => l.includes('WSID:'));
                if (cdmLine) {
                    let parts = cdmLine.split(/WSID:[A-Z0-9]+\s+/);
                    if (parts.length > 1) name = parts[1];
                    else name = cdmLine;
                }
            }
            else {
                let index0000 = lines.findIndex(l => l === '0000');
                
                if (index0000 !== -1) {
                    let lineBefore = lines[index0000 - 1];
                    let lineTwoBefore = lines[index0000 - 2];
                    
                    if (lineBefore === 'DOMPET ANAK BANGSA' || 
                        lineBefore.includes('ESPAY') || 
                        lineBefore.includes('DANA') || 
                        lineBefore.includes('OVO') ||
                        lineBefore.includes('ALTO NETWORK')) {
                        
                        name = lineTwoBefore;
                        if (name && name.startsWith('TRFDN-')) {
                            name = name.replace('TRFDN-', '');
                        } else if (name && (name.startsWith('ID') || !isNaN(name.charAt(0)))) {
                            name = name + " (" + lineBefore + ")";
                        }
                    } else {
                        name = lineBefore;
                    }
                } else {
                    if (rawAmountIndex !== -1 && lines[rawAmountIndex + 1]) {
                        name = lines[rawAmountIndex + 1];
                    }
                }
            }

            if(name) name = name.trim();

            if (amount > 0) {
                validTransactions.push({ name, amount });
                grandTotal += amount;
            }
        }
    });

    globalData = validTransactions;

    tableBody.innerHTML = '';
    if (validTransactions.length > 0) {
        emptyState.style.display = 'none';
        resultTable.style.display = 'table';
        statsDiv.style.display = 'grid';
        
        validTransactions.forEach((trx, index) => {
            let row = `
                <tr>
                    <td class="col-num">${index + 1}</td>
                    <td class="col-name">${trx.name}</td>
                    <td class="col-amount">${formatRupiah(trx.amount)}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        document.getElementById('totalCount').innerText = validTransactions.length;
        document.getElementById('totalAmount').innerText = formatRupiah(grandTotal);
    } else {
        emptyState.style.display = 'flex';
        statsDiv.style.display = 'none';
        resultTable.style.display = 'none';
        alert("Tidak ditemukan transaksi dana masuk yang valid.");
    }
}

function copyForSheets() {
    if (globalData.length === 0) {
        alert("Tidak ada data untuk disalin.");
        return;
    }

    let textToCopy = "";
    globalData.forEach(trx => {
        textToCopy += `${trx.name}\t${trx.amount}\n`;
    });

    navigator.clipboard.writeText(textToCopy).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalContent = btn.innerHTML;
        btn.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right:8px">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Tersalin!
        `;
        btn.style.color = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 2000);
    }).catch(err => {
        alert("Gagal menyalin: " + err);
    });
}
