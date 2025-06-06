// Global variables
let transactions = [];
let filteredTransactions = [];
let currentPage = 1;
let pageSize = 100;
let sortColumn = -1;
let sortDirection = 'asc';
let currentFileName = '';

// Chart instances
let charts = {};

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
  setupEventListeners();
});

function setupEventListeners() {
  // File input events
  const fileInput = document.getElementById('fileInput');
  const fileUploadArea = document.getElementById('fileUploadArea');
  const importNewBtn = document.getElementById('importNewBtn');

  if (fileInput) fileInput.addEventListener('change', handleFileSelect);
  if (importNewBtn) importNewBtn.addEventListener('click', showImportSection);

  // Drag and drop events
  if (fileUploadArea) {
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleFileDrop);
    fileUploadArea.addEventListener('click', function () {
      if (fileInput) fileInput.click();
    });
  }

  // Filter events
  const transactionTypeFilter = document.getElementById('transactionTypeFilter');
  const tradingPairFilter = document.getElementById('tradingPairFilter');
  const dateFromFilter = document.getElementById('dateFromFilter');
  const dateToFilter = document.getElementById('dateToFilter');
  const resetFiltersBtn = document.getElementById('resetFilters');

  if (transactionTypeFilter) transactionTypeFilter.addEventListener('change', applyFilters);
  if (tradingPairFilter) tradingPairFilter.addEventListener('change', applyFilters);
  if (dateFromFilter) dateFromFilter.addEventListener('change', applyFilters);
  if (dateToFilter) dateToFilter.addEventListener('change', applyFilters);
  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);

  // Table events
  const searchInput = document.getElementById('searchInput');
  const pageSize = document.getElementById('pageSize');
  const exportBtn = document.getElementById('exportBtn');

  if (searchInput) searchInput.addEventListener('input', handleSearch);
  if (pageSize) pageSize.addEventListener('change', handlePageSizeChange);
  if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
}

// File handling functions
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('dragover');
}

function handleFileDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');

  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function processFile(file) {
  currentFileName = file.name;
  showLoading();

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      parseExcelData(jsonData);
      showSuccessMessage('File đã được tải thành công!');
    } catch (error) {
      console.error('Error processing file:', error);
      showErrorMessage('Lỗi khi xử lý file. Vui lòng kiểm tra định dạng file.');
    }
  };

  reader.onerror = function () {
    showErrorMessage('Lỗi khi đọc file.');
  };

  reader.readAsArrayBuffer(file);
}

function parseExcelData(data) {
  if (data.length < 2) {
    showErrorMessage('File không có dữ liệu hợp lệ.');
    return;
  }

  const headers = data[0];
  transactions = [];

  console.log('Headers:', headers);

  // Map các cột theo thứ tự trong file Excel
  const columnMap = {
    time: 0, // Thời gian
    pair: 1, // Cặp giao dịch Futures
    crypto: 2, // Tiền điện tử
    assetType: 3, // Loại tài sản
    flowType: 4, // Kiểu Luồng Vốn
    amount: 5, // Số tiền
    empty1: 6, // Cột trống
    coin: 7, // Coin
    orders: 8, // Số Lệnh
    profit: 9, // Tổng Lãi/Lỗ
    fee: 10, // Tổng Phí
    total: 11, // Tổng
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Bỏ qua các dòng không có thời gian
    if (!row[columnMap.time]) continue;

    const transaction = {
      time: row[columnMap.time] || '',
      pair: row[columnMap.pair] || 'N/A',
      crypto: row[columnMap.crypto] || '',
      assetType: row[columnMap.assetType] || '',
      flowType: row[columnMap.flowType] || '',
      amount: parseFloat(row[columnMap.amount]) || 0,
      coin: row[columnMap.coin] || 'N/A',
      orders: parseFloat(row[columnMap.orders]) || 0,
      profit: parseFloat(row[columnMap.profit]) || 0,
      fee: parseFloat(row[columnMap.fee]) || 0,
      total: parseFloat(row[columnMap.total]) || 0,
    };

    // Chỉ thêm các giao dịch có thời gian hợp lệ
    if (transaction.time && transaction.time !== '') {
      transactions.push(transaction);
    }
  }

  console.log('Parsed transactions:', transactions.length);

  if (transactions.length === 0) {
    showErrorMessage('Không tìm thấy dữ liệu giao dịch hợp lệ trong file.');
    return;
  }

  filteredTransactions = [...transactions];
  initializeDashboard();
}

