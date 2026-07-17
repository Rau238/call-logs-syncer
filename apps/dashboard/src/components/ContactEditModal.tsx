import { useEffect, useState } from 'react';
import type { ContactGroup } from '../api';
import { formatPhoneNumber } from '../utils/format';
import { Button, inputClassName, labelClassName } from './ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';

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
    <Modal onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalHeader
          title="Edit contact"
          subtitle={
            <>
              <span className="font-mono">{formatPhoneNumber(contact.phoneNumber)}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500 sm:text-xs">
                Updates the name on all {contact.callCount} call log(s) for this number.
              </span>
            </>
          }
        />
        <ModalBody>
          <label className={labelClassName}>
            Contact name
            <input
              className={inputClassName}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
              autoFocus
            />
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
