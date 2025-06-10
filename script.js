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
    }
    
    if (pairFilter) pairFilter.addEventListener('change', applyFilters);
    if (directionFilter) directionFilter.addEventListener('change', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    // Check for saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').textContent = '☀️';
    }
});

// Theme toggle
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Update charts for theme
    Object.values(charts).forEach(chart => {
        if (chart && chart.options) {
            updateChartTheme(chart);
            chart.update();
        }
    });
}

function updateChartTheme(chart) {
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#e0e0e0' : '#333';
    const gridColor = isDark ? '#2a2a3e' : '#e0e0e0';
    
    if (chart.options.scales) {
        Object.values(chart.options.scales).forEach(scale => {
            scale.ticks = { ...scale.ticks, color: textColor };
            scale.grid = { ...scale.grid, color: gridColor };
            if (scale.title) {
                scale.title.color = textColor;
            }
        });
    }
    
    if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels = {
            ...chart.options.plugins.legend.labels,
            color: textColor
        };
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusDiv = document.getElementById('fileStatus');
    statusDiv.innerHTML = '⏳ Đang xử lý file...';
    statusDiv.className = 'status-loading';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            console.log('Raw data:', jsonData); // Debug
            console.log('First row:', jsonData[0]); // Debug
            
            processTradingData(jsonData);
            
            statusDiv.innerHTML = '✅ File đã được tải thành công! Đã xử lý ' + tradingData.length + ' giao dịch.';
            statusDiv.className = 'status-success';
        } catch (error) {
            console.error('Error processing file:', error);
            statusDiv.innerHTML = '❌ Lỗi khi đọc file: ' + error.message;
            statusDiv.className = 'status-error';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Helper function to parse dates
function parseDate(dateValue) {
    if (!dateValue) return new Date();
    
    // If already a valid date
    if (dateValue instanceof Date && !isNaN(dateValue)) {
        return dateValue;
    }
    
    // Try parsing string
    const parsed = new Date(dateValue);
    if (!isNaN(parsed)) {
        return parsed;
    }
    
    // Try Excel serial date
    if (typeof dateValue === 'number') {
        // Excel dates start from 1900-01-01
        const excelEpoch = new Date(1900, 0, 1);
        const msPerDay = 24 * 60 * 60 * 1000;
        return new Date(excelEpoch.getTime() + (dateValue - 2) * msPerDay);
    }
    
    console.warn('Could not parse date:', dateValue);
    return new Date();
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
    updateAdvancedStats();
    updateCharts();
    updateTable();
    updateRecommendations();
}

// Update the updateStats function to add error handling
function updateStats() {
    try {
        const totalTrades = filteredData.length;
        const totalPNL = filteredData.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const winningTrades = filteredData.filter(trade => trade.pnl > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
        const avgProfit = totalTrades > 0 ? (totalPNL / totalTrades) : 0;
        
        // Calculate peak trading hours and days
        const hourlyActivity = {};
        const dailyActivity = {};
        
        filteredData.forEach(trade => {
            if (trade.openTime && !isNaN(trade.openTime)) {
                const hour = trade.openTime.getHours();
                const day = trade.openTime.toLocaleDateString('vi-VN', { weekday: 'long' });
                
                hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
                dailyActivity[day] = (dailyActivity[day] || 0) + 1;
            }
        });
        
        const peakHour = Object.keys(hourlyActivity).length > 0 
            ? Object.keys(hourlyActivity).reduce((a, b) => hourlyActivity[a] > hourlyActivity[b] ? a : b, '0')
            : '0';
        const peakDay = Object.keys(dailyActivity).length > 0
            ? Object.keys(dailyActivity).reduce((a, b) => dailyActivity[a] > dailyActivity[b] ? a : b, 'Không có')
            : 'Không có';
        
        // Update DOM
        document.getElementById('totalTrades').textContent = totalTrades.toLocaleString();
        document.getElementById('totalPNL').textContent = formatCurrency(totalPNL);
        document.getElementById('totalPNL').className = totalPNL >= 0 ? 'value positive' : 'value negative';
        document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
        document.getElementById('avgProfit').textContent = formatCurrency(avgProfit);
        document.getElementById('avgProfit').className = avgProfit >= 0 ? 'value positive' : 'value negative';
        document.getElementById('peakHour').textContent = peakHour + ':00';
        document.getElementById('peakDay').textContent = peakDay;
        
        console.log('Stats updated successfully');
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function updateAdvancedStats() {
    const metrics = calculateAdvancedMetrics();
    
    document.getElementById('sharpeRatio').textContent = metrics.sharpeRatio.toFixed(2);
    document.getElementById('maxDrawdown').textContent = metrics.maxDrawdown.toFixed(1) + '%';
    document.getElementById('profitFactor').textContent = metrics.profitFactor.toFixed(2);
    document.getElementById('riskReward').textContent = metrics.riskRewardRatio.toFixed(2);
    document.getElementById('maxWinStreak').textContent = metrics.streaks.maxWinStreak;
    document.getElementById('maxLossStreak').textContent = metrics.streaks.maxLossStreak;
}

function calculateAdvancedMetrics() {
    const returns = calculateDailyReturns();
    const sharpeRatio = calculateSharpeRatio(returns);
    const maxDrawdown = calculateMaxDrawdown();
    const profitFactor = calculateProfitFactor();
    const riskRewardRatio = calculateRiskRewardRatio();
    const streaks = calculateStreaks();
    
    return {
        sharpeRatio,
        maxDrawdown,
        profitFactor,
        riskRewardRatio,
        streaks
    };
}

function calculateDailyReturns() {
    const dailyPNL = {};
    filteredData.forEach(trade => {
        const date = trade.closeTime.toISOString().split('T')[0];
        dailyPNL[date] = (dailyPNL[date] || 0) + trade.pnl;
    });
    return Object.values(dailyPNL);
}

function calculateSharpeRatio(returns) {
    if (returns.length === 0) return 0;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / returns.length);
    return stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252);
}

function calculateMaxDrawdown() {
    let peak = 0;
    let maxDD = 0;
    let cumPNL = 0;
    
    const sortedData = [...filteredData].sort((a, b) => a.closeTime - b.closeTime);
    
    sortedData.forEach(trade => {
        cumPNL += trade.pnl;
        if (cumPNL > peak) peak = cumPNL;
        const drawdown = peak - cumPNL;
        if (drawdown > maxDD) maxDD = drawdown;
    });
    
    return peak === 0 ? 0 : (maxDD / peak) * 100;
}

function calculateProfitFactor() {
    const profits = filteredData.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const losses = Math.abs(filteredData.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    return losses === 0 ? profits : profits / losses;
}

function calculateRiskRewardRatio() {
    const wins = filteredData.filter(t => t.pnl > 0);
    const losses = filteredData.filter(t => t.pnl < 0);
    
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
    
    return avgLoss === 0 ? avgWin : avgWin / avgLoss;
}

function calculateStreaks() {
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    const sortedData = [...filteredData].sort((a, b) => a.closeTime - b.closeTime);
    
    sortedData.forEach(trade => {
        if (trade.pnl > 0) {
            currentWinStreak++;
            currentLossStreak = 0;
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else {
            currentLossStreak++;
            currentWinStreak = 0;
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        }
    });
    
    return { maxWinStreak, maxLossStreak };
}

function updateCharts() {
    createPNLChart();
    createPairChart();
    createDirectionChart();
    createPNLByPairChart();
    createHourlyChart();
    createWeeklyChart();
    createMonthlyChart();
    createCalendarHeatmap();
}

function createPNLChart() {
    const ctx = document.getElementById('pnlChart');
    if (charts.pnl) charts.pnl.destroy();
    
    const sortedData = [...filteredData].sort((a, b) => a.closeTime - b.closeTime);
    let cumPNL = 0;
    const data = sortedData.map(trade => {
        cumPNL += trade.pnl;
        return {
            x: trade.closeTime,
            y: cumPNL
        };
    });
    
    charts.pnl = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'PNL Tích Lũy',
                data: data,
                borderColor: cumPNL >= 0 ? 'rgb(76, 175, 80)' : 'rgb(244, 67, 54)',
                backgroundColor: cumPNL >= 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Quan trọng!
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'PNL (USDT)'
                    }
                }
            }
        }
    });
    updateChartTheme(charts.pnl);
}