function initializeDashboard() {
  hideLoading();
  const importSection = document.getElementById('importSection');
  const dashboard = document.getElementById('dashboard');

  if (importSection) importSection.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';

  updateFileInfo();
  setupFilters();
  updateDashboard();
}

function showImportSection() {
  const dashboard = document.getElementById('dashboard');
  const importSection = document.getElementById('importSection');

  if (dashboard) dashboard.style.display = 'none';
  if (importSection) importSection.style.display = 'block';
}

function updateFileInfo() {
  const fileInfoDisplay = document.getElementById('fileInfoDisplay');
  if (fileInfoDisplay) {
    fileInfoDisplay.innerHTML =
      '<i class="fas fa-file"></i> ' +
      currentFileName +
      ' <span class="text-muted">(' +
      transactions.length +
      ' giao dịch)</span>';
  }
}

// Dashboard functions
function updateStats() {
  // Tính toán thống kê từ dữ liệu thực
  const totalProfit = filteredTransactions.reduce(function(sum, t) {
    return sum + (t.profit || 0);
  }, 0);
  
  const totalFees = Math.abs(filteredTransactions.reduce(function(sum, t) {
    return sum + (t.fee || 0);
  }, 0));
  
  const totalTransactions = filteredTransactions.length;
  
  // Tính số ngày giao dịch
  const uniqueDays = new Set(filteredTransactions.map(function(t) {
    try {
      const date = convertExcelDate(t.time);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }).filter(function(d) {
    return d !== '';
  })).size;
  
  // Tính tỷ lệ thắng (giao dịch có lãi)
  const profitableTransactions = filteredTransactions.filter(function(t) {
    return (t.profit || 0) > 0;
  }).length;
  
  const winRate = totalTransactions > 0 ? (profitableTransactions / totalTransactions * 100) : 0;
  
  // Tính lãi trung bình mỗi ngày
  const avgDailyProfit = uniqueDays > 0 ? totalProfit / uniqueDays : 0;

  const totalProfitEl = document.getElementById('totalProfit');
  const totalTransactionsEl = document.getElementById('totalTransactions');
  const totalFeesEl = document.getElementById('totalFees');
  const tradingDaysEl = document.getElementById('tradingDays');
  const winRateEl = document.getElementById('winRate');
  const avgProfitEl = document.getElementById('avgProfit');

  if (totalProfitEl) {
    totalProfitEl.textContent = totalProfit.toFixed(4);
    totalProfitEl.className = totalProfit >= 0 ? 'value profit' : 'value loss';
  }
  
  if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions.toLocaleString();
  if (totalFeesEl) totalFeesEl.textContent = totalFees.toFixed(4);
  if (tradingDaysEl) tradingDaysEl.textContent = uniqueDays;
  if (winRateEl) winRateEl.textContent = winRate.toFixed(1) + '%';
  if (avgProfitEl) {
    avgProfitEl.textContent = avgDailyProfit.toFixed(4);
    avgProfitEl.className = avgDailyProfit >= 0 ? 'value profit' : 'value loss';
  }
}

function createProfitChart() {
  const canvas = document.getElementById('profitChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  if (charts.profitChart) {
    charts.profitChart.destroy();
  }
  
  // Nhóm theo ngày với thông tin chi tiết hơn
  const dailyProfit = {};
  filteredTransactions.forEach(function(t) {
    try {
      const date = getDateOnly(t.time);
      if (date) {
        if (!dailyProfit[date]) {
          dailyProfit[date] = {
            total: 0,
            positive: 0,
            negative: 0,
            count: 0,
            displayDate: formatDateForChart(t.time)
          };
        }
        dailyProfit[date].total += t.profit;
        dailyProfit[date].count += 1;
        
        if (t.profit > 0) {
          dailyProfit[date].positive += t.profit;
        } else {
          dailyProfit[date].negative += t.profit;
        }
      }
    } catch (e) {
      console.warn('Invalid date format:', t.time);
    }
  });

  const sortedDates = Object.keys(dailyProfit).sort();
  const profits = sortedDates.map(function(date) {
    return dailyProfit[date].total;
  });
  const labels = sortedDates.map(function(date) {
    return dailyProfit[date].displayDate;
  });

  charts.profitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Lãi/Lỗ hàng ngày (USDT)',
        data: profits,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: profits.map(function(p) {
          return p >= 0 ? '#10b981' : '#ef4444';
        }),
        pointBorderColor: profits.map(function(p) {
          return p >= 0 ? '#10b981' : '#ef4444';
        }),
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0,0,0,0.1)'
          },
          title: {
            display: true,
            text: 'USDT'
          }
        },
        x: {
          grid: {
            color: 'rgba(0,0,0,0.1)'
          },
          title: {
            display: true,
            text: 'Ngày'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const dateKey = sortedDates[index];
              return formatDate(dateKey);
            },
            label: function(context) {
              return 'Lãi/Lỗ: ' + context.parsed.y.toFixed(4) + ' USDT';
            },
            afterLabel: function(context) {
              const index = context[0].dataIndex;
              const dateKey = sortedDates[index];
              const dayData = dailyProfit[dateKey];
              return [
                'Giao dịch: ' + dayData.count,
                'Lãi: ' + dayData.positive.toFixed(4) + ' USDT',
                'Lỗ: ' + dayData.negative.toFixed(4) + ' USDT'
              ];
            }
          }
        }
      }
    }
  });
}

