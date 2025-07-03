// Đăng ký Matrix Controller cho Chart.js
document.addEventListener('DOMContentLoaded', function() {
  if (typeof Chart !== 'undefined') {
    // Đăng ký controller matrix
    if (typeof window.ChartMatrix !== 'undefined') {
      Chart.register(window.ChartMatrix);
    } else {
      console.error('chartjs-chart-matrix không được load. Heatmap sẽ không hoạt động.');
    }
  }
});

// Helper: parse số có dấu phẩy, số âm
function parseNum(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', handleFile);

let charts = {};

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    analyze(json);
  };
  reader.readAsArrayBuffer(file);
}



function analyze(data) {
  if (!data.length) return;
  const headers = data[0];
  const rows = data.slice(1).filter(r => r.length >= headers.length);

  const idx = {};
  headers.forEach((h, i) => idx[h.trim()] = i);

  // Tổng hợp
  let totalOrders = 0, totalPNL = 0, totalFee = 0, totalVolume = 0, totalLeverage = 0;
  let pairCount = {}, pairVolume = {}, sideCount = {}, orderTypeCount = {}, leverageDist = {};
  let pnlByDay = {}, feeByDay = {}, volumeByDay = {};

  // Chuyên sâu
  let pairPNL = {}, pairFee = {};
  let sidePNL = {}, sideWins = {}, sideLosses = {};
  let levPNL = {}, levWin = {}, levLoss = {}, levCount = {};
  let orderTypePNL = {}, orderTypeWin = {}, orderTypeLoss = {};
  let hourCount = {}, hourPNL = {};

  // Chuỗi thắng/thua
  let streak = 0, maxWinStreak = 0, maxLoseStreak = 0, curr = null;
  let winStreaks = 0, loseStreaks = 0;

  // Chuỗi thời gian
  let equity = [0]; // vốn giả định, bắt đầu từ 0
  let equityDates = [];
  let drawdowns = [];
  let maxEquity = 0;

  // Heatmap
  let heatmap = {}; // { 'YYYY-MM-DD': pnl }
  let scatterPNLLev = []; // {x: leverage, y: pnl}

  // Hành vi giao dịch
  let revengeCount = 0, fomoCount = 0, longLoseStreaks = 0, shortLoseStreaks = 0;
  let lastSide = null, lastPNL = 0, lastTime = null;

  rows.forEach((r, i) => {
    totalOrders++;
    const date = (r[idx['Thời gian']] || '').slice(0, 10);
    const pair = r[idx['Cặp giao dịch Futures']] || '';
    const pnl = parseNum(r[idx['PNL đóng']]);
    const fee = parseNum(r[idx['Phí giao dịch']]);
    const qty = parseNum(r[idx['Số lượng khớp lệnh (Cont)']]) || parseNum(r[idx['Số lượng khớp lệnh (Số lượng)']]);
    const side = (r[idx['Phương hướng']] || '').toLowerCase();
    const orderType = (r[idx['Loại lệnh']] || '').toUpperCase();
    const leverage = parseNum(r[idx['Hệ số đòn bẩy']]);
    const time = r[idx['Thời gian']] || '';
    const hour = time ? (new Date(time.replace(' ', 'T')).getHours()) : 0;

    totalPNL += pnl;
    totalFee += fee;
    totalVolume += qty;
    totalLeverage += leverage;

    // Cặp giao dịch
    pairCount[pair] = (pairCount[pair] || 0) + 1;
    pairVolume[pair] = (pairVolume[pair] || 0) + qty;
    pairPNL[pair] = (pairPNL[pair] || 0) + pnl;
    pairFee[pair] = (pairFee[pair] || 0) + fee;

    // Theo hướng
    sideCount[side] = (sideCount[side] || 0) + 1;
    sidePNL[side] = (sidePNL[side] || 0) + pnl;
    if (pnl > 0) sideWins[side] = (sideWins[side] || 0) + 1;
    else if (pnl < 0) sideLosses[side] = (sideLosses[side] || 0) + 1;

    // Loại lệnh
    orderTypeCount[orderType] = (orderTypeCount[orderType] || 0) + 1;
    orderTypePNL[orderType] = (orderTypePNL[orderType] || 0) + pnl;
    if (pnl > 0) orderTypeWin[orderType] = (orderTypeWin[orderType] || 0) + 1;
    else if (pnl < 0) orderTypeLoss[orderType] = (orderTypeLoss[orderType] || 0) + 1;

    // Đòn bẩy
    const levKey = leverage + 'x';
    leverageDist[levKey] = (leverageDist[levKey] || 0) + 1;
    levPNL[levKey] = (levPNL[levKey] || 0) + pnl;
    levCount[levKey] = (levCount[levKey] || 0) + 1;
    if (pnl > 0) levWin[levKey] = (levWin[levKey] || 0) + 1;
    else if (pnl < 0) levLoss[levKey] = (levLoss[levKey] || 0) + 1;

    // Theo ngày
    pnlByDay[date] = (pnlByDay[date] || 0) + pnl;
    feeByDay[date] = (feeByDay[date] || 0) + fee;
    volumeByDay[date] = (volumeByDay[date] || 0) + qty;

    // Theo giờ
    hourCount[hour] = (hourCount[hour] || 0) + 1;
    hourPNL[hour] = (hourPNL[hour] || 0) + pnl;

    // Chuỗi thắng/thua
    if (pnl > 0) {
      if (curr === 'win') streak++; else { streak = 1; curr = 'win'; }
      if (streak > maxWinStreak) maxWinStreak = streak;
      if (streak === 3) winStreaks++;
    } else if (pnl < 0) {
      if (curr === 'lose') streak++; else { streak = 1; curr = 'lose'; }
      if (streak > maxLoseStreak) maxLoseStreak = streak;
      if (streak === 3) loseStreaks++;
    } else {
      streak = 0; curr = null;
    }

    // Chuỗi thời gian vốn giả định
    equity.push(equity[equity.length - 1] + pnl);
    equityDates.push(date);
    if (equity[equity.length - 1] > maxEquity) maxEquity = equity[equity.length - 1];
    drawdowns.push(maxEquity - equity[equity.length - 1]);

    // Heatmap
    heatmap[date] = (heatmap[date] || 0) + pnl;

    // Scatter plot
    scatterPNLLev.push({x: leverage, y: pnl});

    // Hành vi giao dịch (revenge/FOMO)
    if (i > 0) {
      // Nếu vừa thua và vào lệnh mới cùng cặp, cùng hướng, cùng loại lệnh trong vòng 5 phút => revenge
      let prev = rows[i-1];
      let prevPNL = parseNum(prev[idx['PNL đóng']]);
      let prevPair = prev[idx['Cặp giao dịch Futures']];
      let prevSide = (prev[idx['Phương hướng']] || '').toLowerCase();
      let prevOrderType = (prev[idx['Loại lệnh']] || '').toUpperCase();
      let prevTime = prev[idx['Thời gian']] || '';
      let prevDate = new Date(prevTime.replace(' ', 'T'));
      let currDate = new Date(time.replace(' ', 'T'));
      let diff = (currDate - prevDate) / 60000; // phút
      if (prevPNL < 0 && prevPair === pair && prevSide === side && prevOrderType === orderType && diff <= 5) revengeCount++;
      // Nếu vừa thắng và vào lệnh mới cùng hướng, cùng loại lệnh trong vòng 5 phút => FOMO
      if (prevPNL > 0 && prevSide === side && prevOrderType === orderType && diff <= 5) fomoCount++;
    }
    // Chuỗi thua liên tiếp theo hướng
    if (side === 'long' && pnl < 0) longLoseStreaks++;
    if (side === 'short' && pnl < 0) shortLoseStreaks++;
  });

  // KPI
  document.getElementById('totalOrders').textContent = totalOrders;
  document.getElementById('totalPNL').textContent = totalPNL.toFixed(4);
  document.getElementById('totalFee').textContent = totalFee.toFixed(4);
  document.getElementById('topPair').textContent = Object.entries(pairCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  document.getElementById('totalVolume').textContent = totalVolume.toLocaleString();
  document.getElementById('avgLeverage').textContent = (totalLeverage / totalOrders).toFixed(2) + 'x';
  document.getElementById('streakInfo').innerHTML = `
    <b>Chuỗi thắng dài nhất:</b> ${maxWinStreak} lệnh<br>
    <b>Chuỗi thua dài nhất:</b> ${maxLoseStreak} lệnh<br>
    <b>Số chuỗi thắng ≥3:</b> ${winStreaks}, <b>chuỗi thua ≥3:</b> ${loseStreaks}
  `;

  // Các chỉ số nâng cao
  let dailyPNLs = Object.values(pnlByDay);
  let avgPNL = dailyPNLs.reduce((a, b) => a + b, 0) / dailyPNLs.length;
  let stdPNL = Math.sqrt(dailyPNLs.reduce((a, b) => a + Math.pow(b - avgPNL, 2), 0) / (dailyPNLs.length || 1));
  let sharpe = stdPNL ? (avgPNL / stdPNL).toFixed(2) : 'N/A';

  let maxDrawdown = Math.max(...drawdowns).toFixed(4);
  let winCount = sortedByPNL(rows, idx).filter(r => r['PNL đóng'] > 0).length;
  let lossCount = sortedByPNL(rows, idx).filter(r => r['PNL đóng'] < 0).length;
  let grossProfit = sortedByPNL(rows, idx).filter(r => r['PNL đóng'] > 0).reduce((a, b) => a + b['PNL đóng'], 0);
  let grossLoss = Math.abs(sortedByPNL(rows, idx).filter(r => r['PNL đóng'] < 0).reduce((a, b) => a + b['PNL đóng'], 0));
  let profitFactor = grossLoss ? (grossProfit / grossLoss).toFixed(2) : 'N/A';
  let expectancy = ((grossProfit - grossLoss) / totalOrders).toFixed(4);

  document.getElementById('advancedIndicators').innerHTML = `
    <b>Các chỉ số nâng cao:</b>
    <span><b>Sharpe Ratio:</b> ${sharpe}</span>
    <span><b>Max Drawdown:</b> ${maxDrawdown}</span>
    <span><b>Profit Factor:</b> ${profitFactor}</span>
    <span><b>Expectancy:</b> ${expectancy}</span>
    <span><b>Số ngày thắng:</b> ${winCount}</span>
    <span><b>Số ngày thua:</b> ${lossCount}</span>
  `;

  // Phân tích hành vi
  document.getElementById('behaviorBlock').innerHTML = `
    <h3>Phân tích hành vi giao dịch</h3>
    <ul>
      <li><b>Số lần revenge trade:</b> ${revengeCount}</li>
      <li><b>Số lần FOMO trade:</b> ${fomoCount}</li>
      <li><b>Chuỗi thua liên tiếp (Long):</b> ${longLoseStreaks}</li>
      <li><b>Chuỗi thua liên tiếp (Short):</b> ${shortLoseStreaks}</li>
      <li><b>Cảnh báo:</b> ${maxLoseStreak > 5 ? 'Có chuỗi thua dài bất thường!' : 'Bình thường'}</li>
    </ul>
  `;

  // Top N lệnh lãi/lỗ lớn nhất
  const N = 10;
  let sorted = sortedByPNL(rows, idx);
  const topProfit = [...sorted].sort((a, b) => b['PNL đóng'] - a['PNL đóng']).slice(0, N);
  const topLoss = [...sorted].sort((a, b) => a['PNL đóng'] - b['PNL đóng']).slice(0, N);

  const tableHeaders = ['Thời gian','Cặp','Phương hướng','Loại lệnh','Đòn bẩy','Số lượng','PNL đóng','Phí giao dịch'];
  renderTopTable('topProfitTable', topProfit, tableHeaders);
  renderTopTable('topLossTable', topLoss, tableHeaders);

  // Vẽ chart tổng quan
  drawChart('pnlByDay', 'Lãi/Lỗ theo ngày', Object.keys(pnlByDay), Object.values(pnlByDay), 'bar', val => val >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');
  drawChart('feeByDay', 'Phí giao dịch theo ngày', Object.keys(feeByDay), Object.values(feeByDay), 'line', () => 'rgba(99,102,241,0.8)');
  drawChart('volumeByDay', 'Khối lượng giao dịch theo ngày', Object.keys(volumeByDay), Object.values(volumeByDay), 'bar', () => 'rgba(245,158,11,0.8)');
  drawPie('pairPie', 'Tỷ lệ lệnh theo cặp', pairCount);
  drawPie('sideDonut', 'Tỷ lệ lệnh theo hướng', sideCount, true);
  drawChart('leverageBar', 'Tần suất các mức đòn bẩy', Object.keys(leverageDist), Object.values(leverageDist), 'bar', () => 'rgba(79,172,254,0.8)');
  drawChart('orderTypeBar', 'Tỷ lệ lệnh LIMIT/MARKET', Object.keys(orderTypeCount), Object.values(orderTypeCount), 'bar', () => 'rgba(239,68,68,0.8)');

  // Chuyên sâu
  drawChart('pairPNLBar', 'Lãi/Lỗ theo cặp', Object.keys(pairPNL), Object.values(pairPNL), 'bar', v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');
  drawChart('pairFeeBar', 'Phí giao dịch theo cặp', Object.keys(pairFee), Object.values(pairFee), 'bar', () => 'rgba(99,102,241,0.8)');
  drawChart('sidePNLBar', 'Lãi/Lỗ theo hướng', Object.keys(sidePNL), Object.values(sidePNL), 'bar', v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');
  drawChart('sideWinRate', 'Tỷ lệ thắng (%) theo hướng', Object.keys(sideWins), Object.keys(sideWins).map(s => 100 * (sideWins[s] || 0) / ((sideWins[s] || 0) + (sideLosses[s] || 0) || 1)), 'bar', () => 'rgba(245,158,11,0.8)');
  drawChart('levPNLBar', 'Lãi/Lỗ theo đòn bẩy', Object.keys(levPNL), Object.values(levPNL), 'bar', v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');
  drawChart('levWinRate', 'Tỷ lệ thắng (%) theo đòn bẩy', Object.keys(levWin), Object.keys(levWin).map(l => 100 * (levWin[l] || 0) / ((levWin[l] || 0) + (levLoss[l] || 0) || 1)), 'bar', () => 'rgba(168,85,247,0.8)');
  drawChart('orderTypePNLBar', 'Lãi/Lỗ theo loại lệnh', Object.keys(orderTypePNL), Object.values(orderTypePNL), 'bar', v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');
  drawChart('orderTypeWinRate', 'Tỷ lệ thắng (%) theo loại lệnh', Object.keys(orderTypeWin), Object.keys(orderTypeWin).map(t => 100 * (orderTypeWin[t] || 0) / ((orderTypeWin[t] || 0) + (orderTypeLoss[t] || 0) || 1)), 'bar', () => 'rgba(251,191,36,0.8)');
  drawChart('hourOrderBar', 'Số lệnh theo giờ', Object.keys(hourCount), Object.values(hourCount), 'bar', () => 'rgba(79,172,254,0.8)');
  drawChart('hourPNLBar', 'Lãi/Lỗ theo giờ', Object.keys(hourPNL), Object.values(hourPNL), 'bar', v => v >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)');

  // Biểu đồ vốn giả định
  drawChart('equityCurve', 'Equity Curve', equityDates, equity.slice(1), 'line', () => 'rgba(16,185,129,0.8)');
  // Biểu đồ Max Drawdown
  drawChart('drawdownCurve', 'Max Drawdown', equityDates, drawdowns, 'line', () => 'rgba(239,68,68,0.8)');

  // Heatmap PNL theo ngày trong tháng
  setTimeout(() => drawHeatmap(heatmap), 500);

  // Scatter plot PNL vs đòn bẩy
  drawScatter('scatterPNLLev', scatterPNLLev);
}

function renderTopTable(tableId, rows, headers) {
  const table = document.getElementById(tableId);
  let html = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
  for (const r of rows) {
    html += "<tr>" + headers.map(h => `<td>${r[h] ?? ''}</td>`).join("") + "</tr>";
  }
  table.innerHTML = html;
}

// Helper: trả về danh sách lệnh chuẩn hóa cho top lãi/lỗ
function sortedByPNL(rows, idx) {
  return rows.map(r => ({
    'Thời gian': r[idx['Thời gian']],
    'Cặp': r[idx['Cặp giao dịch Futures']],
    'Phương hướng': r[idx['Phương hướng']],
    'Loại lệnh': r[idx['Loại lệnh']],
    'Đòn bẩy': r[idx['Hệ số đòn bẩy']],
    'Số lượng': r[idx['Số lượng khớp lệnh (Cont)']] ?? r[idx['Số lượng khớp lệnh (Số lượng)']],
    'PNL đóng': parseNum(r[idx['PNL đóng']]),
    'Phí giao dịch': parseNum(r[idx['Phí giao dịch']])
  }))
  .filter(r => typeof r['PNL đóng'] === 'number' && !isNaN(r['PNL đóng']));
}
