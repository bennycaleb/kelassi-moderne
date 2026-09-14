import React, { useState } from 'react';
import { ENROLLMENT_DOC_TYPES } from '../constants';
import { downloadAuthFile, readFile } from '../services/api';

function EnrollmentDocsField({
  studentId,
  existing = [],
  pending = [],
  onPendingChange,
  onDeleteExisting
}) {
  const [type, setType] = useState(ENROLLMENT_DOC_TYPES[0]);
  const [busy, setBusy] = useState(false);

  async function addFiles(event) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of files) {
        added.push({
          tempId: `${Date.now()}-${file.name}-${Math.random()}`,
          type,
          fileName: file.name,
          fileData: await readFile(file)
        });
      }
      onPendingChange([...(pending || []), ...added]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="enrollment-docs">
      <p className="muted-line">
        Scannez ou importez les pièces demandées à l’inscription (PDF, photo, Word).
        Elles restent dans la fiche de l’élève, même si le dossier papier est perdu.
      </p>
      {(existing || []).map((doc) => (
        <div key={doc.id} className="enrollment-doc-row">
          <div>
            <strong>{doc.type}</strong>
            <small className="muted-line">{doc.originalName}{doc.uploadedAt ? ` · ${String(doc.uploadedAt).slice(0, 10)}` : ''}</small>
          </div>
          <div className="row-actions">
            {studentId ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadAuthFile(`/api/students/${studentId}/enrollment-docs/${doc.id}/file`, doc.originalName)}
              >
                Télécharger
              </button>
            ) : null}
            {onDeleteExisting ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => onDeleteExisting(doc)}>Retirer</button>
            ) : null}
          </div>
        </div>
      ))}
      {(pending || []).map((doc) => (
        <div key={doc.tempId} className="enrollment-doc-row pending">
          <div>
            <strong>{doc.type}</strong>
            <small className="muted-line">{doc.fileName} — à enregistrer</small>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => onPendingChange(pending.filter((item) => item.tempId !== doc.tempId))}
          >
            Retirer
          </button>
        </div>
      ))}
      <div className="enrollment-add">
        <div className="form-field">
          <label>Type de pièce</label>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {ENROLLMENT_DOC_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>{busy ? 'Lecture du fichier…' : 'Ajouter un ou plusieurs fichiers'}</label>
          <input type="file" accept=".pdf,.doc,.docx,application/pdf,image/*" multiple disabled={busy} onChange={addFiles} />
        </div>
      </div>
    </div>
  );
}

export default EnrollmentDocsField;