function createTransactionTypeChart() {
  const canvas = document.getElementById('transactionTypeChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (charts.transactionTypeChart) {
    charts.transactionTypeChart.destroy();
  }

  // Sử dụng assetType thay vì flowType để phân loại rõ hơn
  const typeCounts = {};
  filteredTransactions.forEach(function (t) {
    const type = t.assetType || 'UNKNOWN';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const colors = [
    '#667eea',
    '#764ba2',
    '#f093fb',
    '#f5576c',
    '#4facfe',
    '#00f2fe',
    '#43e97b',
    '#38f9d7',
    '#ffecd2',
    '#fcb69f',
    '#a8edea',
    '#fed6e3',
  ];

  charts.transactionTypeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(typeCounts),
      datasets: [
        {
          data: Object.values(typeCounts),
          backgroundColor: colors.slice(0, Object.keys(typeCounts).length),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = Object.values(typeCounts).reduce(function (a, b) {
                return a + b;
              }, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return (
                context.label + ': ' + context.parsed + ' (' + percentage + '%)'
              );
            },
          },
        },
      },
    },
  });
}

function createTopPairsChart() {
  const canvas = document.getElementById('topPairsChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (charts.topPairsChart) {
    charts.topPairsChart.destroy();
  }

  const pairProfits = {};
  filteredTransactions.forEach(function (t) {
    if (t.pair && t.pair !== 'N/A' && t.pair !== '') {
      pairProfits[t.pair] = (pairProfits[t.pair] || 0) + t.profit;
    }
  });

  const sortedPairs = Object.entries(pairProfits)
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .slice(0, 10);

  if (sortedPairs.length === 0) {
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Không có dữ liệu cặp giao dịch',
      ctx.canvas.width / 2,
      ctx.canvas.height / 2
    );
    return;
  }

  charts.topPairsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedPairs.map(function (pair) {
        return pair[0];
      }),
      datasets: [
        {
          label: 'Lãi/Lỗ (USDT)',
          data: sortedPairs.map(function (pair) {
            return pair[1];
          }),
          backgroundColor: sortedPairs.map(function (pair) {
            return pair[1] >= 0
              ? 'rgba(16, 185, 129, 0.8)'
              : 'rgba(239, 68, 68, 0.8)';
          }),
          borderColor: sortedPairs.map(function (pair) {
            return pair[1] >= 0 ? '#10b981' : '#ef4444';
          }),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return 'Lãi/Lỗ: ' + context.parsed.y.toFixed(4) + ' USDT';
            },
          },
        },
      },
    },
  });
}

