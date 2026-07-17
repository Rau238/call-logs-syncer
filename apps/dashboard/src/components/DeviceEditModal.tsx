import { useEffect, useState } from 'react';
import type { DeviceRecord } from '../api';

interface Props {
  device: DeviceRecord;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: { deviceName?: string; isActive?: boolean }) => Promise<void>;
}

export function DeviceEditModal({ device, saving, onClose, onSave }: Props) {
  const [deviceName, setDeviceName] = useState(device.device_name);
  const [isActive, setIsActive] = useState(device.is_active);

  useEffect(() => {
    setDeviceName(device.device_name);
    setIsActive(device.is_active);
  }, [device]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ deviceName, isActive });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Edit device</h2>
        <p className="modal-sub mono">{device.device_id}</p>

        <label>
          Device name
          <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active device
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