function createPairChart() {
    const ctx = document.getElementById('pairChart');
    if (charts.pair) charts.pair.destroy();
    
    const pairCounts = {};
    filteredData.forEach(trade => {
        pairCounts[trade.pair] = (pairCounts[trade.pair] || 0) + 1;
    });
    
    const sortedPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    charts.pair = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedPairs.map(p => p[0]),
            datasets: [{
                data: sortedPairs.map(p => p[1]),
                backgroundColor: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe',
                    '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Thêm dòng này
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
    updateChartTheme(charts.pair);
}

function createDirectionChart() {
    const ctx = document.getElementById('directionChart');
    if (charts.direction) charts.direction.destroy();
    
    const longTrades = filteredData.filter(t => t.direction === 'Long');
    const shortTrades = filteredData.filter(t => t.direction === 'Short');
    
    const longPNL = longTrades.reduce((sum, t) => sum + t.pnl, 0);
    const shortPNL = shortTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    charts.direction = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Long', 'Short'],
            datasets: [{
                label: 'Số lượng',
                data: [longTrades.length, shortTrades.length],
                backgroundColor: ['#4caf50', '#f44336']
            }, {
                label: 'PNL',
                data: [longPNL, shortPNL],
                backgroundColor: ['#81c784', '#e57373'],
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left'
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
    updateChartTheme(charts.direction);
}

function createPNLByPairChart() {
    const ctx = document.getElementById('pnlByPairChart');
    if (charts.pnlByPair) charts.pnlByPair.destroy();
    
    const pairPNL = {};
    filteredData.forEach(trade => {
        pairPNL[trade.pair] = (pairPNL[trade.pair] || 0) + trade.pnl;
    });
    
    const sortedPairs = Object.entries(pairPNL).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    charts.pnlByPair = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedPairs.map(p => p[0]),
            datasets: [{
                label: 'PNL (USDT)',
                data: sortedPairs.map(p => p[1]),
                backgroundColor: sortedPairs.map(p => p[1] >= 0 ? '#4caf50' : '#f44336')
            }]
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
                    beginAtZero: true
                }
            }
        }
    });
    updateChartTheme(charts.pnlByPair);
}

