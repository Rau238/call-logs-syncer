import { useEffect, useState } from 'react';
import type { DeviceRecord } from '../api';
import { Button, inputClassName, labelClassName } from './ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';

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
    <Modal onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader
          title="Edit device"
          subtitle={<span className="font-mono text-[11px] sm:text-xs">{device.device_id}</span>}
        />
        <ModalBody>
          <label className={labelClassName}>
            Device name
            <input
              className={inputClassName}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300 sm:text-sm">
            <input
              type="checkbox"
              className="rounded border-slate-600"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active device
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
