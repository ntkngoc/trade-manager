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

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        showError('Chỉ hỗ trợ file Excel (.xlsx, .xls)');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        showError('File quá lớn (tối đa 10MB)');
        return;
    }
    
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
        const totalFee = filteredData.reduce((sum, trade) => sum + (trade.fee || 0), 0);
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
        document.getElementById('totalFee').textContent = formatCurrency(totalFee);
        document.getElementById('totalFee').className = totalFee >= 0 ? 'value positive' : 'value negative';
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
    try {
        const metrics = calculateAdvancedMetrics();
        
        // Update UI with proper formatting and error handling
        const sharpeElement = document.getElementById('sharpeRatio');
        const drawdownElement = document.getElementById('maxDrawdown');
        const profitFactorElement = document.getElementById('profitFactor');
        const riskRewardElement = document.getElementById('riskReward');
        const winStreakElement = document.getElementById('maxWinStreak');
        const lossStreakElement = document.getElementById('maxLossStreak');
        
        if (sharpeElement) {
            sharpeElement.textContent = isFinite(metrics.sharpeRatio) ? 
                metrics.sharpeRatio.toFixed(2) : '--';
        }
        
        if (drawdownElement) {
            drawdownElement.textContent = isFinite(metrics.maxDrawdown) ? 
                metrics.maxDrawdown.toFixed(1) + '%' : '--%';
        }
        
        if (profitFactorElement) {
            profitFactorElement.textContent = isFinite(metrics.profitFactor) ? 
                metrics.profitFactor.toFixed(2) : '--';
        }
        
        if (riskRewardElement) {
            riskRewardElement.textContent = isFinite(metrics.riskRewardRatio) ? 
                '1:' + metrics.riskRewardRatio.toFixed(2) : '--';
        }
        
        if (winStreakElement) {
            winStreakElement.textContent = metrics.streaks.maxWinStreak || 0;
        }
        
        if (lossStreakElement) {
            lossStreakElement.textContent = metrics.streaks.maxLossStreak || 0;
        }
        
        // Update additional displays
        updateProfitBreakdown(metrics);
        updateRiskRewardVisual(metrics.riskRewardRatio);
        
    } catch (error) {
        console.error('Error updating advanced stats:', error);
        resetAdvancedStatsDisplay();
    }
}

function calculateAdvancedMetrics() {
    // Validate input data
    if (!filteredData || filteredData.length === 0) {
        return getDefaultMetrics();
    }
    
    try {
        const returns = calculateDailyReturns();
        const sharpeRatio = calculateSharpeRatio(returns);
        const maxDrawdown = calculateMaxDrawdown();
        const profitFactor = calculateProfitFactor();
        const riskRewardRatio = calculateRiskRewardRatio();
        const streaks = calculateStreaks();
        
        return {
            sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
            maxDrawdown: isFinite(maxDrawdown) ? maxDrawdown : 0,
            profitFactor: isFinite(profitFactor) ? profitFactor : 0,
            riskRewardRatio: isFinite(riskRewardRatio) ? riskRewardRatio : 0,
            streaks: streaks,
            returns: returns
        };
    } catch (error) {
        console.error('Error calculating advanced metrics:', error);
        return getDefaultMetrics();
    }
}

function calculateDailyReturns() {
    try {
        const dailyPNL = {};
        
        filteredData.forEach(trade => {
            // Ensure we have valid close time
            const closeTime = trade.closeTime || trade.openTime;
            if (!closeTime || !(closeTime instanceof Date)) {
                console.warn('Invalid date in trade:', trade);
                return;
            }
            
            const date = closeTime.toISOString().split('T')[0];
            dailyPNL[date] = (dailyPNL[date] || 0) + (trade.pnl || 0);
        });
        
        const returns = Object.values(dailyPNL).filter(val => isFinite(val));
        return returns.length > 0 ? returns : [0];
        
    } catch (error) {
        console.error('Error calculating daily returns:', error);
        return [0];
    }
}

function calculateSharpeRatio(returns) {
    try {
        if (!returns || returns.length < 2) return 0;
        
        // Remove any non-finite values
        const validReturns = returns.filter(r => isFinite(r));
        if (validReturns.length < 2) return 0;
        
        const avgReturn = validReturns.reduce((a, b) => a + b, 0) / validReturns.length;
        
        // Calculate standard deviation
        const variance = validReturns.reduce((sq, n) => {
            return sq + Math.pow(n - avgReturn, 2);
        }, 0) / validReturns.length;
        
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return avgReturn > 0 ? 999 : 0;
        
        // For trading, we typically don't annualize or use risk-free rate
        // Simple Sharpe = Average Return / Standard Deviation
        const sharpe = avgReturn / stdDev;
        
        // Optional: Annualize if needed (assuming daily returns)
        // return sharpe * Math.sqrt(252);
        
        return sharpe;
        
    } catch (error) {
        console.error('Error calculating Sharpe ratio:', error);
        return 0;
    }
}