function createHourlyChart() {
    const ctx = document.getElementById('hourlyChart');
    if (charts.hourly) charts.hourly.destroy();
    
    const hourlyData = Array(24).fill(0);
    filteredData.forEach(trade => {
        const hour = trade.openTime.getHours();
        hourlyData[hour]++;
    });
    
    charts.hourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 24}, (_, i) => i + ':00'),
            datasets: [{
                label: 'Số giao dịch',
                data: hourlyData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
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
                    beginAtZero: true
                }
            }
        }
    });
    updateChartTheme(charts.hourly);
}

function createWeeklyChart() {
    const ctx = document.getElementById('weeklyChart');
    if (charts.weekly) charts.weekly.destroy();
    
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const weeklyData = Array(7).fill(0);
    
    filteredData.forEach(trade => {
        const day = trade.openTime.getDay();
        weeklyData[day]++;
    });
    
    charts.weekly = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: days,
            datasets: [{
                label: 'Số giao dịch',
                data: weeklyData,
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.2)',
                pointBackgroundColor: '#764ba2',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#764ba2'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
    updateChartTheme(charts.weekly);
}

function createMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (charts.monthly) charts.monthly.destroy();
    
    const monthlyData = {};
    filteredData.forEach(trade => {
        const month = trade.closeTime.toISOString().substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = {
                trades: 0,
                pnl: 0,
                wins: 0
            };
        }
        monthlyData[month].trades++;
        monthlyData[month].pnl += trade.pnl;
        if (trade.pnl > 0) monthlyData[month].wins++;
    });
    
    const months = Object.keys(monthlyData).sort();
    
    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return `${month}/${year}`;
            }),
            datasets: [{
                label: 'PNL (USDT)',
                data: months.map(m => monthlyData[m].pnl),
                backgroundColor: months.map(m => monthlyData[m].pnl >= 0 ? '#4caf50' : '#f44336'),
                yAxisID: 'y'
            }, {
                label: 'Tỷ lệ thắng (%)',
                data: months.map(m => (monthlyData[m].wins / monthlyData[m].trades * 100)),
                type: 'line',
                borderColor: '#667eea',
                backgroundColor: 'transparent',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'PNL (USDT)'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: 'Tỷ lệ thắng (%)'
                    }
                }
            }
        }
    });
    updateChartTheme(charts.monthly);
}

function createCalendarHeatmap() {
    const ctx = document.getElementById('calendarHeatmap').getContext('2d');
    const canvas = document.getElementById('calendarHeatmap');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const dailyPNL = {};
    filteredData.forEach(trade => {
        const date = trade.closeTime.toISOString().split('T')[0];
        dailyPNL[date] = (dailyPNL[date] || 0) + trade.pnl;
    });
    
    // Simple calendar heatmap visualization
    const dates = Object.keys(dailyPNL).sort();
    if (dates.length === 0) return;
    
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const cellSize = 15;
    const cellPadding = 2;
    const weekHeight = 7 * (cellSize + cellPadding);
    
    // Find max absolute PNL for color scaling
    const maxPNL = Math.max(...Object.values(dailyPNL).map(Math.abs));
    
    let currentDate = new Date(startDate);
    let x = 0;
    let y = currentDate.getDay() * (cellSize + cellPadding);
    
    for (let i = 0; i < dayCount; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const pnl = dailyPNL[dateStr] || 0;
        
        // Color based on PNL
        if (pnl > 0) {
            const intensity = pnl / maxPNL;
            ctx.fillStyle = `rgba(76, 175, 80, ${0.2 + intensity * 0.8})`;
        } else if (pnl < 0) {
            const intensity = Math.abs(pnl) / maxPNL;
            ctx.fillStyle = `rgba(244, 67, 54, ${0.2 + intensity * 0.8})`;
        } else {
            ctx.fillStyle = '#e0e0e0';
        }
        
        ctx.fillRect(x, y, cellSize, cellSize);
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        y += cellSize + cellPadding;
        
        // New week
        if (currentDate.getDay() === 0) {
            x += cellSize + cellPadding;
            y = 0;
        }
    }
}

