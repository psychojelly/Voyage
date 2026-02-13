const instances = {};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: {
      labels: { color: '#8888a0', font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: '#1a1a2e',
      titleColor: '#e8e8f0',
      bodyColor: '#e8e8f0',
      borderColor: '#2a2a40',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      ticks: { color: '#55556a', font: { size: 10 } },
      grid: { color: 'rgba(42, 42, 64, 0.5)' },
    },
    y: {
      ticks: { color: '#55556a', font: { size: 10 } },
      grid: { color: 'rgba(42, 42, 64, 0.5)' },
    },
  },
};

export function createChart(canvasId, config) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Merge defaults
  const mergedConfig = {
    ...config,
    options: mergeDeep(structuredClone(CHART_DEFAULTS), config.options || {}),
  };

  const chart = new Chart(canvas, mergedConfig);
  instances[canvasId] = chart;
  return chart;
}

export function destroyChart(canvasId) {
  if (instances[canvasId]) {
    instances[canvasId].destroy();
    delete instances[canvasId];
  }
}

export function destroyAll() {
  Object.keys(instances).forEach(destroyChart);
}

export function getDayLabels(data) {
  return data.map(d => {
    const day = parseInt(d.date.slice(8), 10);
    return day.toString();
  });
}

function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
