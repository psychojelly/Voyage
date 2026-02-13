import { normalizeOuraSleep, normalizeOuraHeartRate, normalizeOuraActivity } from './data-adapter.js';
import { saveDays, saveSettings, loadSettings } from './store.js';

const BASE_URL = 'https://api.ouraring.com';
const OAUTH_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const SCOPES = 'daily heartrate workout session personal';

// ===== OAuth2 Client-Side Flow =====

export function startOuraOAuth(clientId, redirectUri) {
  const state = crypto.randomUUID();
  saveSettings({ oauthState: state });

  const params = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: state,
  });

  window.location.href = `${OAUTH_AUTHORIZE_URL}?${params}`;
}

export function handleOAuthCallback() {
  // Check for access_token in URL hash (client-side OAuth2 flow)
  const hash = window.location.hash.substring(1);
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const state = params.get('state');

  if (!accessToken) return false;

  // Verify state parameter
  const settings = loadSettings();
  if (settings.oauthState && state !== settings.oauthState) {
    console.error('OAuth state mismatch');
    return false;
  }

  // Save the token and clean up URL
  saveSettings({
    ouraToken: accessToken,
    oauthState: null,
  });

  // Remove hash from URL
  history.replaceState(null, '', window.location.pathname + window.location.search);

  return true;
}

// ===== API Fetching =====

export async function fetchOuraData(token, startDate, endDate, proxyUrl = '') {
  if (!token) throw new Error('Not connected to Oura. Click "Connect Oura Ring" first.');
  if (!startDate || !endDate) throw new Error('Start and end dates are required');

  const results = { sleep: [], heart: [], workout: [], errors: [] };

  const endpoints = [
    { path: '/v2/usercollection/daily_sleep', key: 'sleep', normalize: normalizeOuraSleep },
    { path: '/v2/usercollection/heartrate', key: 'heart', normalize: normalizeOuraHeartRate },
    { path: '/v2/usercollection/daily_activity', key: 'workout', normalize: normalizeOuraActivity },
  ];

  for (const ep of endpoints) {
    try {
      const data = await fetchEndpoint(token, ep.path, startDate, endDate, proxyUrl);
      const normalized = ep.normalize(data);
      results[ep.key] = normalized;
      saveDays(normalized);
    } catch (err) {
      results.errors.push({ endpoint: ep.key, error: err.message });
    }
  }

  return results;
}

async function fetchEndpoint(token, path, startDate, endDate, proxyUrl) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const apiUrl = `${BASE_URL}${path}?${params}`;
  const fetchUrl = proxyUrl
    ? `${proxyUrl.replace(/\/+$/, '')}/${apiUrl}`
    : apiUrl;

  const response = await fetch(fetchUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Token expired or invalid — clear it
    saveSettings({ ouraToken: null });
    throw new Error('Token expired. Please reconnect your Oura Ring.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Oura API error ${response.status}: ${text || response.statusText}`);
  }

  return response.json();
}

// ===== UI Init =====

export function initOuraSettings() {
  const settings = loadSettings();
  const clientIdInput = document.getElementById('oura-client-id');
  const proxyInput = document.getElementById('cors-proxy');
  const startInput = document.getElementById('fetch-start');
  const endInput = document.getElementById('fetch-end');
  const connectBtn = document.getElementById('connect-oura');
  const fetchBtn = document.getElementById('fetch-oura');
  const disconnectBtn = document.getElementById('disconnect-oura');
  const statusEl = document.getElementById('fetch-status');
  const connectedInfo = document.getElementById('oura-connected');

  // Check for OAuth callback on page load
  const justConnected = handleOAuthCallback();
  const reloadedSettings = loadSettings();

  // Restore client ID and proxy
  if (reloadedSettings.ouraClientId) clientIdInput.value = reloadedSettings.ouraClientId;
  if (reloadedSettings.corsProxy) proxyInput.value = reloadedSettings.corsProxy;

  // Default date range: last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  startInput.value = startInput.value || formatDate(start);
  endInput.value = endInput.value || formatDate(end);

  // Show connected/disconnected state
  updateConnectionUI(reloadedSettings);

  if (justConnected) {
    statusEl.textContent = 'Connected to Oura! Click "Fetch Data" to import.';
    statusEl.className = 'status-msg success';
  }

  // Connect button — starts OAuth flow
  connectBtn.addEventListener('click', () => {
    const clientId = clientIdInput.value.trim();
    if (!clientId) {
      statusEl.textContent = 'Enter your Client ID first (from Oura developer portal)';
      statusEl.className = 'status-msg error';
      return;
    }
    saveSettings({ ouraClientId: clientId });

    // Redirect URI = current page
    const redirectUri = window.location.origin + window.location.pathname;
    startOuraOAuth(clientId, redirectUri);
  });

  // Fetch button — uses stored access token
  fetchBtn.addEventListener('click', async () => {
    const currentSettings = loadSettings();
    const token = currentSettings.ouraToken;
    const proxy = proxyInput.value.trim();

    saveSettings({ corsProxy: proxy });

    if (!token) {
      statusEl.textContent = 'Not connected. Click "Connect Oura Ring" first.';
      statusEl.className = 'status-msg error';
      return;
    }

    if (!proxy) {
      statusEl.textContent = 'A CORS proxy is required for browser-based API calls. See instructions below the field.';
      statusEl.className = 'status-msg error';
      return;
    }

    statusEl.textContent = 'Fetching data from Oura...';
    statusEl.className = 'status-msg loading';

    try {
      const results = await fetchOuraData(token, startInput.value, endInput.value, proxy);
      const total = results.sleep.length + results.heart.length + results.workout.length;
      let msg = `Imported ${total} records`;
      if (results.errors.length > 0) {
        msg += ` (${results.errors.length} endpoint(s) failed: ${results.errors.map(e => e.error).join('; ')})`;
      }
      statusEl.textContent = msg;
      statusEl.className = total > 0 ? 'status-msg success' : 'status-msg error';

      window.dispatchEvent(new CustomEvent('data-updated'));
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = 'status-msg error';
      updateConnectionUI(loadSettings());
    }
  });

  // Disconnect button
  disconnectBtn.addEventListener('click', () => {
    saveSettings({ ouraToken: null });
    statusEl.textContent = 'Disconnected from Oura.';
    statusEl.className = 'status-msg';
    updateConnectionUI(loadSettings());
  });

  function updateConnectionUI(s) {
    const isConnected = !!s.ouraToken;
    connectedInfo.style.display = isConnected ? 'flex' : 'none';
    connectBtn.style.display = isConnected ? 'none' : '';
    clientIdInput.style.display = isConnected ? 'none' : '';
    document.querySelector('label[for="oura-client-id"]').style.display = isConnected ? 'none' : '';
    fetchBtn.style.display = isConnected ? '' : 'none';
    disconnectBtn.style.display = isConnected ? '' : 'none';
  }
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
