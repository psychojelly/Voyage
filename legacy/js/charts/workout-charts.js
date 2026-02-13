import { createChart, getDayLabels } from './chart-manager.js';

export function renderWorkoutCharts(data) {
  renderStats(data);
  renderStepsChart(data);
  renderCaloriesChart(data);
  renderActiveChart(data);
}

function renderStats(data) {
  const el = document.getElementById('workout-stats');
  if (!data.length) { el.innerHTML = '<p style="color:var(--text-muted)">No workout data for this month</p>'; return; }

  const vals = data.map(d => d.workout).filter(Boolean);
  const avgSteps = Math.round(vals.reduce((s, v) => s + (v.steps || 0), 0) / vals.length);
  const avgCals = Math.round(vals.reduce((s, v) => s + (v.calories_active || 0), 0) / vals.length);
  const avgActive = Math.round(vals.reduce((s, v) => s + (v.active_min || 0), 0) / vals.length);
  const avgScore = Math.round(vals.reduce((s, v) => s + (v.activity_score || 0), 0) / vals.length);

  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${avgSteps.toLocaleString()}</div><div class="stat-label">Avg Steps</div></div>
    <div class="stat-card"><div class="stat-value">${avgCals}</div><div class="stat-label">Avg Calories</div></div>
    <div class="stat-card"><div class="stat-value">${avgActive}m</div><div class="stat-label">Avg Active Time</div></div>
    <div class="stat-card"><div class="stat-value">${avgScore}</div><div class="stat-label">Avg Activity Score</div></div>
  `;
}

function renderStepsChart(data) {
  const labels = getDayLabels(data);
  const steps = data.map(d => d.workout?.steps || 0);

  createChart('workout-steps-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Steps',
        data: steps,
        backgroundColor: steps.map(s => s >= 10000
          ? 'rgba(85, 239, 196, 0.7)'
          : s >= 7000
            ? 'rgba(85, 239, 196, 0.4)'
            : 'rgba(85, 239, 196, 0.2)'),
        borderColor: '#55efc4',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: 'Steps', color: '#55556a' } },
      },
    },
  });
}

function renderCaloriesChart(data) {
  const labels = getDayLabels(data);
  const cals = data.map(d => d.workout?.calories_active || 0);

  createChart('workout-calories-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Active Calories',
        data: cals,
        borderColor: '#55efc4',
        backgroundColor: 'rgba(85, 239, 196, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#55efc4',
      }],
    },
    options: {
      scales: {
        y: { title: { display: true, text: 'kcal', color: '#55556a' } },
      },
    },
  });
}

function renderActiveChart(data) {
  const labels = getDayLabels(data);
  const active = data.map(d => d.workout?.active_min || 0);

  createChart('workout-active-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Active Minutes',
        data: active,
        backgroundColor: 'rgba(0, 206, 209, 0.5)',
        borderColor: '#00cec9',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: 'Minutes', color: '#55556a' } },
      },
    },
  });
}
