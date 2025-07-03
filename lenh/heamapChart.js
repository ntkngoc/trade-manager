
// Heatmap PNL theo ngày trong tháng
function drawHeatmap(heatmapData) {
  if (typeof Chart === 'undefined' || !Chart.controllers || !Chart.controllers.matrix) {
    console.error('Matrix controller chưa được đăng ký. Heatmap không thể hiển thị.');
    return;
  }
  // Chuyển dữ liệu sang dạng [{x: ngày, y: tháng, v: lãi/lỗ}]
  const dataArr = [];
  Object.keys(heatmapData).forEach(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    dataArr.push({
      x: day,
      y: month,
      v: heatmapData[dateStr]
    });
  });

  if (dataArr.length === 0) return;

  // Tìm min/max để chuẩn hóa màu
  const values = dataArr.map(d => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Chuẩn bị dữ liệu cho Chart.js matrix
  const chartData = {
    datasets: [{
      label: 'Lãi/lỗ theo ngày',
      data: dataArr.map(d => ({
        x: d.x,
        y: d.y,
        v: d.v
      })),
      backgroundColor: ctx => {
        const v = ctx.raw.v;
        // Xanh lãi, đỏ lỗ, trắng trung tính
        if (v > 0) return `rgba(0, 200, 0, ${0.2 + 0.8 * v / (max || 1)})`;
        if (v < 0) return `rgba(255, 0, 0, ${0.2 + 0.8 * v / (min || -1)})`;
        return 'rgba(255,255,255,0.5)';
      },
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)'
    }]
  };

  // Xóa chart cũ nếu có
  if (window.heatmapChart) window.heatmapChart.destroy();

  const ctx = document.getElementById('heatmapCanvas').getContext('2d');
  window.heatmapChart = new Chart(ctx, {
    type: 'matrix',
    data: chartData,
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Ngày: ${items[0].raw.x}/${items[0].raw.y}`,
            label: (item) => `Lãi/lỗ: ${item.raw.v.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Ngày trong tháng' },
          min: 1, max: 31, stepSize: 1,
          ticks: { stepSize: 1 }
        },
        y: {
          type: 'linear',
          title: { display: true, text: 'Tháng' },
          min: 1, max: 12, stepSize: 1,
          reverse: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}
