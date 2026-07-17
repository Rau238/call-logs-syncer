import { useEffect, useState } from 'react';
import type { CallLogRecord, CallLogUpdate } from '../api';
import { callTypeLabel } from '../utils/format';

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
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Edit call log</h2>
        <p className="modal-sub mono">{call.serverId}</p>

        <label>
          Contact name
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label>
          Phone number
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </label>
        <label>
          Call type
          <select value={callType} onChange={(e) => setCallType(e.target.value)}>
            {CALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {callTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-row">
          <label>
            Duration (sec)
            <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label>
            SIM slot
            <input type="number" min={0} value={simSlot} onChange={(e) => setSimSlot(e.target.value)} />
          </label>
        </div>
        <label>
          Call time
          <input type="datetime-local" value={callTimeLocal} onChange={(e) => setCallTimeLocal(e.target.value)} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={isDeleted} onChange={(e) => setIsDeleted(e.target.checked)} />
          Mark as deleted from phone
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