function createCumulativeProfitChart() {
  const canvas = document.getElementById('cumulativeProfitChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  if (charts.cumulativeProfitChart) {
      charts.cumulativeProfitChart.destroy();
  }
  
  // Sắp xếp giao dịch theo thời gian
  const sortedTransactions = [...filteredTransactions].sort(function(a, b) {
      try {
          const dateA = convertExcelDate(a.time);
          const dateB = convertExcelDate(b.time);
          return dateA - dateB;
      } catch (e) {
          return 0;
      }
  });
  
  let cumulative = 0;
  const cumulativeData = [];
  const labels = [];
  
  // Nhóm theo ngày để tránh quá nhiều điểm
  const dailyCumulative = {};
  sortedTransactions.forEach(function(t) {
      try {
          const date = convertExcelDate(t.time);
          if (!isNaN(date.getTime())) {
              const dateKey = date.toISOString().split('T')[0];
              if (!dailyCumulative[dateKey]) {
                  dailyCumulative[dateKey] = {
                      total: 0,
                      displayDate: formatDateForChart(t.time)
                  };
              }
              dailyCumulative[dateKey].total += t.profit;
          }
      } catch (e) {
          console.warn('Invalid date format:', t.time);
      }
  });
  
  const sortedDates = Object.keys(dailyCumulative).sort();
  sortedDates.forEach(function(dateKey) {
      cumulative += dailyCumulative[dateKey].total;
      cumulativeData.push(cumulative);
      labels.push(dailyCumulative[dateKey].displayDate);
  });

  charts.cumulativeProfitChart = new Chart(ctx, {
      type: 'line',
      data: {
          labels: labels,
          datasets: [{
              label: 'Lãi/Lỗ tích lũy (USDT)',
              data: cumulativeData,
              borderColor: '#764ba2',
              backgroundColor: 'rgba(118, 75, 162, 0.1)',
              tension: 0.4,
              fill: true
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  beginAtZero: true,
                  title: {
                      display: true,
                      text: 'USDT'
                  }
              },
              x: {
                  title: {
                      display: true,
                      text: 'Ngày'
                  }
              }
          },
          plugins: {
              legend: {
                  display: false
              },
              tooltip: {
                  callbacks: {
                      title: function(context) {
                          const index = context[0].dataIndex;
                          const dateKey = sortedDates[index];
                          return formatDate(dateKey);
                      },
                      label: function(context) {
                          return 'Tích lũy: ' + context.parsed.y.toFixed(4) + ' USDT';
                      }
                  }
              }
          }
      }
  });
}

function createDailyProfitChart() {
  const canvas = document.getElementById('dailyProfitChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  if (charts.dailyProfitChart) {
      charts.dailyProfitChart.destroy();
  }
  
  // Nhóm theo ngày và tính tổng lợi nhuận
  const dailyData = {};
  filteredTransactions.forEach(function(t) {
      try {
          const dateKey = getDateOnly(t.time);
          if (dateKey) {
              if (!dailyData[dateKey]) {
                  dailyData[dateKey] = {
                      profit: 0,
                      loss: 0,
                      total: 0,
                      transactions: 0,
                      displayDate: formatDateForChart(t.time)
                  };
              }
              
              if (t.profit > 0) {
                  dailyData[dateKey].profit += t.profit;
              } else {
                  dailyData[dateKey].loss += Math.abs(t.profit);
              }
              dailyData[dateKey].total += t.profit;
              dailyData[dateKey].transactions += 1;
          }
      } catch (e) {
          console.warn('Invalid date format:', t.time);
      }
  });

  const sortedDates = Object.keys(dailyData).sort();
  const labels = sortedDates.map(function(dateKey) {
      return dailyData[dateKey].displayDate;
  });
  const profits = sortedDates.map(function(dateKey) {
      return dailyData[dateKey].profit;
  });
  const losses = sortedDates.map(function(dateKey) {
      return dailyData[dateKey].loss;
  });

  charts.dailyProfitChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: labels,
          datasets: [{
              label: 'Lợi nhuận (USDT)',
              data: profits,
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderColor: '#10b981',
              borderWidth: 1
          }, {
              label: 'Thua lỗ (USDT)',
              data: losses,
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              borderColor: '#ef4444',
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  beginAtZero: true,
                  title: {
                      display: true,
                      text: 'USDT'
                  }
              },
              x: {
                  title: {
                      display: true,
                      text: 'Ngày'
                  }
              }
          },
          plugins: {
              legend: {
                  display: true,
                  position: 'top'
              },
              tooltip: {
                  callbacks: {
                      title: function(context) {
                          const index = context[0].dataIndex;
                          const dateKey = sortedDates[index];
                          return formatDate(dateKey);
                      },
                      afterLabel: function(context) {
                          const index = context[0].dataIndex;
                          const dateKey = sortedDates[index];
                          const dayData = dailyData[dateKey];
                          return [
                              'Tổng: ' + dayData.total.toFixed(4) + ' USDT',
                              'Giao dịch: ' + dayData.transactions
                          ];
                      }
                  }
              }
          }
      }
  });
}