function calculateMaxDrawdown() {
    try {
        if (!filteredData || filteredData.length === 0) return 0;
        
        let peak = 0;
        let maxDD = 0;
        let cumPNL = 0;
        
        // Sort by close time (or open time if close time not available)
        const sortedData = [...filteredData].sort((a, b) => {
            const timeA = a.closeTime || a.openTime;
            const timeB = b.closeTime || b.openTime;
            return timeA - timeB;
        });
        
        sortedData.forEach(trade => {
            const pnl = trade.pnl || 0;
            cumPNL += pnl;
            
            if (cumPNL > peak) {
                peak = cumPNL;
            }
            
            const drawdown = peak - cumPNL;
            if (drawdown > maxDD) {
                maxDD = drawdown;
            }
        });
        
        // Return as percentage
        if (peak <= 0) return 0;
        return (maxDD / Math.abs(peak)) * 100;
        
    } catch (error) {
        console.error('Error calculating max drawdown:', error);
        return 0;
    }
}

function calculateProfitFactor() {
    try {
        if (!filteredData || filteredData.length === 0) return 0;
        
        const profits = filteredData
            .filter(t => t.pnl > 0)
            .reduce((sum, t) => sum + t.pnl, 0);
            
        const losses = Math.abs(filteredData
            .filter(t => t.pnl < 0)
            .reduce((sum, t) => sum + t.pnl, 0));
        
        if (losses === 0) {
            return profits > 0 ? 999 : 0; // Infinite profit factor
        }
        
        const pf = profits / losses;
        return isFinite(pf) ? pf : 0;
        
    } catch (error) {
        console.error('Error calculating profit factor:', error);
        return 0;
    }
}

function calculateRiskRewardRatio() {
    try {
        if (!filteredData || filteredData.length === 0) return 0;
        
        const wins = filteredData.filter(t => t.pnl > 0);
        const losses = filteredData.filter(t => t.pnl < 0);
        
        if (wins.length === 0 || losses.length === 0) return 0;
        
        const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
        const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);
        
        if (avgLoss === 0) return avgWin > 0 ? 999 : 0;
        
        const rr = avgWin / avgLoss;
        return isFinite(rr) ? rr : 0;
        
    } catch (error) {
        console.error('Error calculating risk reward ratio:', error);
        return 0;
    }
}

function calculateStreaks() {
    try {
        if (!filteredData || filteredData.length === 0) {
            return { maxWinStreak: 0, maxLossStreak: 0 };
        }
        
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        
        // Sort by close time or open time
        const sortedData = [...filteredData].sort((a, b) => {
            const timeA = a.closeTime || a.openTime;
            const timeB = b.closeTime || b.openTime;
            return timeA - timeB;
        });
        
        sortedData.forEach(trade => {
            const pnl = trade.pnl || 0;
            
            if (pnl > 0) {
                currentWinStreak++;
                currentLossStreak = 0;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
            } else if (pnl < 0) {
                currentLossStreak++;
                currentWinStreak = 0;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            }
            // If pnl === 0, we don't change streaks
        });
        
        return { 
            maxWinStreak: maxWinStreak || 0, 
            maxLossStreak: maxLossStreak || 0 
        };
        
    } catch (error) {
        console.error('Error calculating streaks:', error);
        return { maxWinStreak: 0, maxLossStreak: 0 };
    }
}

// Helper functions
function getDefaultMetrics() {
    return {
        sharpeRatio: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        riskRewardRatio: 0,
        streaks: { maxWinStreak: 0, maxLossStreak: 0 },
        returns: []
    };
}

function resetAdvancedStatsDisplay() {
    const elements = [
        'sharpeRatio', 'maxDrawdown', 'profitFactor', 
        'riskReward', 'maxWinStreak', 'maxLossStreak'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '--';
        }
    });
}

function updateProfitBreakdown(metrics) {
    try {
        const totalProfitElement = document.getElementById('totalProfit');
        const totalLossElement = document.getElementById('totalLoss');
        
        if (totalProfitElement && totalLossElement) {
            const profits = filteredData
                .filter(t => t.pnl > 0)
                .reduce((sum, t) => sum + t.pnl, 0);
                
            const losses = filteredData
                .filter(t => t.pnl < 0)
                .reduce((sum, t) => sum + t.pnl, 0);
            
            totalProfitElement.textContent = '+' + profits.toFixed(2);
            totalLossElement.textContent = losses.toFixed(2);
        }
    } catch (error) {
        console.error('Error updating profit breakdown:', error);
    }
}

