import { useEffect, useState } from 'react';
import type { CallLogRecord, CallLogUpdate } from '../api';
import { callTypeLabel } from '../utils/format';
import { Button, inputClassName, labelClassName, selectClassName } from './ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';

const CALL_TYPES = [
  'INCOMING',
  'OUTGOING',
  'MISSED',
  'REJECTED',
  'BLOCKED',
  'VOICEMAIL',
  'UNKNOWN',
] as const;

interface Props {
  call: CallLogRecord;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: CallLogUpdate) => Promise<void>;
}

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CallEditModal({ call, saving, onClose, onSave }: Props) {
  const [contactName, setContactName] = useState(call.contactName);
  const [phoneNumber, setPhoneNumber] = useState(call.phoneNumber);
  const [callType, setCallType] = useState(call.callType);
  const [duration, setDuration] = useState(String(call.duration));
  const [callTimeLocal, setCallTimeLocal] = useState(toLocalInput(call.callTime));
  const [simSlot, setSimSlot] = useState(String(call.simSlot));
  const [isDeleted, setIsDeleted] = useState(call.isDeleted);

  useEffect(() => {
    setContactName(call.contactName);
    setPhoneNumber(call.phoneNumber);
    setCallType(call.callType);
    setDuration(String(call.duration));
    setCallTimeLocal(toLocalInput(call.callTime));
    setSimSlot(String(call.simSlot));
    setIsDeleted(call.isDeleted);
  }, [call]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const callTime = new Date(callTimeLocal).getTime();
    if (Number.isNaN(callTime)) return;

    await onSave({
      contactName,
      phoneNumber,
      callType,
      duration: parseInt(duration, 10) || 0,
      callTime,
      simSlot: parseInt(simSlot, 10) || 0,
      isDeleted,
    });
  };

  return (
    <Modal onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader
          title="Edit call log"
          subtitle={<span className="font-mono text-[11px] sm:text-xs">{call.serverId}</span>}
        />
        <ModalBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Contact name
              <input className={inputClassName} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className={labelClassName}>
              Phone number
              <input className={inputClassName} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Call type
              <select className={selectClassName} value={callType} onChange={(e) => setCallType(e.target.value)}>
                {CALL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {callTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Call time
              <input
                type="datetime-local"
                className={inputClassName}
                value={callTimeLocal}
                onChange={(e) => setCallTimeLocal(e.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Duration (sec)
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              SIM slot
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={simSlot}
                onChange={(e) => setSimSlot(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300 sm:text-sm">
            <input
              type="checkbox"
              className="rounded border-slate-600"
              checked={isDeleted}
              onChange={(e) => setIsDeleted(e.target.checked)}
            />
            Mark as deleted from phone
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