function updateRecommendations() {
    const recommendations = generateRecommendations();
    const container = document.getElementById('recommendationsList');
    
    container.innerHTML = recommendations.map(rec => 
        `<div class="recommendation-item">${rec}</div>`
    ).join('');
    
    document.getElementById('recommendations').style.display = 'block';
}

function generateRecommendations() {
    const recommendations = [];
    
    // Best performing pair
    const pairPNL = {};
    filteredData.forEach(trade => {
        pairPNL[trade.pair] = (pairPNL[trade.pair] || 0) + trade.pnl;
    });
    
    const sortedPairs = Object.entries(pairPNL).sort((a, b) => b[1] - a[1]);
    if (sortedPairs.length > 0) {
        const bestPair = sortedPairs[0];
        recommendations.push(`✅ Cặp ${bestPair[0]} mang lại lợi nhuận cao nhất: ${formatCurrency(bestPair[1])}`);
        
        if (sortedPairs[sortedPairs.length - 1][1] < 0) {
            const worstPair = sortedPairs[sortedPairs.length - 1];
            recommendations.push(`⚠️ Cặp ${worstPair[0]} gây lỗ nhiều nhất: ${formatCurrency(worstPair[1])}`);
        }
    }
    
    // Best trading time
    const hourlyPNL = {};
    filteredData.forEach(trade => {
        const hour = trade.openTime.getHours();
        hourlyPNL[hour] = (hourlyPNL[hour] || 0) + trade.pnl;
    });
    
    const bestHour = Object.entries(hourlyPNL).sort((a, b) => b[1] - a[1])[0];
    if (bestHour) {
        recommendations.push(`⏰ Giờ giao dịch hiệu quả nhất: ${bestHour[0]}:00 với PNL ${formatCurrency(bestHour[1])}`);
    }
    
    // Risk warnings
    const metrics = calculateAdvancedMetrics();
    if (metrics.maxDrawdown > 20) {
        recommendations.push(`⚠️ Cảnh báo: Max Drawdown cao (${metrics.maxDrawdown.toFixed(1)}%), cần quản lý rủi ro tốt hơn`);
    }
    
    if (metrics.profitFactor < 1.5) {
        recommendations.push(`📊 Profit Factor thấp (${metrics.profitFactor.toFixed(2)}), cần cải thiện tỷ lệ lãi/lỗ`);
    }
    
    if (metrics.streaks.maxLossStreak > 5) {
        recommendations.push(`🔴 Chuỗi thua dài (${metrics.streaks.maxLossStreak} lần), cần xem xét lại chiến lược`);
    }
    
    // Direction analysis
    const longTrades = filteredData.filter(t => t.direction === 'Long');
    const shortTrades = filteredData.filter(t => t.direction === 'Short');
    const longPNL = longTrades.reduce((sum, t) => sum + t.pnl, 0);
    const shortPNL = shortTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    if (longPNL > shortPNL * 2) {
        recommendations.push(`📈 Giao dịch Long hiệu quả hơn Short đáng kể`);
    } else if (shortPNL > longPNL * 2) {
        recommendations.push(`📉 Giao dịch Short hiệu quả hơn Long đáng kể`);
    }
    
    return recommendations;
}