function updateRiskRewardVisual(riskReward) {
    try {
        const rrRisk = document.querySelector('.rr-risk');
        const rrReward = document.querySelector('.rr-reward');
        
        if (rrRisk && rrReward && isFinite(riskReward) && riskReward > 0) {
            // Adjust flex ratio based on risk-reward
            const totalRatio = 1 + riskReward;
            const riskFlex = 1 / totalRatio;
            const rewardFlex = riskReward / totalRatio;
            
            rrRisk.style.flex = riskFlex;
            rrReward.style.flex = rewardFlex;
            
            rrRisk.textContent = 'Risk: 1';
            rrReward.textContent = `Reward: ${riskReward.toFixed(1)}`;
        }
    } catch (error) {
        console.error('Error updating risk-reward visual:', error);
    }
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

// Table variables
let currentPage = 1;
let pageSize = 25;
let sortColumn = 'closeTime';
let sortDirection = 'desc';
let searchTerm = '';

// Initialize table event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Existing code...
    
    // Table event listeners
    const tableSearch = document.getElementById('tableSearch');
    const pageSizeSelect = document.getElementById('pageSize');
    
    if (tableSearch) {
        tableSearch.addEventListener('input', function() {
            searchTerm = this.value.toLowerCase();
            currentPage = 1;
            updateTable();
        });
    }
    
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            currentPage = 1;
            updateTable();
        });
    }
    
    // Add table header click listeners
    setTimeout(() => {
        const sortableHeaders = document.querySelectorAll('.trading-table th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const column = this.dataset.sort;
                if (sortColumn === column) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = column;
                    sortDirection = 'desc';
                }
                updateSortIcons();
                updateTable();
            });
        });
    }, 100);
});

function updateTable() {
    if (!filteredData || filteredData.length === 0) {
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #666;">
                    📊 Không có dữ liệu để hiển thị
                </td>
            </tr>
        `;
        document.getElementById('paginationInfo').textContent = 'Hiển thị 0 - 0 của 0 giao dịch';
        return;
    }
    
    // Filter data based on search
    let tableData = filteredData.filter(trade => {
        if (!searchTerm) return true;
        return (
            trade.pair.toLowerCase().includes(searchTerm) ||
            trade.direction.toLowerCase().includes(searchTerm) ||
            formatCurrency(trade.pnl).toLowerCase().includes(searchTerm)
        );
    });
    
    // Sort data
    tableData.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        
        // Handle different data types
        if (sortColumn === 'openTime' || sortColumn === 'closeTime') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Pagination
    const totalItems = tableData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const pageData = tableData.slice(startIndex, endIndex);
    
    // Generate table rows
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = pageData.map(trade => `
        <tr>
            <td class="pair-cell">${trade.pair}</td>
            <td>
                <span class="direction-cell direction-${trade.direction.toLowerCase()}">
                    ${trade.direction === 'LONG' ? '📈' : '📉'} ${trade.direction}
                </span>
            </td>
            <td>${formatDateTime(trade.openTime)}</td>
            <td>${formatDateTime(trade.closeTime)}</td>
            <td class="text-right">${formatNumber(trade.quantity)}</td>
            <td class="text-right">${formatPrice(trade.openPrice)}</td>
            <td class="text-right">${formatPrice(trade.closePrice)}</td>
            <td class="text-right">
                <span class="pnl-cell ${trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
                    ${trade.pnl >= 0 ? '📈' : '📉'} ${formatCurrency(trade.pnl)}
                </span>
            </td>
            <td class="text-right">${formatCurrency(trade.fee || 0)}</td>
            <td>
                <span class="status-cell ${trade.pnl >= 0 ? 'status-profit' : 'status-loss'}">
                    ${trade.pnl >= 0 ? '✅ Lãi' : '❌ Lỗ'}
                </span>
            </td>
        </tr>
    `).join('');
    
    // Update pagination info
    document.getElementById('paginationInfo').textContent = 
        `Hiển thị ${startIndex + 1} - ${endIndex} của ${totalItems} giao dịch`;
    
    // Update pagination controls
    updatePaginationControls(totalPages);
}

function updateSortIcons() {
    const headers = document.querySelectorAll('.trading-table th.sortable');
    headers.forEach(header => {
        const icon = header.querySelector('.sort-icon');
        if (header.dataset.sort === sortColumn) {
            icon.textContent = sortDirection === 'asc' ? '↑' : '↓';
            header.style.background = 'rgba(255, 255, 255, 0.1)';
        } else {
            icon.textContent = '↕️';
            header.style.background = '';
        }
    });
}

function updatePaginationControls(totalPages) {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    
    // Update prev/next buttons
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    // Generate page numbers
    let pageNumbersHTML = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        pageNumbersHTML += `<span class="page-number" onclick="goToPage(1)">1</span>`;
        if (startPage > 2) {
            pageNumbersHTML += `<span class="page-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pageNumbersHTML += `
            <span class="page-number ${i === currentPage ? 'active' : ''}" 
                  onclick="goToPage(${i})">${i}</span>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageNumbersHTML += `<span class="page-ellipsis">...</span>`;
        }
        pageNumbersHTML += `<span class="page-number" onclick="goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = pageNumbersHTML;
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    currentPage = Math.max(1, Math.min(totalPages, currentPage + direction));
    updateTable();
}

function goToPage(page) {
    currentPage = page;
    updateTable();
}

// Utility functions
function formatDateTime(date) {
    if (!date) return '--';
    return new Date(date).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatNumber(num) {
    if (num === undefined || num === null) return '--';
    return parseFloat(num).toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8
    });
}

function formatPrice(price) {
    if (price === undefined || price === null) return '--';
    return parseFloat(price).toLocaleString('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    });
}

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '0 USDT';
    return parseFloat(amount).toLocaleString('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' USDT';
}

console.log('Trading Dashboard initialized successfully!');