import { createChart, getDayLabels } from './chart-manager.js';

export function renderSleepCharts(data) {
  renderStats(data);
  renderStagesChart(data);
  renderDurationChart(data);
  renderReadinessChart(data);
}

function renderStats(data) {
  const el = document.getElementById('sleep-stats');
  if (!data.length) { el.innerHTML = '<p style="color:var(--text-muted)">No sleep data for this month</p>'; return; }

  const vals = data.map(d => d.sleep).filter(Boolean);
  const avgDuration = (vals.reduce((s, v) => s + (v.duration_hours || 0), 0) / vals.length).toFixed(1);
  const avgEfficiency = Math.round(vals.reduce((s, v) => s + (v.efficiency || 0), 0) / vals.length);
  const avgReadiness = Math.round(vals.reduce((s, v) => s + (v.readiness_score || 0), 0) / vals.length);
  const avgDeep = Math.round(vals.reduce((s, v) => s + (v.deep_min || 0), 0) / vals.length);

  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${avgDuration}h</div><div class="stat-label">Avg Duration</div></div>
    <div class="stat-card"><div class="stat-value">${avgEfficiency}%</div><div class="stat-label">Avg Efficiency</div></div>
    <div class="stat-card"><div class="stat-value">${avgReadiness}</div><div class="stat-label">Avg Readiness</div></div>
    <div class="stat-card"><div class="stat-value">${avgDeep}m</div><div class="stat-label">Avg Deep Sleep</div></div>
  `;
}

function renderStagesChart(data) {
  const labels = getDayLabels(data);
  const sleepData = data.map(d => d.sleep || {});

  createChart('sleep-stages-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Deep', data: sleepData.map(s => s.deep_min || 0), backgroundColor: '#0984e3', stack: 'stack' },
        { label: 'REM', data: sleepData.map(s => s.rem_min || 0), backgroundColor: '#6c5ce7', stack: 'stack' },
        { label: 'Light', data: sleepData.map(s => s.light_min || 0), backgroundColor: '#74b9ff', stack: 'stack' },
        { label: 'Awake', data: sleepData.map(s => s.awake_min || 0), backgroundColor: '#636e72', stack: 'stack' },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'Minutes', color: '#55556a' } },
      },
    },
  });
}

function renderDurationChart(data) {
  const labels = getDayLabels(data);
  const durations = data.map(d => d.sleep?.duration_hours || 0);

  createChart('sleep-duration-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hours',
        data: durations,
        borderColor: '#74b9ff',
        backgroundColor: 'rgba(116, 185, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#74b9ff',
      }],
    },
    options: {
      scales: {
        y: {
          min: 4,
          max: 10,
          title: { display: true, text: 'Hours', color: '#55556a' },
        },
      },
    },
  });
}

function renderReadinessChart(data) {
  const labels = getDayLabels(data);
  const scores = data.map(d => d.sleep?.readiness_score || 0);

  createChart('sleep-readiness-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Readiness',
        data: scores,
        borderColor: '#a29bfe',
        backgroundColor: 'rgba(162, 155, 254, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#a29bfe',
      }],
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: 100,
          title: { display: true, text: 'Score', color: '#55556a' },
        },
      },
    },
  });
}