function updateTable() {
    const tbody = document.querySelector('#tradesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        const row = tbody.insertRow();
        row.innerHTML = `<td colspan="10" style="text-align: center; color: #666; font-style: italic;">Không có dữ liệu để hiển thị</td>`;
        return;
    }
    
    filteredData.slice(0, 100).forEach(trade => {
        const row = tbody.insertRow();
        
        // Calculate duration safely
        let durationText = 'N/A';
        if (!isNaN(trade.openTime.getTime()) && !isNaN(trade.closeTime.getTime())) {
            const duration = (trade.closeTime - trade.openTime) / (1000 * 60 * 60); // hours
            durationText = duration > 24 ? 
                `${(duration / 24).toFixed(1)}d` : 
                `${duration.toFixed(1)}h`;
        }
        
        // Format dates safely
        const formatDate = (date) => {
            return !isNaN(date.getTime()) ? date.toLocaleString('vi-VN') : 'N/A';
        };
        
        row.innerHTML = `
            <td>${trade.pair || 'N/A'}</td>
            <td>${formatDate(trade.openTime)}</td>
            <td>${formatDate(trade.closeTime)}</td>
            <td><span style="color: ${trade.direction === 'Long' ? '#00c851' : '#ff4444'}">${trade.direction || 'N/A'}</span></td>
            <td>${trade.openPrice ? trade.openPrice.toLocaleString() : 'N/A'}</td>
            <td>${trade.closePrice ? trade.closePrice.toLocaleString() : 'N/A'}</td>
            <td>${trade.quantity ? trade.quantity.toLocaleString() : 'N/A'}</td>
            <td class="${trade.pnl >= 0 ? 'positive' : 'negative'}">${trade.pnl.toFixed(4)} USDT</td>
            <td>${trade.fee.toFixed(4)} USDT</td>
            <td>${durationText}</td>
        `;
    });
    
    if (filteredData.length > 100) {
        const row = tbody.insertRow();
        row.innerHTML = `<td colspan="10" style="text-align: center; color: #666; font-style: italic;">Hiển thị 100 giao dịch đầu tiên. Tổng cộng: ${filteredData.length} giao dịch</td>`;
    }
}


