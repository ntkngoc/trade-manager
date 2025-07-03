

function drawPie(id, label, obj, doughnut = false) {
  if (charts[id]) charts[id].destroy();
  const labels = Object.keys(obj);
  const data = Object.values(obj);
  const bgColors = [
    'rgba(99,102,241,0.8)','rgba(16,185,129,0.8)','rgba(245,158,11,0.8)',
    'rgba(239,68,68,0.8)','rgba(79,172,254,0.8)','rgba(168,85,247,0.8)','rgba(251,191,36,0.8)'
  ];
  charts[id] = new Chart(document.getElementById(id), {
    type: doughnut ? 'doughnut' : 'pie',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: bgColors }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: { display: false }
      }
    }
  });
}