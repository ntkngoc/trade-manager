
let tradingData = [];
let filteredData = [];
let charts = {};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const pairFilter = document.getElementById('pairFilter');
    const directionFilter = document.getElementById('directionFilter');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
        console.log('File input event listener added');
    }
    
    if (pairFilter) pairFilter.addEventListener('change', applyFilters);
    if (directionFilter) directionFilter.addEventListener('change', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
});

function handleFileUpload(event) {
    console.log('File upload triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    console.log('File selected:', file.name);
    const statusDiv = document.getElementById('fileStatus');
    statusDiv.innerHTML = '⏳ Đang xử lý file...';
    statusDiv.className = 'status-loading';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            console.log('File loaded, processing...');
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            console.log('Raw data:', jsonData);
            processTradingData(jsonData);
            
            statusDiv.innerHTML = '✅ File đã được tải thành công! Đã xử lý ' + jsonData.length + ' dòng dữ liệu.';
            statusDiv.className = 'status-success';
        } catch (error) {
            console.error('Error processing file:', error);
            statusDiv.innerHTML = '❌ Lỗi khi đọc file: ' + error.message;
            statusDiv.className = 'status-error';
        }
    };
    
    reader.onerror = function(error) {
        console.error('File reader error:', error);
        statusDiv.innerHTML = '❌ Lỗi khi đọc file';
        statusDiv.className = 'status-error';
    };
    
    reader.readAsArrayBuffer(file);
}

function processTradingData(data) {
    console.log('Processing trading data...');
    
    tradingData = data.map((row, index) => {
        try {
            const trade = {
                pair: row['Cặp giao dịch'] || row['Trading Pair'] || '',
                openTime: new Date(row['Thời gian mở'] || row['Open Time'] || ''),
                closeTime: new Date(row['Thời gian đóng'] || row['Close Time'] || ''),
                direction: row['Phương hướng'] || row['Direction'] || '',
                openPrice: parseFloat(String(row['Giá mở trung bình'] || row['Average Open Price'] || '0').replace(/,/g, '')),
                closePrice: parseFloat(String(row['Giá đóng trung bình'] || row['Average Close Price'] || '0').replace(/,/g, '')),
                quantity: parseFloat(String(row['Số lượng đóng (Cont)'] || row['Close Quantity'] || '0').replace(/,/g, '')),
                pnl: parseFloat(String(row['PNL đã thực hiện'] || row['Realized PNL'] || '0').replace(/[^\d.-]/g, '')),
                fee: parseFloat(String(row['Phí giao dịch'] || row['Trading Fee'] || '0').replace(/[^\d.-]/g, '')),
                margin: row['Chế độ Margin'] || row['Margin Mode'] || '',
                status: row['Trạng thái'] || row['Status'] || ''
            };
            
            // Validate essential fields
            if (!trade.pair || isNaN(trade.pnl)) {
                console.warn('Invalid trade data at row', index, trade);
                return null;
            }
            
            return trade;
        } catch (error) {
            console.error('Error processing row', index, error);
            return null;
        }
    }).filter(trade => trade !== null);
    
    console.log('Processed trading data:', tradingData);
    
    if (tradingData.length === 0) {
        document.getElementById('fileStatus').innerHTML = '⚠️ Không tìm thấy dữ liệu hợp lệ trong file';
        document.getElementById('fileStatus').className = 'status-error';
        return;
    }
    
    filteredData = [...tradingData];
    setupFilters();
    updateDashboard();
    
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('noData').style.display = 'none';
}

function setupFilters() {
    const pairs = [...new Set(tradingData.map(t => t.pair))].sort();
    const pairFilter = document.getElementById('pairFilter');
    pairFilter.innerHTML = '<option value="">Tất cả</option>';
    pairs.forEach(pair => {
        const option = document.createElement('option');
        option.value = pair;
        option.textContent = pair;
        pairFilter.appendChild(option);
    });
    
    // Set date range
    const dates = tradingData.map(t => t.openTime).filter(d => !isNaN(d));
    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        document.getElementById('dateFrom').value = minDate.toISOString().split('T')[0];
        document.getElementById('dateTo').value = maxDate.toISOString().split('T')[0];
    }
}

function applyFilters() {
    const pairFilter = document.getElementById('pairFilter').value;
    const directionFilter = document.getElementById('directionFilter').value;
    const dateFrom = new Date(document.getElementById('dateFrom').value || '1900-01-01');
    const dateTo = new Date(document.getElementById('dateTo').value || '2100-12-31');
    
    filteredData = tradingData.filter(trade => {
        return (!pairFilter || trade.pair === pairFilter) &&
               (!directionFilter || trade.direction === directionFilter) &&
               (trade.openTime >= dateFrom && trade.openTime <= dateTo);
    });
    
    updateDashboard();
}