// Export functions
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Trading Report - MEXC', 105, 20, { align: 'center' });
    
    // Date range
    doc.setFontSize(12);
    const dateRange = `${document.getElementById('dateFrom').value} - ${document.getElementById('dateTo').value}`;
    doc.text(`Thời gian: ${dateRange}`, 105, 30, { align: 'center' });
    
    // Stats
    doc.setFontSize(14);
    doc.text('Thống kê tổng quan:', 20, 45);
    
    doc.setFontSize(11);
    const stats = [
        `Tổng giao dịch: ${document.getElementById('totalTrades').textContent}`,
        `Tổng PNL: ${document.getElementById('totalPNL').textContent}`,
        `Tỷ lệ thắng: ${document.getElementById('winRate').textContent}`,
        `Sharpe Ratio: ${document.getElementById('sharpeRatio').textContent}`,
        `Max Drawdown: ${document.getElementById('maxDrawdown').textContent}`,
        `Profit Factor: ${document.getElementById('profitFactor').textContent}`
    ];
    
    stats.forEach((stat, index) => {
        doc.text(stat, 20, 55 + (index * 7));
    });
    
    // Recommendations
    doc.setFontSize(14);
    doc.text('Khuyến nghị:', 20, 105);
    
    doc.setFontSize(10);
    const recommendations = generateRecommendations();
    recommendations.forEach((rec, index) => {
        if (105 + 15 + (index * 7) < 280) {
            doc.text(rec, 20, 115 + (index * 7));
        }
    });
    
    // Save
    doc.save('trading-report.pdf');
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Trading Report - MEXC'],
        [''],
        ['Thống kê tổng quan'],
        ['Tổng giao dịch', document.getElementById('totalTrades').textContent],
        ['Tổng PNL', document.getElementById('totalPNL').textContent],
        ['Tỷ lệ thắng', document.getElementById('winRate').textContent],
        ['Lợi nhuận trung bình', document.getElementById('avgProfit').textContent],
        [''],
        ['Chỉ số nâng cao'],
        ['Sharpe Ratio', document.getElementById('sharpeRatio').textContent],
        ['Max Drawdown', document.getElementById('maxDrawdown').textContent],
        ['Profit Factor', document.getElementById('profitFactor').textContent],
        ['Risk/Reward', document.getElementById('riskReward').textContent],
        ['Chuỗi thắng tối đa', document.getElementById('maxWinStreak').textContent],
        ['Chuỗi thua tối đa', document.getElementById('maxLossStreak').textContent],
        [''],
        ['Khuyến nghị'],
        ...generateRecommendations().map(rec => [rec])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    
    // Detailed trades sheet
    const tradesData = [
        ['Cặp', 'Thời gian mở', 'Thời gian đóng', 'Hướng', 'Giá mở', 'Giá đóng', 'Số lượng', 'PNL', 'Phí', 'Trạng thái']
    ];
    
    filteredData.forEach(trade => {
        tradesData.push([
            trade.pair,
            formatDateTime(trade.openTime),
            formatDateTime(trade.closeTime),
            trade.direction,
            trade.openPrice,
            trade.closePrice,
            trade.quantity,
            trade.pnl,
            trade.fee,
            trade.status
        ]);
    });
    
    const tradesSheet = XLSX.utils.aoa_to_sheet(tradesData);
    XLSX.utils.book_append_sheet(wb, tradesSheet, 'Trades');
    
    // Pair analysis sheet
    const pairAnalysis = analyzePairs();
    const pairData = [
        ['Cặp', 'Số giao dịch', 'Tổng PNL', 'PNL TB', 'Tỷ lệ thắng', 'Max Win', 'Max Loss']
    ];
    
    Object.entries(pairAnalysis).forEach(([pair, stats]) => {
        pairData.push([
            pair,
            stats.trades,
            stats.totalPNL.toFixed(4),
            stats.avgPNL.toFixed(4),
            stats.winRate.toFixed(1) + '%',
            stats.maxWin.toFixed(4),
            stats.maxLoss.toFixed(4)
        ]);
    });
    
    const pairSheet = XLSX.utils.aoa_to_sheet(pairData);
    XLSX.utils.book_append_sheet(wb, pairSheet, 'Pair Analysis');
    
    // Time analysis sheet
    const timeAnalysis = analyzeTimePatterns();
    const timeData = [
        ['Giờ', 'Số giao dịch', 'Tổng PNL', 'Tỷ lệ thắng'],
        ...Object.entries(timeAnalysis.hourly).map(([hour, stats]) => [
            hour + ':00',
            stats.trades,
            stats.pnl.toFixed(4),
            stats.winRate.toFixed(1) + '%'
        ])
    ];
    
    const timeSheet = XLSX.utils.aoa_to_sheet(timeData);
    XLSX.utils.book_append_sheet(wb, timeSheet, 'Time Analysis');
    
    // Save file
    XLSX.writeFile(wb, `trading-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}

function shareReport() {
    const reportData = generateReportData();
    const shareText = `
📊 Trading Report Summary
========================
📈 Tổng PNL: ${reportData.overview.totalPNL.toFixed(2)} USDT
🎯 Tỷ lệ thắng: ${reportData.overview.winRate.toFixed(1)}%
📊 Tổng giao dịch: ${reportData.overview.totalTrades}
💰 Profit Factor: ${reportData.overview.profitFactor.toFixed(2)}
📉 Max Drawdown: ${reportData.overview.maxDrawdown.toFixed(1)}%

Top performing pair: ${Object.entries(reportData.pairAnalysis)[0]?.[0] || 'N/A'}
    `;
    
    if (navigator.share) {
        navigator.share({
            title: 'Trading Report - MEXC',
            text: shareText
        }).catch(console.error);
    } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Báo cáo đã được sao chép vào clipboard!');
        }).catch(console.error);
    }
}

function generateReportData() {
    const stats = {
        overview: {
            totalTrades: filteredData.length,
            totalPNL: filteredData.reduce((sum, t) => sum + t.pnl, 0),
            winRate: calculateWinRate(),
            avgProfit: calculateAvgProfit(),
            ...calculateAdvancedMetrics()
        },
        pairAnalysis: analyzePairs(),
        timeAnalysis: analyzeTimePatterns(),
        recommendations: generateRecommendations()
    };
    
    return stats;
}

function calculateWinRate() {
    if (filteredData.length === 0) return 0;
    const wins = filteredData.filter(t => t.pnl > 0).length;
    return (wins / filteredData.length) * 100;
}

function calculateAvgProfit() {
    if (filteredData.length === 0) return 0;
    return filteredData.reduce((sum, t) => sum + t.pnl, 0) / filteredData.length;
}

function analyzePairs() {
    const pairStats = {};
    
    filteredData.forEach(trade => {
        if (!pairStats[trade.pair]) {
            pairStats[trade.pair] = {
                trades: 0,
                totalPNL: 0,
                wins: 0,
                maxWin: 0,
                maxLoss: 0
            };
        }
        
        const stats = pairStats[trade.pair];
        stats.trades++;
        stats.totalPNL += trade.pnl;
        if (trade.pnl > 0) {
            stats.wins++;
            stats.maxWin = Math.max(stats.maxWin, trade.pnl);
        } else {
            stats.maxLoss = Math.min(stats.maxLoss, trade.pnl);
        }
    });
    
    // Calculate derived stats
    Object.values(pairStats).forEach(stats => {
        stats.avgPNL = stats.totalPNL / stats.trades;
        stats.winRate = (stats.wins / stats.trades) * 100;
    });
    
    // Sort by total PNL
    return Object.fromEntries(
        Object.entries(pairStats).sort((a, b) => b[1].totalPNL - a[1].totalPNL)
    );
}

function analyzeTimePatterns() {
    const hourlyStats = {};
    const dailyStats = {};
    
    // Initialize hours
    for (let i = 0; i < 24; i++) {
        hourlyStats[i] = { trades: 0, pnl: 0, wins: 0 };
    }
    
    // Initialize days
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        dailyStats[day] = { trades: 0, pnl: 0, wins: 0 };
    });
    
    filteredData.forEach(trade => {
        const hour = trade.openTime.getHours();
        const day = days[trade.openTime.getDay()];
        
        hourlyStats[hour].trades++;
        hourlyStats[hour].pnl += trade.pnl;
        if (trade.pnl > 0) hourlyStats[hour].wins++;
        
        dailyStats[day].trades++;
        dailyStats[day].pnl += trade.pnl;
        if (trade.pnl > 0) dailyStats[day].wins++;
    });
    
    // Calculate win rates
    Object.values(hourlyStats).forEach(stats => {
        stats.winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    });
    
    Object.values(dailyStats).forEach(stats => {
        stats.winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    });
    
    return { hourly: hourlyStats, daily: dailyStats };
}

// Utility functions
function formatCurrency(value) {
    const formatted = Math.abs(value).toFixed(4);
    return value >= 0 ? `+${formatted} USDT` : `-${formatted} USDT`;
}

function formatNumber(value) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatDateTime(date) {
    if (!date || isNaN(date)) return 'N/A';
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Chart.js default configuration
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont.size = 14;
Chart.defaults.plugins.tooltip.bodyFont.size = 12;

// Additional features for future enhancement
class TradingAnalyzer {
    constructor(data) {
        this.data = data;
    }
    
    calculateKellyRatio() {
        const winRate = this.data.filter(t => t.pnl > 0).length / this.data.length;
        const wins = this.data.filter(t => t.pnl > 0);
        const losses = this.data.filter(t => t.pnl < 0);
        
        if (wins.length === 0 || losses.length === 0) return 0;
        
        const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
        const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);
        
        const winLossRatio = avgWin / avgLoss;
        const kelly = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;
        
        return Math.max(0, Math.min(kelly, 0.25)); // Cap at 25%
    }
    
    calculateExpectedValue() {
        const winRate = this.data.filter(t => t.pnl > 0).length / this.data.length;
        const wins = this.data.filter(t => t.pnl > 0);
        const losses = this.data.filter(t => t.pnl < 0);
        
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;
        
        return (winRate * avgWin) + ((1 - winRate) * avgLoss);
    }
    
    calculateRecoveryFactor() {
        const totalPNL = this.data.reduce((sum, t) => sum + t.pnl, 0);
        const maxDrawdown = calculateMaxDrawdown();
        
        return maxDrawdown === 0 ? totalPNL : totalPNL / maxDrawdown;
    }
}

// Initialize analyzer when data is loaded
let analyzer = null;

function initializeAnalyzer() {
    if (filteredData.length > 0) {
        analyzer = new TradingAnalyzer(filteredData);
    }
}

// Auto-save functionality
function autoSaveData() {
    if (tradingData.length > 0) {
        const dataToSave = {
            data: tradingData,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('tradingDashboardData', JSON.stringify(dataToSave));
    }
}

// Load saved data on startup
function loadSavedData() {
    const saved = localStorage.getItem('tradingDashboardData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.data && parsed.data.length > 0) {
                // Convert date strings back to Date objects
                parsed.data.forEach(trade => {
                    trade.openTime = new Date(trade.openTime);
                    trade.closeTime = new Date(trade.closeTime);
                });
                
                tradingData = parsed.data;
                filteredData = [...tradingData];
                setupFilters();
                updateDashboard();
                
                document.getElementById('dashboard').style.display = 'block';
                document.getElementById('fileStatus').innerHTML = 
                    `ℹ️ Đã tải dữ liệu đã lưu (${parsed.data.length} giao dịch) - Cập nhật lần cuối: ${new Date(parsed.lastUpdated).toLocaleString('vi-VN')}`;
                document.getElementById('fileStatus').className = 'status-success';
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSavedData();
});

function processTradingData(data) {
    console.log('Processing trading data...');
    debugDataProcessing(data);
    
    // Reset data
    tradingData = [];
    
    tradingData = data.map((row, index) => {
        try {
            // Helper function to clean and parse numbers
            const parseNumber = (value) => {
                if (!value) return 0;
                // Remove commas, USDT, and other non-numeric characters except dot and minus
                const cleanValue = String(value).replace(/[,\s]/g, '').replace(/USDT/g, '').replace(/[^\d.-]/g, '');
                const parsed = parseFloat(cleanValue);
                return isNaN(parsed) ? 0 : parsed;
            };
            
            // Helper function to parse date
            const parseDate = (dateStr) => {
                if (!dateStr) return new Date();
                // Handle different date formats
                const cleaned = String(dateStr).trim();
                return new Date(cleaned);
            };
            
            const trade = {
                pair: row['Cặp giao dịch'] || row['Trading Pair'] || '',
                openTime: parseDate(row['Thời gian mở'] || row['Open Time']),
                closeTime: parseDate(row['Thời gian đóng'] || row['Close Time']),
                direction: row['Phương hướng'] || row['Direction'] || '',
                openPrice: parseNumber(row['Giá mở trung bình'] || row['Average Open Price']),
                closePrice: parseNumber(row['Giá đóng trung bình'] || row['Average Close Price']),
                quantity: parseNumber(row['Số lượng đóng (Cont)'] || row['Close Quantity']),
                pnl: parseNumber(row['PNL đã thực hiện'] || row['Realized PNL']),
                fee: parseNumber(row['Phí giao dịch'] || row['Trading Fee']),
                margin: row['Chế độ Margin'] || row['Margin Mode'] || '',
                status: row['Trạng thái'] || row['Status'] || ''
            };
            
            // Enhanced validation
            const isValidTrade = (
                trade.pair && 
                trade.pair.length > 0 &&
                !isNaN(trade.openTime.getTime()) &&
                !isNaN(trade.closeTime.getTime()) &&
                trade.direction &&
                !isNaN(trade.pnl)
            );
            
            if (!isValidTrade) {
                console.warn('Invalid trade data at row', index + 1, {
                    pair: trade.pair,
                    openTime: trade.openTime,
                    closeTime: trade.closeTime,
                    direction: trade.direction,
                    pnl: trade.pnl,
                    originalRow: row
                });
                return null;
            }
            
            if (index === 0) {
                console.log('First valid trade processed:', trade);
            }
            
            return trade;
            
        } catch (error) {
            console.error('Error processing row', index + 1, error, row);
            return null;
        }
    }).filter(trade => trade !== null);
    
    console.log('Total processed trades:', tradingData.length);
    console.log('Sample processed data:', tradingData.slice(0, 3));
    
    if (tradingData.length === 0) {
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.innerHTML = '⚠️ Không tìm thấy dữ liệu hợp lệ trong file. Vui lòng kiểm tra format dữ liệu.';
        statusDiv.className = 'status-error';
        
        // Show detailed error info
        console.log('Sample raw data for debugging:', data.slice(0, 3));
        console.log('Available columns:', Object.keys(data[0] || {}));
        return;
    }
    
    filteredData = [...tradingData];
    setupFilters();
    updateDashboard();
    
    document.getElementById('dashboard').style.display = 'block';
    const noDataDiv = document.getElementById('noData');
    if (noDataDiv) {
        noDataDiv.style.display = 'none';
    }
    
    // Update success message
    const statusDiv = document.getElementById('fileStatus');
    statusDiv.innerHTML = `✅ File đã được tải thành công! Đã xử lý ${tradingData.length} giao dịch hợp lệ từ ${data.length} dòng dữ liệu.`;
    statusDiv.className = 'status-success';
    
    // Auto-save data
    autoSaveData();
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to export
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportToExcel();
    }
    
    // Ctrl/Cmd + P to export PDF
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        exportToPDF();
    }
    
    // Ctrl/Cmd + D for dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
    }
});

// Debug function to help troubleshoot data issues
function debugDataProcessing(rawData) {
    console.log('=== DEBUG DATA PROCESSING ===');
    console.log('Total rows:', rawData.length);
    console.log('Available columns:', Object.keys(rawData[0] || {}));
    console.log('Sample row:', rawData[0]);
    
    // Test parsing on first row
    if (rawData.length > 0) {
        const testRow = rawData[0];
        console.log('Testing number parsing:');
        console.log('- Giá mở:', testRow['Giá mở trung bình'], '→', parseFloat(String(testRow['Giá mở trung bình']).replace(/[,\s]/g, '')));
        console.log('- PNL:', testRow['PNL đã thực hiện'], '→', parseFloat(String(testRow['PNL đã thực hiện']).replace(/USDT/g, '').replace(/[^\d.-]/g, '')));
        console.log('- Phí:', testRow['Phí giao dịch'], '→', parseFloat(String(testRow['Phí giao dịch']).replace(/USDT/g, '').replace(/[^\d.-]/g, '')));
        
        console.log('Testing date parsing:');
        console.log('- Thời gian mở:', testRow['Thời gian mở'], '→', new Date(testRow['Thời gian mở']));
        console.log('- Thời gian đóng:', testRow['Thời gian đóng'], '→', new Date(testRow['Thời gian đóng']));
    }
    console.log('=== END DEBUG ===');
}

console.log('Trading Dashboard initialized successfully!');
