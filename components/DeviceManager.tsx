'use client';

import { useState, useEffect, useCallback } from 'react';

interface Device {
  id: string;
  label: string | null;
  type: string;
  hashPreview: string;
  createdAt: string;
}

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingStatus, setPairingStatus] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/device');
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRemove = async (deviceId: string) => {
    if (!confirm('Remove this device?')) return;

    const res = await fetch('/api/device', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (res.ok) {
      fetchDevices();
    }
  };

  const handleLinkDevice = async () => {
    if (!pairingCode.trim() || pairingCode.length !== 6) {
      setPairingStatus('Please enter a 6-character pairing code');
      return;
    }

    setPairingStatus('');

    const res = await fetch('/api/device/pair', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode: pairingCode.toUpperCase() }),
    });

    if (res.ok) {
      setPairingCode('');
      setPairingStatus('Device linked successfully!');
      fetchDevices();
    } else {
      const data = await res.json();
      setPairingStatus(data.error || 'Failed to link device');
    }
  };

  if (loading) return <p>Loading devices...</p>;

  return (
    <div className="device-manager">
      {/* Pairing section */}
      <div className="device-pairing">
        <label>Pairing Code</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="pairing-code-input"
            placeholder="ABC123"
            value={pairingCode}
            onChange={e => setPairingCode(e.target.value.toUpperCase().slice(0, 6))}
            maxLength={6}
            style={{ fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', width: 120 }}
          />
          <button className="btn btn-primary" onClick={handleLinkDevice}>
            Link Device
          </button>
        </div>
        {pairingStatus && (
          <div className={`status-msg ${pairingStatus.includes('success') ? 'success' : 'error'}`}>
            {pairingStatus}
          </div>
        )}
      </div>

      {/* Device list */}
      {devices.length > 0 ? (
        <div className="device-list">
          {devices.map(device => (
            <div key={device.id} className="device-card">
              <div className="device-card-info">
                <span className="device-name">{device.label || 'Unnamed'}</span>
                <span className="device-type-badge">{device.type.toUpperCase()}</span>
                <span className="device-hash">{device.hashPreview}</span>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleRemove(device.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="setting-hint">
          No devices linked. Use a pairing code from a kiosk or ask an artist to assign one.
        </p>
      )}
    </div>
  );
}
