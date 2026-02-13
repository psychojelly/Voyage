import { getMonthData, saveDays, clearAllData, loadSettings, saveSettings } from './store.js';
import { initFileImport } from './file-import.js';
import { initOuraSettings } from './oura-api.js';
import { renderSleepCharts } from './charts/sleep-charts.js';
import { renderHeartCharts } from './charts/heart-charts.js';
import { renderWorkoutCharts } from './charts/workout-charts.js';
import { destroyAll } from './charts/chart-manager.js';
import { SceneManager, InlineSceneManager } from './three/scene-manager.js';
import { ParticleField } from './three/backgrounds/particle-field.js';
import { WaveSurface } from './three/backgrounds/wave-surface.js';
import { SleepTerrain } from './three/data-viz/sleep-terrain.js';
import { MetricSpheres } from './three/data-viz/metric-spheres.js';

// State
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let bgSceneManager = null;
let sleepSceneManager = null;
let spheresSceneManager = null;
let currentBgEffect = 'particles';

// Month names
const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ===== Init =====
async function init() {
  // Load sample data on first run
  await loadSampleDataIfEmpty();

  // Init modules
  initFileImport();
  initOuraSettings();
  initSettings();
  initMonthNav();
  initThreeJS();

  // Render current month
  renderMonth();

  // Listen for data updates
  window.addEventListener('data-updated', () => renderMonth());
}

// ===== Sample Data =====
async function loadSampleDataIfEmpty() {
  const data = getMonthData(2026, 1);
  if (data.length > 0) return; // Already have data

  try {
    const response = await fetch('data/sample-data.json');
    const sampleData = await response.json();
    saveDays(sampleData);
    // Set view to the sample data month
    currentYear = 2026;
    currentMonth = 1;
  } catch (err) {
    console.warn('Could not load sample data:', err);
  }
}

// ===== Month Navigation =====
function initMonthNav() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    renderMonth();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    renderMonth();
  });
}

function updateMonthLabel() {
  document.getElementById('month-label').textContent = `${MONTHS[currentMonth]} ${currentYear}`;
}

// ===== Settings =====
function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggle = document.getElementById('settings-toggle');
  const close = document.getElementById('settings-close');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  document.body.appendChild(overlay);

  function openSettings() {
    panel.classList.add('open');
    overlay.classList.add('active');
  }

  function closeSettings() {
    panel.classList.remove('open');
    overlay.classList.remove('active');
  }

  toggle.addEventListener('click', openSettings);
  close.addEventListener('click', closeSettings);
  overlay.addEventListener('click', closeSettings);

  // Background effect selector
  const bgSelect = document.getElementById('bg-effect');
  const settings = loadSettings();
  if (settings.bgEffect) {
    bgSelect.value = settings.bgEffect;
    currentBgEffect = settings.bgEffect;
  }
  bgSelect.addEventListener('change', () => {
    currentBgEffect = bgSelect.value;
    saveSettings({ bgEffect: currentBgEffect });
    setBgEffect(currentBgEffect);
  });

  // Clear data button
  document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all health data?')) {
      clearAllData();
      renderMonth();
    }
  });
}

// ===== Three.js =====
function initThreeJS() {
  // Background scene
  const bgCanvas = document.getElementById('bg-canvas');
  bgSceneManager = new SceneManager(bgCanvas);
  setBgEffect(currentBgEffect);
  bgSceneManager.start();

  // Sleep terrain
  const sleepCanvas = document.getElementById('sleep-terrain-canvas');
  if (sleepCanvas) {
    sleepSceneManager = new InlineSceneManager(sleepCanvas);
    sleepSceneManager.setEffect(new SleepTerrain());
    sleepSceneManager.start();
  }

  // Metric spheres
  const spheresCanvas = document.getElementById('metric-spheres-canvas');
  if (spheresCanvas) {
    spheresSceneManager = new InlineSceneManager(spheresCanvas);
    spheresSceneManager.setEffect(new MetricSpheres());
    spheresSceneManager.start();
  }
}

function setBgEffect(effectName) {
  if (!bgSceneManager) return;
  switch (effectName) {
    case 'particles':
      bgSceneManager.setEffect(new ParticleField());
      break;
    case 'waves':
      bgSceneManager.setEffect(new WaveSurface());
      break;
    case 'none':
      bgSceneManager.setEffect(null);
      break;
  }
}

// ===== Render =====
function renderMonth() {
  updateMonthLabel();
  const data = getMonthData(currentYear, currentMonth);

  // Destroy existing charts before creating new ones
  destroyAll();

  // Render 2D charts
  renderSleepCharts(data);
  renderHeartCharts(data);
  renderWorkoutCharts(data);

  // Update 3D visualizations
  if (bgSceneManager) bgSceneManager.updateData(data);
  if (sleepSceneManager) sleepSceneManager.updateData(data);
  if (spheresSceneManager) spheresSceneManager.updateData(data);
}

// Boot
init();