function updateDashboard() {
    updateStats();
    updateCharts();
    updateTable();
}

function updateStats() {
    const totalTrades = filteredData.length;
    const totalPNL = filteredData.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = filteredData.filter(trade => trade.pnl > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
    const avgProfit = totalTrades > 0 ? (totalPNL / totalTrades) : 0;
    
    document.getElementById('totalTrades').textContent = totalTrades.toLocaleString();
    document.getElementById('totalPNL').textContent = totalPNL.toFixed(2) + ' USDT';
    document.getElementById('totalPNL').className = totalPNL >= 0 ? 'value positive' : 'value negative';
    document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('avgProfit').textContent = avgProfit.toFixed(2) + ' USDT';
    document.getElementById('avgProfit').className = avgProfit >= 0 ? 'value positive' : 'value negative';
}

function updateCharts() {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts = {};
    
    createPNLChart();
    createPairChart();
    createDirectionChart();
    createPNLByPairChart();
}

function createPNLChart() {
    const ctx = document.getElementById('pnlChart');
    if (!ctx) return;
    
    const sortedData = [...filteredData].sort((a, b) => a.closeTime - b.closeTime);
    
    let cumulativePNL = 0;
    const chartData = sortedData.map(trade => {
        cumulativePNL += trade.pnl;
        return {
            x: trade.closeTime.toISOString().split('T')[0],
            y: cumulativePNL
        };
    });
    
    charts.pnlChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'PNL Tích Lũy',
                data: chartData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Thời gian'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'PNL (USDT)'
                    }
                }
            }
        }
    });
}

function createPairChart() {
    const ctx = document.getElementById('pairChart');
    if (!ctx) return;
    
    const pairCounts = {};
    filteredData.forEach(trade => {
        pairCounts[trade.pair] = (pairCounts[trade.pair] || 0) + 1;
    });
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    
    charts.pairChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(pairCounts),
            datasets: [{
                data: Object.values(pairCounts),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createDirectionChart() {
    const ctx = document.getElementById('directionChart');
    if (!ctx) return;
    
    const directionData = {
        Long: filteredData.filter(t => t.direction === 'Long').length,
        Short: filteredData.filter(t => t.direction === 'Short').length
    };
    
    charts.directionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Long', 'Short'],
            datasets: [{
                label: 'Số Giao Dịch',
                data: [directionData.Long, directionData.Short],
                backgroundColor: ['#00c851', '#ff4444'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createPNLByPairChart() {
    const ctx = document.getElementById('pnlByPairChart');
    if (!ctx) return;
    
    const pairPNL = {};
    filteredData.forEach(trade => {
        pairPNL[trade.pair] = (pairPNL[trade.pair] || 0) + trade.pnl;
    });
    
    const pairs = Object.keys(pairPNL);
    const pnls = Object.values(pairPNL);
    
    charts.pnlByPairChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pairs,
            datasets: [{
                label: 'PNL (USDT)',
                data: pnls,
                backgroundColor: pnls.map(pnl => pnl >= 0 ? '#00c851' : '#ff4444'),
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'PNL (USDT)'
                    }
                }
            }
        }
    });
}

function updateTable() {
    const tbody = document.querySelector('#tradesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    filteredData.slice(0, 100).forEach(trade => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${trade.pair}</td>
            <td>${trade.openTime.toLocaleString('vi-VN')}</td>
            <td>${trade.closeTime.toLocaleString('vi-VN')}</td>
            <td><span style="color: ${trade.direction === 'Long' ? '#00c851' : '#ff4444'}">${trade.direction}</span></td>
            <td>${trade.openPrice.toLocaleString()}</td>
            <td>${trade.closePrice.toLocaleString()}</td>
            <td>${trade.quantity.toLocaleString()}</td>
            <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnl.toFixed(4)} USDT</td>
            <td>${trade.fee.toFixed(4)} USDT</td>
        `;
    });
    
    if (filteredData.length > 100) {
        const row = tbody.insertRow();
        row.innerHTML = `<td colspan="9" style="text-align: center; color: #666; font-style: italic;">Hiển thị 100 giao dịch đầu tiên. Tổng cộng: ${filteredData.length} giao dịch</td>`;
    }
}