function createHourlyActivityChart() {
  const canvas = document.getElementById('hourlyActivityChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  if (charts.hourlyActivityChart) {
      charts.hourlyActivityChart.destroy();
  }
  
  // Nhóm theo giờ trong ngày
  const hourlyData = {};
  for (let i = 0; i < 24; i++) {
      hourlyData[i] = {
          transactions: 0,
          profit: 0,
          volume: 0
      };
  }
  
  filteredTransactions.forEach(function(t) {
      try {
          const date = convertExcelDate(t.time);
          if (!isNaN(date.getTime())) {
              const hour = date.getHours();
              hourlyData[hour].transactions += 1;
              hourlyData[hour].profit += t.profit;
              hourlyData[hour].volume += Math.abs(t.amount);
          }
      } catch (e) {
          console.warn('Invalid time format:', t.time);
      }
  });

  const hours = Object.keys(hourlyData).map(function(h) {
      return h + ':00';
  });
  const transactions = Object.values(hourlyData).map(function(data) {
      return data.transactions;
  });
  const profits = Object.values(hourlyData).map(function(data) {
      return data.profit;
  });

  charts.hourlyActivityChart = new Chart(ctx, {
      type: 'line',
      data: {
          labels: hours,
          datasets: [{
              label: 'Số giao dịch',
              data: transactions,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4,
              fill: true,
              yAxisID: 'y'
          }, {
              label: 'Lợi nhuận (USDT)',
              data: profits,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              type: 'line',
              yAxisID: 'y1'
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  beginAtZero: true,
                  title: {
                      display: true,
                      text: 'Số giao dịch'
                  }
              },
              y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                      display: true,
                      text: 'Lợi nhuận (USDT)'
                  },
                  grid: {
                      drawOnChartArea: false
                  }
              },
              x: {
                  title: {
                      display: true,
                      text: 'Giờ trong ngày'
                  }
              }
          },
          plugins: {
              legend: {
                  display: true,
                  position: 'top'
              },
              tooltip: {
                  callbacks: {
                      afterLabel: function(context) {
                          const hour = parseInt(context.label.split(':')[0]);
                          const data = hourlyData[hour];
                          return 'Khối lượng: ' + data.volume.toFixed(4) + ' USDT';
                      }
                  }
              }
          }
      }
  });
}

