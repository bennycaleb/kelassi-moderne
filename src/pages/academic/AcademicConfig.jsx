import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';
import { getCourses } from '../../services/course';

const EMPTY_TYPE = { name: '', coefficient: '1', weightPercent: '0', maxScore: '20' };

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

function AcademicConfig() {
  const { year, classes } = useSchool();
  const isTeacher = currentRole() === 'teacher';
  const [cycles, setCycles] = useState([]);
  const [types, setTypes] = useState([]);
  const [allowedCycleIds, setAllowedCycleIds] = useState(null);
  const [cycleId, setCycleId] = useState('');
  const [form, setForm] = useState(EMPTY_TYPE);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');

  const visibleCycles = useMemo(() => {
    if (!isTeacher || !allowedCycleIds) return cycles;
    return cycles.filter((cycle) => allowedCycleIds.includes(cycle.id));
  }, [cycles, isTeacher, allowedCycleIds]);

  const selected = visibleCycles.find((item) => item.id === cycleId) || visibleCycles[0];
  const cycleTypes = useMemo(
    () => types.filter((item) => item.cycleId === (selected?.id || cycleId)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [types, selected, cycleId]
  );

  async function refresh() {
    const data = await api('/api/academic');
    const nextCycles = data.cycles || [];
    setCycles(nextCycles);
    setTypes(data.evaluationTypes || []);
    if (isTeacher) {
      const courseData = await getCourses();
      const ids = [...new Set((courseData.courses || []).map((course) => {
        const classroom = classes.find((item) => item.id === course.classId);
        return classroom?.cycleId;
      }).filter(Boolean))];
      setAllowedCycleIds(ids);
      setCycleId((current) => ids.includes(current) ? current : (ids[0] || ''));
    } else {
      setAllowedCycleIds(null);
      setCycleId((current) => nextCycles.some((item) => item.id === current) ? current : (nextCycles[0]?.id || ''));
    }
  }

  useEffect(() => { refresh().catch(() => {}); }, [year, classes.length]);

  function notifyMeta() {
    window.dispatchEvent(new Event('kelassi-auth'));
  }

  async function saveCycle(payload) {
    await api(`/api/academic/cycles/${payload.id}`, { method: 'PUT', body: payload });
    setMessage(`Règle du ${payload.name || 'cycle'} enregistrée. Les autres cycles ne changent pas.`);
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
          Primaire, collège, lycée et université ont chacun leur propre politique. Changer l’un ne change jamais les autres.
          {isTeacher
            ? ' Vous voyez uniquement le cycle de vos classes.'
            : ' Un Devoir peut valoir 2 au collège, et 40 % au lycée.'}
        </p>
      </div>
      {message && <div className="credentials-box">{message}</div>}

      {!visibleCycles.length && isTeacher && (
        <div className="panel">
          <p>Aucun cycle à régler pour l’instant. L’administration doit vous affecter une classe.</p>
        </div>
      )}

      <div className="cycle-grid">
        {visibleCycles.map((cycle) => (
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
          <p>Cette règle s’applique seulement au cycle {selected.name}, pas aux autres.</p>
          <div className="form-grid">
            {!isTeacher && (
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
            )}
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
            {!isTeacher && (
              <div className="form-field">
                <label>Les enseignants peuvent modifier le poids à la saisie</label>
                <select
                  value={selected.teacherCanEditCoefficient ? '1' : '0'}
                  onChange={(event) => saveCycle({ ...selected, teacherCanEditCoefficient: event.target.value === '1' })}
                >
                  <option value="1">Oui — le professeur peut changer le coef / %</option>
                  <option value="0">Non — la règle de l’école s’applique</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="panel">
          <h2>Types d’évaluation — {selected.name}</h2>
          <p>Ces types servent seulement au cycle {selected.name}. Un professeur de lycée ne verra pas les compositions du primaire.</p>
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
