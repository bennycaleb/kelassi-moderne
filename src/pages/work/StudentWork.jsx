import React, { useEffect, useState } from 'react';
import { api, downloadAuthFile, readFile } from '../../services/api';

function StudentWork() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('cours');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState({});

  async function refresh() {
    setItems((await api('/api/work')).work || []);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const visible = items.filter((item) => item.type === tab);

  async function submitAnswer(item) {
    const file = files[item.id];
    if (!file) {
      setError('Choisissez d’abord votre fichier de réponse.');
      return;
    }
    setError('');
    try {
      const fileData = await readFile(file);
      await api(`/api/work/${item.id}/submit`, { method: 'POST', body: { fileName: file.name, fileData } });
      setMessage('Réponse déposée. Le professeur la corrige et met la note.');
      setFiles((current) => ({ ...current, [item.id]: null }));
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Cours & devoirs</h1>
        <p>Documents de votre classe uniquement. Vous déposez votre réponse ; seul le professeur note.</p>
      </div>
      {message && <div className="credentials-box">{message}</div>}
      {error && <p className="error">{error}</p>}

      <div className="tabs">
        <button type="button" className={tab === 'cours' ? 'active' : ''} onClick={() => setTab('cours')}>Cours PDF</button>
        <button type="button" className={tab === 'devoir' ? 'active' : ''} onClick={() => setTab('devoir')}>Devoirs & réponses</button>
      </div>

      <div className="panel">
        {!visible.length && <p className="empty-state">Rien n’a encore été publié pour votre classe.</p>}
        {visible.map((item) => {
          const mine = item.mySubmission;
          const graded = mine && mine.score !== null && mine.score !== undefined && mine.score !== '';
          return (
            <div className="work-card" key={item.id}>
              <div>
                <h3>{item.title}</h3>
                <p>{item.subjectName || 'Matière'} · {item.className} ({item.level}) · {item.teacherName}</p>
                {item.description && <p>{item.description}</p>}
                {item.dueDate && <p>À rendre avant le {item.dueDate}</p>}
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-secondary" onClick={() => downloadAuthFile(`/api/work/${item.id}/file`, item.originalName)}>📥 Télécharger le sujet</button>
                {item.type === 'devoir' && !graded && (
                  <>
                    <input type="file" accept=".pdf,.doc,.docx,application/pdf,image/*" onChange={(event) => setFiles((current) => ({ ...current, [item.id]: event.target.files?.[0] }))} />
                    <button type="button" className="btn" onClick={() => submitAnswer(item)}>{mine ? 'Remplacer ma réponse' : 'Déposer ma réponse'}</button>
                  </>
                )}
                {mine?.id && (
                  <button type="button" className="btn btn-secondary" onClick={() => downloadAuthFile(`/api/submissions/${mine.id}/file`, mine.fileName)}>Télécharger ma réponse</button>
                )}
              </div>
              {item.type === 'devoir' && (
                <p className="work-grade">
                  {graded
                    ? <>Note attribuée par le professeur : <b>{mine.score}/20</b>{mine.teacherComment ? ` — ${mine.teacherComment}` : ''}</>
                    : mine
                      ? 'Réponse déposée. En attente de correction du professeur.'
                      : 'Pas encore de réponse.'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StudentWork;