function setupFilters() {
  // Lấy các loại giao dịch và cặp giao dịch từ dữ liệu thực
  const assetTypes = [
    ...new Set(
      transactions
        .map(function (t) {
          return t.assetType;
        })
        .filter(function (type) {
          return type && type !== '';
        })
    ),
  ];

  const pairs = [
    ...new Set(
      transactions
        .map(function (t) {
          return t.pair;
        })
        .filter(function (p) {
          return p && p !== 'N/A' && p !== '';
        })
    ),
  ];

  const typeFilter = document.getElementById('transactionTypeFilter');
  const pairFilter = document.getElementById('tradingPairFilter');

  // Clear existing options
  if (typeFilter) {
    typeFilter.innerHTML = '<option value="">Tất cả</option>';
    assetTypes.forEach(function (type) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeFilter.appendChild(option);
    });
  }

  if (pairFilter) {
    pairFilter.innerHTML = '<option value="">Tất cả</option>';
    pairs.forEach(function (pair) {
      const option = document.createElement('option');
      option.value = pair;
      option.textContent = pair;
      pairFilter.appendChild(option);
    });
  }

  // Set default date range
  const dates = transactions
    .map(function (t) {
      try {
        return t.time.split(' ')[0];
      } catch (e) {
        return '';
      }
    })
    .filter(function (d) {
      return d !== '';
    })
    .sort();

  if (dates.length > 0) {
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');

    if (dateFromFilter) dateFromFilter.value = dates[0];
    if (dateToFilter) dateToFilter.value = dates[dates.length - 1];
  }
}

function applyFilters() {
  const typeFilter = document.getElementById('transactionTypeFilter');
  const pairFilter = document.getElementById('tradingPairFilter');
  const dateFromFilter = document.getElementById('dateFromFilter');
  const dateToFilter = document.getElementById('dateToFilter');
  const searchInput = document.getElementById('searchInput');

  const typeFilterValue = typeFilter ? typeFilter.value : '';
  const pairFilterValue = pairFilter ? pairFilter.value : '';
  const dateFrom = dateFromFilter ? dateFromFilter.value : '';
  const dateTo = dateToFilter ? dateToFilter.value : '';
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

  filteredTransactions = transactions.filter(function (t) {
    try {
      const date = t.time.split(' ')[0];
      const matchesSearch =
        !searchTerm ||
        (t.pair && t.pair.toLowerCase().includes(searchTerm)) ||
        (t.assetType && t.assetType.toLowerCase().includes(searchTerm)) ||
        (t.time && t.time.toLowerCase().includes(searchTerm));

      return (
        (!typeFilterValue || t.assetType === typeFilterValue) &&
        (!pairFilterValue || t.pair === pairFilterValue) &&
        (!dateFrom || date >= dateFrom) &&
        (!dateTo || date <= dateTo) &&
        matchesSearch
      );
    } catch (e) {
      return false;
    }
  });

  currentPage = 1;
  updateDashboard();
}

function resetFilters() {
  const typeFilter = document.getElementById('transactionTypeFilter');
  const pairFilter = document.getElementById('tradingPairFilter');
  const searchInput = document.getElementById('searchInput');

  if (typeFilter) typeFilter.value = '';
  if (pairFilter) pairFilter.value = '';
  if (searchInput) searchInput.value = '';

  const dates = transactions
    .map(function (t) {
      try {
        return t.time.split(' ')[0];
      } catch (e) {
        return '';
      }
    })
    .filter(function (d) {
      return d !== '';
    })
    .sort();

  if (dates.length > 0) {
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');

    if (dateFromFilter) dateFromFilter.value = dates[0];
    if (dateToFilter) dateToFilter.value = dates[dates.length - 1];
  }

  filteredTransactions = [...transactions];
  currentPage = 1;
  updateDashboard();
}

function handleSearch() {
  applyFilters();
}

function handlePageSizeChange() {
  const pageSizeSelect = document.getElementById('pageSize');
  if (pageSizeSelect) {
    pageSize = parseInt(pageSizeSelect.value);
    currentPage = 1;
    updateTable();
    updatePagination();
  }
}

