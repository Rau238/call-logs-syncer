import type { ConfirmDeletePayload } from '../utils/deleteConfirm';
import { Button } from './ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalSection } from './ui/Modal';

interface Props {
  payload: ConfirmDeletePayload;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ payload, deleting, onClose, onConfirm }: Props) {
  return (
    <Modal onClose={onClose} size="sm" className="sm:max-w-lg">
      <div className="flex min-h-0 flex-1 flex-col">
        <ModalHeader title={payload.title} subtitle={payload.question} />

        <ModalBody>
          {/* Mobile: question only — details hidden */}
          <p className="text-sm text-slate-400 sm:hidden">This action cannot be undone.</p>

          {/* Desktop: full confirmation details */}
          <div className="hidden flex-col gap-3 sm:flex">
            <p className="text-sm leading-relaxed text-slate-300">{payload.summary}</p>

            <ModalSection title="Details">
              <dl className="space-y-1.5">
                {payload.details.map((row) => (
                  <div key={row.label} className="grid gap-0.5 text-sm sm:grid-cols-[7rem_1fr] sm:gap-2">
                    <dt className="font-medium text-slate-500">{row.label}</dt>
                    <dd className="break-words text-slate-200">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </ModalSection>

            <ModalSection title="Permanently removed" variant="danger">
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-red-200/90">
                {payload.willRemove.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </ModalSection>

            {payload.preview && payload.preview.length > 0 && (
              <ModalSection title="Preview">
                <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono text-xs text-slate-400">
                  {payload.preview.map((line) => (
                    <li key={line} className="truncate">
                      {line}
                    </li>
                  ))}
                </ul>
              </ModalSection>
            )}

            <p className="text-xs italic text-slate-500">This action cannot be undone.</p>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={deleting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={deleting} className="w-full sm:w-auto">
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
