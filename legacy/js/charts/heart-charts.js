import { createChart, getDayLabels } from './chart-manager.js';

export function renderHeartCharts(data) {
  renderStats(data);
  renderRestingChart(data);
  renderHrvChart(data);
  renderRangeChart(data);
}

function renderStats(data) {
  const el = document.getElementById('heart-stats');
  if (!data.length) { el.innerHTML = '<p style="color:var(--text-muted)">No heart rate data for this month</p>'; return; }

  const vals = data.map(d => d.heart).filter(Boolean);
  const avgResting = Math.round(vals.reduce((s, v) => s + (v.resting_hr || 0), 0) / vals.length);
  const avgHrv = Math.round(vals.reduce((s, v) => s + (v.hrv_avg || 0), 0) / vals.length);
  const minHr = Math.min(...vals.map(v => v.hr_min || 999).filter(v => v < 999));
  const maxHr = Math.max(...vals.map(v => v.hr_max || 0));

  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${avgResting}</div><div class="stat-label">Avg Resting HR</div></div>
    <div class="stat-card"><div class="stat-value">${avgHrv}ms</div><div class="stat-label">Avg HRV</div></div>
    <div class="stat-card"><div class="stat-value">${minHr}</div><div class="stat-label">Lowest HR</div></div>
    <div class="stat-card"><div class="stat-value">${maxHr}</div><div class="stat-label">Highest HR</div></div>
  `;
}

function renderRestingChart(data) {
  const labels = getDayLabels(data);
  const resting = data.map(d => d.heart?.resting_hr || 0);

  createChart('heart-resting-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Resting HR',
        data: resting,
        borderColor: '#ff6b6b',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#ff6b6b',
      }],
    },
    options: {
      scales: {
        y: { title: { display: true, text: 'BPM', color: '#55556a' } },
      },
    },
  });
}

function renderHrvChart(data) {
  const labels = getDayLabels(data);
  const hrv = data.map(d => d.heart?.hrv_avg || 0);

  createChart('heart-hrv-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'HRV',
        data: hrv,
        borderColor: '#fd79a8',
        backgroundColor: 'rgba(253, 121, 168, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#fd79a8',
      }],
    },
    options: {
      scales: {
        y: { title: { display: true, text: 'ms', color: '#55556a' } },
      },
    },
  });
}

function renderRangeChart(data) {
  const labels = getDayLabels(data);
  const mins = data.map(d => d.heart?.hr_min || 0);
  const maxs = data.map(d => d.heart?.hr_max || 0);

  createChart('heart-range-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Min HR',
          data: mins,
          backgroundColor: 'rgba(255, 107, 107, 0.4)',
          borderColor: '#ff6b6b',
          borderWidth: 1,
        },
        {
          label: 'Max HR',
          data: maxs,
          backgroundColor: 'rgba(253, 121, 168, 0.4)',
          borderColor: '#fd79a8',
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: { title: { display: true, text: 'BPM', color: '#55556a' } },
      },
    },
  });
}