function updateTable() {
  const tbody = document.querySelector('#transactionsTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  // Sort data if needed
  let sortedData = [...filteredTransactions];
  if (sortColumn >= 0) {
      sortedData.sort(function(a, b) {
          const columns = ['time', 'pair', 'assetType', 'amount', 'profit', 'fee', 'total'];
          const key = columns[sortColumn];
          let aVal = a[key];
          let bVal = b[key];
          
          if (key === 'time') {
              try {
                  aVal = convertExcelDate(aVal).getTime();
                  bVal = convertExcelDate(bVal).getTime();
              } catch (e) {
                  aVal = 0;
                  bVal = 0;
              }
          } else if (typeof aVal === 'string') {
              aVal = aVal.toLowerCase();
              bVal = bVal.toLowerCase();
          }
          
          if (sortDirection === 'asc') {
              return aVal > bVal ? 1 : -1;
          } else {
              return aVal < bVal ? 1 : -1;
          }
      });
  }

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageData = sortedData.slice(startIndex, endIndex);

  pageData.forEach(function(t) {
      const row = tbody.insertRow();
      
      // Format thời gian đẹp hơn
      const timeFormatted = formatDateTime(t.time);
      
      // Format cặp giao dịch
      const pairFormatted = t.pair || 'N/A';
      
      // Format loại giao dịch với badge màu
      const assetTypeFormatted = t.assetType || 'N/A';
      let badgeClass = 'badge-neutral';
      switch(assetTypeFormatted) {
          case 'CLOSE_POSITION':
              badgeClass = 'badge-success';
              break;
          case 'FEE':
              badgeClass = 'badge-warning';
              break;
          case 'FUNDING':
              badgeClass = 'badge-info';
              break;
          case 'TRANSFER':
              badgeClass = 'badge-primary';
              break;
          case 'BONUS':
              badgeClass = 'badge-success';
              break;
          case 'BONUS_DEDUCT':
              badgeClass = 'badge-danger';
              break;
      }
      
      row.innerHTML = '<td>' + timeFormatted + '</td>' +
          '<td>' + pairFormatted + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + assetTypeFormatted + '</span></td>' +
          '<td class="' + (t.amount >= 0 ? 'profit' : 'loss') + '">' + (t.amount || 0).toFixed(4) + '</td>' +
          '<td class="' + (t.profit >= 0 ? 'profit' : 'loss') + '">' + (t.profit || 0).toFixed(4) + '</td>' +
          '<td class="loss">' + (t.fee || 0).toFixed(4) + '</td>' +
          '<td class="' + (t.total >= 0 ? 'profit' : 'loss') + '">' + (t.total || 0).toFixed(4) + '</td>';
  });
}

function sortTable(columnIndex) {
  if (sortColumn === columnIndex) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = columnIndex;
    sortDirection = 'asc';
  }

  // Update sort indicators
  const headers = document.querySelectorAll('#transactionsTable th');
  headers.forEach(function (header, index) {
    const icon = header.querySelector('i');
    if (icon) {
      if (index === columnIndex) {
        icon.className =
          sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
      } else {
        icon.className = 'fas fa-sort';
      }
    }
  });

  updateTable();
}

function updatePagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  pagination.innerHTML = '';

  if (totalPages <= 1) return;

  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = function () {
    if (currentPage > 1) {
      currentPage--;
      updateTable();
      updatePagination();
    }
  };
  pagination.appendChild(prevBtn);

  // Page numbers
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.onclick = function () {
      currentPage = 1;
      updateTable();
      updatePagination();
    };
    pagination.appendChild(firstBtn);

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      pagination.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i;
    pageBtn.className = i === currentPage ? 'active' : '';
    pageBtn.onclick = function () {
      currentPage = i;
      updateTable();
      updatePagination();
    };
    pagination.appendChild(pageBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      pagination.appendChild(dots);
    }

    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages;
    lastBtn.onclick = function () {
      currentPage = totalPages;
      updateTable();
      updatePagination();
    };
    pagination.appendChild(lastBtn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = function () {
    if (currentPage < totalPages) {
      currentPage++;
      updateTable();
      updatePagination();
    }
  };
  pagination.appendChild(nextBtn);
}

