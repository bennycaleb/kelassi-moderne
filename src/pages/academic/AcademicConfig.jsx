import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

const EMPTY_TYPE = { name: '', coefficient: '1', weightPercent: '0', maxScore: '20' };

function AcademicConfig() {
  const { year } = useSchool();
  const [cycles, setCycles] = useState([]);
  const [types, setTypes] = useState([]);
  const [cycleId, setCycleId] = useState('cycle_college');
  const [form, setForm] = useState(EMPTY_TYPE);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');

  const selected = cycles.find((item) => item.id === cycleId) || cycles[0];
  const cycleTypes = useMemo(
    () => types.filter((item) => item.cycleId === (selected?.id || cycleId)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [types, selected, cycleId]
  );

  async function refresh() {
    const data = await api('/api/academic');
    setCycles(data.cycles || []);
    setTypes(data.evaluationTypes || []);
    if (!cycleId && data.cycles?.[0]) setCycleId(data.cycles[0].id);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  function notifyMeta() {
    window.dispatchEvent(new Event('kelassi-auth'));
  }

  async function saveCycle(payload) {
    await api(`/api/academic/cycles/${payload.id}`, { method: 'PUT', body: payload });
    setMessage('Règle du cycle enregistrée. Elle s’applique à toutes les classes de ce cycle.');
    await refresh();
    notifyMeta();
  }

  async function submitType(event) {
    event.preventDefault();
    const body = {
      cycleId: selected.id,
      name: form.name,
      coefficient: Number(form.coefficient || 1),
      weightPercent: Number(form.weightPercent || 0),
      maxScore: Number(form.maxScore || 20)
    };
    if (editingId) {
      await api(`/api/academic/types/${editingId}`, { method: 'PUT', body });
    } else {
      await api('/api/academic/types', { method: 'POST', body });
    }
    setForm(EMPTY_TYPE);
    setEditingId('');
    setMessage('Type d’évaluation enregistré. Les enseignants peuvent l’utiliser pour noter.');
    await refresh();
    notifyMeta();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Règles de notation</h1>
        <p>
          Chaque établissement crée ses propres règles. L’école les définit ici, y compris via les enseignants :
          un Devoir peut valoir 2 au collège, et 40 % au lycée.
        </p>
      </div>
      {message && <div className="credentials-box">{message}</div>}

      <div className="cycle-grid">
        {cycles.map((cycle) => (
          <button
            type="button"
            key={cycle.id}
            className={`cycle-card ${cycle.id === selected?.id ? 'active' : ''}`}
            style={{ borderColor: cycle.color }}
            onClick={() => { setCycleId(cycle.id); setForm(EMPTY_TYPE); setEditingId(''); }}
          >
            <span className="badge" style={{ background: cycle.color, color: '#fff' }}>{cycle.active ? 'Actif' : 'Inactif'}</span>
            <h3>{cycle.name}</h3>
            <p>{cycle.gradingMode === 'percent' ? 'Notation en %' : 'Notation par coefficients'}</p>
            <p>{types.filter((item) => item.cycleId === cycle.id).length} type(s) d’évaluation</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="panel">
          <h2>{selected.name} — mode de calcul</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>Cycle actif pour l’établissement</label>
              <select
                value={selected.active ? '1' : '0'}
                onChange={(event) => saveCycle({ ...selected, active: event.target.value === '1' })}
              >
                <option value="1">Oui, les classes peuvent l’utiliser</option>
                <option value="0">Non, masqué pour les nouvelles classes</option>
              </select>
            </div>
            <div className="form-field">
              <label>Mode de notation</label>
              <select
                value={selected.gradingMode}
                onChange={(event) => saveCycle({ ...selected, gradingMode: event.target.value })}
              >
                <option value="coefficient">Coefficients (Devoir = 2)</option>
                <option value="percent">Pourcentages (Examen = 40 %)</option>
              </select>
            </div>
            <div className="form-field">
              <label>Les enseignants peuvent modifier le poids à la saisie</label>
              <select
                value={selected.teacherCanEditCoefficient ? '1' : '0'}
                onChange={(event) => saveCycle({ ...selected, teacherCanEditCoefficient: event.target.value === '1' })}
              >
                <option value="0">Non — la règle de l’école s’applique</option>
                <option value="1">Oui — le professeur peut changer le coef / %</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="panel">
          <h2>Types d’évaluation — {selected.name}</h2>
          <p>Exemples : Interrogation, Devoir, EPR, Examen. Le coefficient ou le pourcentage appartient à l’évaluation, pas à l’élève.</p>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>{selected.gradingMode === 'percent' ? 'Poids %' : 'Coefficient'}</th>
                <th>Note max</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cycleTypes.map((type) => (
                <tr key={type.id}>
                  <td>{type.name}</td>
                  <td>
                    {selected.gradingMode === 'percent'
                      ? `${type.weightPercent || 0} %`
                      : type.coefficient}
                  </td>
                  <td>{type.maxScore || 20}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingId(type.id);
                        setForm({
                          name: type.name,
                          coefficient: String(type.coefficient ?? 1),
                          weightPercent: String(type.weightPercent ?? 0),
                          maxScore: String(type.maxScore ?? 20)
                        });
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!window.confirm(`Supprimer « ${type.name} » ?`)) return;
                        await api(`/api/academic/types/${type.id}`, { method: 'DELETE' });
                        await refresh();
                        notifyMeta();
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {!cycleTypes.length && (
                <tr><td colSpan="4">Aucun type pour ce cycle. Ajoutez-en ci-dessous.</td></tr>
              )}
            </tbody>
          </table>

          <form className="form-grid" onSubmit={submitType} style={{ marginTop: 16 }}>
            <div className="form-field">
              <label>{editingId ? 'Modifier le type' : 'Nouveau type'}</label>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Devoir, EPR, Composition…" required />
            </div>
            <div className="form-field">
              <label>Coefficient</label>
              <input type="number" min="0" step="0.5" value={form.coefficient} onChange={(event) => setForm({ ...form, coefficient: event.target.value })} />
            </div>
            <div className="form-field">
              <label>Poids %</label>
              <input type="number" min="0" max="100" value={form.weightPercent} onChange={(event) => setForm({ ...form, weightPercent: event.target.value })} />
            </div>
            <div className="form-field">
              <label>Note maximale</label>
              <input type="number" min="1" value={form.maxScore} onChange={(event) => setForm({ ...form, maxScore: event.target.value })} />
            </div>
            <div className="form-field">
              <label>&nbsp;</label>
              <div className="row-actions">
                <button className="btn" type="submit">{editingId ? 'Mettre à jour' : 'Ajouter ce type'}</button>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(''); setForm(EMPTY_TYPE); }}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AcademicConfig;
