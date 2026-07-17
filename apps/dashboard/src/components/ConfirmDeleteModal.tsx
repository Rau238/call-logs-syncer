import type { ConfirmDeletePayload } from '../utils/deleteConfirm';

interface Props {
  payload: ConfirmDeletePayload;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ payload, deleting, onClose, onConfirm }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-delete-header">
          <span className="confirm-delete-icon" aria-hidden>
            ⚠
          </span>
          <div>
            <h2>{payload.title}</h2>
            <p className="confirm-delete-question">{payload.question}</p>
          </div>
        </div>

        <p className="confirm-delete-summary">{payload.summary}</p>

        <div className="confirm-delete-section">
          <h3>Details</h3>
          <dl className="confirm-delete-dl">
            {payload.details.map((row) => (
              <div key={row.label} className="confirm-delete-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="confirm-delete-section confirm-delete-warn">
          <h3>The following will be permanently removed</h3>
          <ul className="confirm-delete-list">
            {payload.willRemove.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {payload.preview && payload.preview.length > 0 && (
          <div className="confirm-delete-section">
            <h3>Preview</h3>
            <ul className="confirm-delete-preview">
              {payload.preview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="confirm-delete-footnote">This action cannot be undone.</p>

        <div className="modal-actions">
          <button type="button" className="btn-outline" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Yes, delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
