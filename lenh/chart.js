

function drawChart(id, label, labels, data, type, colorFn) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: typeof colorFn === 'function' ? data.map(colorFn) : colorFn,
        borderColor: '#3334',
        borderWidth: 1,
        fill: type === 'line'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}