function exportToExcel() {
  const exportData = filteredTransactions.map(function (t) {
    return {
      'Thời gian': t.time,
      'Cặp giao dịch': t.pair,
      'Tiền điện tử': t.crypto,
      'Loại tài sản': t.assetType,
      'Kiểu Luồng Vốn': t.flowType,
      'Số tiền': t.amount,
      Coin: t.coin,
      'Số Lệnh': t.orders,
      'Tổng Lãi/Lỗ': t.profit,
      'Tổng Phí': t.fee,
      Tổng: t.total,
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch');

  const fileName =
    'mexc_trading_export_' + new Date().toISOString().split('T')[0] + '.xlsx';
  XLSX.writeFile(wb, fileName);
}

function updateDashboard() {
  updateStats();
  
  // Destroy existing charts
  Object.keys(charts).forEach(function(key) {
      if (charts[key]) {
          charts[key].destroy();
      }
  });
  
  // Create new charts
  setTimeout(function() {
      createProfitChart();
      createTransactionTypeChart();
      createTopPairsChart();
      createCumulativeProfitChart();
      createDailyProfitChart();
      createHourlyActivityChart();
      createFeeChart();
  }, 100);
  
  updateTable();
  updatePagination();
}

// Utility functions
function showLoading() {
  const loading = document.getElementById('loading');
  const importSection = document.getElementById('importSection');
  const dashboard = document.getElementById('dashboard');

  if (loading) loading.style.display = 'block';
  if (importSection) importSection.style.display = 'none';
  if (dashboard) dashboard.style.display = 'none';
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function showSuccessMessage(message) {
  // Tạo toast notification
  const toast = document.createElement('div');
  toast.className = 'toast success-toast';
  toast.innerHTML =
    '<i class="fas fa-check-circle"></i><span>' + message + '</span>';

  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

function showErrorMessage(message) {
  // Tạo toast notification
  const toast = document.createElement('div');
  toast.className = 'toast error-toast';
  toast.innerHTML =
    '<i class="fas fa-exclamation-circle"></i><span>' + message + '</span>';

  document.body.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);

  hideLoading();
  const importSection = document.getElementById('importSection');
  if (importSection) importSection.style.display = 'block';
}

// Utility functions for date formatting
function formatDate(dateString) {
    try {
        let date;
        
        // Xử lý số Excel
        if (!isNaN(dateString) && typeof dateString === 'number') {
            date = convertExcelDate(dateString);
        } else if (dateString.includes(' ')) {
            date = new Date(dateString.replace(' ', 'T'));
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return day + '/' + month + '/' + year;
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    try {
        let date;
        
        // Xử lý số Excel
        if (!isNaN(dateString) && typeof dateString === 'number') {
            date = convertExcelDate(dateString);
        } else if (dateString.includes(' ')) {
            const [datePart, timePart] = dateString.split(' ');
            const [year, month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':');
            date = new Date(year, month - 1, day, hours, minutes);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
    } catch (e) {
        return dateString;
    }
}

function formatDateForChart(dateString) {
    try {
        let date;
        
        // Xử lý số Excel
        if (!isNaN(dateString) && typeof dateString === 'number') {
            date = convertExcelDate(dateString);
        } else if (dateString.includes(' ')) {
            const [datePart, timePart] = dateString.split(' ');
            const [year, month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':');
            date = new Date(year, month - 1, day, hours, minutes);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        return day + '/' + month;
    } catch (e) {
        return dateString;
    }
}

function getDateOnly(dateString) {
    try {
        let date;
        
        // Xử lý số Excel
        if (!isNaN(dateString) && typeof dateString === 'number') {
            date = convertExcelDate(dateString);
            return date.toISOString().split('T')[0];
        } else if (dateString.includes(' ')) {
            const datePart = dateString.split(' ')[0];
            const [year, month, day] = datePart.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
}

// Hàm chuyển đổi ngày Excel sang Date object
function convertExcelDate(excelDate) {
    try {
        // Kiểm tra nếu là số Excel
        if (!isNaN(excelDate) && typeof excelDate === 'number') {
            // Excel bắt đầu từ 1/1/1900
            const millisecondsPerDay = 24 * 60 * 60 * 1000;
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (excelDate - 1) * millisecondsPerDay);
            return date;
        }
        return new Date(excelDate);
    } catch (e) {
        console.warn('Lỗi chuyển đổi ngày Excel:', e);
        return new Date();
    }
}
