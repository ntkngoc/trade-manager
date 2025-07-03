// Scatter plot: PNL vs đòn bẩy
function drawScatter(id, data) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'PNL vs Đòn bẩy',
        data,
        backgroundColor: ctx => ctx.raw.y >= 0 ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Đòn bẩy: ${ctx.raw.x}x, PNL: ${ctx.raw.y.toFixed(4)}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Đòn bẩy (x)' },
          beginAtZero: true
        },
        y: {
          title: { display: true, text: 'PNL' },
          beginAtZero: false
        }
      }
    }
  });
}
