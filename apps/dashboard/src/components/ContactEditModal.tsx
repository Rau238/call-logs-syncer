import { useEffect, useState } from 'react';
import type { ContactGroup } from '../api';
import { formatPhoneNumber } from '../utils/format';

interface Props {
  contact: ContactGroup;
  saving: boolean;
  onClose: () => void;
  onSave: (contactName: string) => Promise<void>;
}

export function ContactEditModal({ contact, saving, onClose, onSave }: Props) {
  const [contactName, setContactName] = useState(contact.contactName);

  useEffect(() => {
    setContactName(contact.contactName);
  }, [contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(contactName);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Edit contact</h2>
        <p className="modal-sub mono">{formatPhoneNumber(contact.phoneNumber)}</p>
        <p className="modal-hint">Updates the contact name on all {contact.callCount} call log(s) for this number.</p>

        <label>
          Contact name
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
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
