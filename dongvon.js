const fileInput = document.getElementById('fileInput');
  const dailyTransactionChartCanvas = document.getElementById('dailyTransactionChart');
  const dailyInflowOutflowChartCanvas = document.getElementById('dailyInflowOutflowChart');
  const pairBarChartCanvas = document.getElementById('pairBarChart');
  const pairPieChartCanvas = document.getElementById('pairPieChart');
  const loadingOverlay = document.getElementById('loadingOverlay');

  const totalTransactions = document.getElementById('totalTransactions');
  const totalInflow = document.getElementById('totalInflow');
  const topPair = document.getElementById('topPair');
  const totalFunding = document.getElementById('totalFunding');
  const totalClosePosition = document.getElementById('totalClosePosition');
  const totalFee = document.getElementById('totalFee');
  const totalTransfer = document.getElementById('totalTransfer');
  const totalProfit = document.getElementById('totalProfit');
  const totalLoss = document.getElementById('totalLoss');
  const dailyProfitLossChartCanvas = document.getElementById('dailyProfitLossChart');


  let dailyTransactionChart, dailyInflowOutflowChart, pairBarChart, pairPieChart;

  fileInput.addEventListener('change', handleFile);

  function showLoading() {
    loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    loadingOverlay.style.display = 'none';
  }

  function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading();

    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      setTimeout(() => {
        analyzeData(jsonData);
        hideLoading();
      }, 500);
    };
    reader.readAsArrayBuffer(file);
  }

  function analyzeData(data) {
    const [headers, ...rows] = data;
    const timeIndex = headers.indexOf('Thời gian');
    const inflowIndex = headers.indexOf('Số tiền');
    const pairIndex = headers.indexOf('Cặp giao dịch Futures');
    const typeIndex = headers.indexOf('Loại tài sản');
    const flowTypeIndex = headers.indexOf('Kiểu Luồng Vốn');

    if (
        timeIndex === -1 ||
        inflowIndex === -1 ||
        pairIndex === -1 ||
        typeIndex === -1 ||
        flowTypeIndex === -1
    ) {
        alert('Không tìm thấy cột cần thiết trong dữ liệu.');
        return;
    }

    // Tổng hợp các biến phân tích
    const dailyTransactions = {};
    const dailyInflowOutflow = {};
    const pairCounts = {};
    const pairInflow = {};
    const assetTypeTotals = {};
    let inflow = 0;

    rows.forEach(row => {
        const time = row[timeIndex];
        const amount = parseFloat(row[inflowIndex]) || 0;
        const pair = row[pairIndex];
        const assetType = row[typeIndex];

        if (!assetType) return;
        if (!assetTypeTotals[assetType]) assetTypeTotals[assetType] = 0;
        assetTypeTotals[assetType] += amount;

        if (!time) return;

        const date = new Date(time).toISOString().split('T')[0];

        // Tổng số giao dịch mỗi ngày
        dailyTransactions[date] = (dailyTransactions[date] || 0) + 1;

        // Tổng Inflow và Outflow mỗi ngày
        if (!dailyInflowOutflow[date]) {
            dailyInflowOutflow[date] = { inflow: 0, outflow: 0 };
        }
        if (amount > 0) {
            dailyInflowOutflow[date].inflow += amount;
            inflow += amount;
        } else {
            dailyInflowOutflow[date].outflow += Math.abs(amount);
        }

        // Phân tích theo cặp giao dịch
        if (pair) {
            pairCounts[pair] = (pairCounts[pair] || 0) + 1;
            pairInflow[pair] = (pairInflow[pair] || 0) + amount;
        }
    });

    // Hiển thị tổng theo loại tài sản lên UI
    Object.entries(assetTypeTotals).forEach(([type, total]) => {
        switch (type) {
            case 'FUNDING':
                totalFunding.textContent = total.toFixed(4);
                break;
            case 'CLOSE_POSITION':
                totalClosePosition.textContent = total.toFixed(4);
                break;
            case 'FEE':
                totalFee.textContent = total.toFixed(4);
                break;
            case 'TRANSFER':
                totalTransfer.textContent = total.toFixed(4);
                break;
            default:
                break;
        }
    });

    // Animate numbers
    animateValue(totalTransactions, 0, rows.length, 1000);
    animateValue(totalInflow, 0, inflow, 1000, true);
    animateValue(totalFunding, 0, totalFunding.textContent, 1000, true);
    animateValue(totalClosePosition, 0, totalClosePosition.textContent, 1000, true);
    animateValue(totalFee, 0, totalFee.textContent, 1000, true);
    animateValue(totalTransfer, 0, totalTransfer.textContent, 1000, true);

    // Cặp giao dịch có số lượng nhiều nhất
    const topPairName = Object.keys(pairCounts).reduce((a, b) => pairCounts[a] > pairCounts[b] ? a : b, 'N/A');
    topPair.textContent = topPairName;

    // Vẽ các biểu đồ tổng hợp
    renderDailyTransactionChart(dailyTransactions);
    renderDailyInflowOutflowChart(dailyInflowOutflow);
    renderPairBarChart(pairCounts);
    renderPairPieChart(pairInflow);

    // --- PHÂN TÍCH LÃI/LỖ THEO NGÀY ---
    // Chuẩn bị index cho các cột
    const headerIndex = {};
    headers.forEach((h, idx) => headerIndex[h] = idx);

    // const closePositions = rows.filter(row =>
    //     row[headerIndex['Loại tài sản']] === 'CLOSE_POSITION' &&
    //     row[headerIndex['Kiểu Luồng Vốn']] === 'Inflow'
    // );
    const closePositions = rows.filter(row =>
        row[headerIndex['Loại tài sản']] === 'CLOSE_POSITION' ||
        row[headerIndex['Loại tài sản']] === 'FEE' ||
        row[headerIndex['Loại tài sản']] === 'FUNDING'
    );

    // Tính tổng lãi, tổng lỗ, và tổng hợp theo ngày
    let profit = 0;
    let loss = 0;
    let profitLossByDate = {};

    closePositions.forEach(row => {
      if (row[headerIndex['Loại tài sản']] === 'CLOSE_POSITION') {
        const amount = parseFloat(row[headerIndex['Số tiền']]) || 0;
        console.log(amount);
        const date = new Date(row[headerIndex['Thời gian']]).toISOString().split('T')[0];
        if (!profitLossByDate[date]) profitLossByDate[date] = 0;
        profitLossByDate[date] += amount;

        if (amount >= 0) profit += amount;
        else loss += amount; // loss là số âm
      }
    });

    // Cập nhật tổng lãi/lỗ lên UI
    totalProfit.textContent = profit.toFixed(2);
    totalLoss.textContent = Math.abs(loss).toFixed(2);

    // Vẽ biểu đồ lãi/lỗ theo ngày
    renderDailyProfitLossChart(profitLossByDate);
}



  function animateValue(element, start, end, duration, isDecimal = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = progress * (end - start) + start;
      element.textContent = isDecimal ? value.toFixed(2) : Math.floor(value);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  function renderDailyTransactionChart(dailyTransactions) {
    const labels = Object.keys(dailyTransactions);
    const data = Object.values(dailyTransactions);

    if (dailyTransactionChart) dailyTransactionChart.destroy();

    dailyTransactionChart = new Chart(dailyTransactionChartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Số lượng giao dịch mỗi ngày',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    });
  }

  function renderDailyInflowOutflowChart(dailyInflowOutflow) {
    const labels = Object.keys(dailyInflowOutflow);
    const inflowData = labels.map(date => dailyInflowOutflow[date].inflow);
    const outflowData = labels.map(date => dailyInflowOutflow[date].outflow);

    if (dailyInflowOutflowChart) dailyInflowOutflowChart.destroy();

    dailyInflowOutflowChart = new Chart(dailyInflowOutflowChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Dòng tiền vào (Inflow)',
            data: inflowData,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Dòng tiền ra (Outflow)',
            data: outflowData,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    });
  }

  function renderPairBarChart(pairCounts) {
    const labels = Object.keys(pairCounts);
    const data = Object.values(pairCounts);

    if (pairBarChart) pairBarChart.destroy();

    pairBarChart = new Chart(pairBarChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Số lượng giao dịch theo cặp',
          data,
          backgroundColor: 'rgba(79, 172, 254, 0.8)',
          borderColor: 'rgba(79, 172, 254, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    });
  }

  function renderPairPieChart(pairInflow) {
    const labels = Object.keys(pairInflow);
    const data = Object.values(pairInflow);

    if (pairPieChart) pairPieChart.destroy();

    const colors = [
      'rgba(99, 102, 241, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(6, 182, 212, 0.8)',
      'rgba(34, 197, 94, 0.8)',
    ];

    pairPieChart = new Chart(pairPieChartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: colors.map(color => color.replace('0.8', '1')),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
            }
          }
        }
      }
    });
  }

  function renderDailyProfitLossChart(profitLossByDate) {
    const labels = Object.keys(profitLossByDate);
    const profitLossArr = labels.map(date => profitLossByDate[date]);

    // Destroy chart cũ nếu có
    if (dailyProfitLossChart && typeof dailyProfitLossChart.destroy === 'function') {
        dailyProfitLossChart.destroy();
    }

    dailyProfitLossChart = new Chart(dailyProfitLossChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Lãi/Lỗ',
          data: profitLossArr,
          backgroundColor: profitLossArr.map(val =>
            val >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'
          ),
          borderColor: profitLossArr.map(val =>
            val >= 0 ? 'rgba(16,185,129,1)' : 'rgba(239,68,68,1)'
          ),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: function(value) {
                return value >= 0 ? '+' + value : value;
              }
            }
          },
          x: {
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
        }
      }
    });
}
