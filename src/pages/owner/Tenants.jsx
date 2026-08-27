import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { api } from '../../services/api';

const EMPTY = {
  name: '',
  city: '',
  address: '',
  phone: '',
  adminName: '',
  adminEmail: '',
  adminPassword: ''
};

function Tenants() {
  const [schools, setSchools] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState(null);
  const [message, setMessage] = useState('');

  async function refresh() {
    setSchools((await api('/api/tenants')).schools || []);
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

  async function submit(event) {
    event.preventDefault();
    const data = await api('/api/tenants', { method: 'POST', body: form });
    setCreated(data.credentials);
    setForm(EMPTY);
    setOpen(false);
    setMessage(`École créée. Remettez ces identifiants à l’administrateur de ${data.school?.name || 'l’école'}.`);
    refresh();
  }

  async function toggleStatus(school) {
    const status = school.status === 'active' ? 'suspended' : 'active';
    await api(`/api/tenants/${school.id}`, { method: 'PUT', body: { status } });
    refresh();
  }

  async function resetPassword(school) {
    const password = window.prompt(`Nouveau mot de passe admin pour « ${school.name} » :`);
    if (!password) return;
    const data = await api(`/api/tenants/${school.id}/password`, { method: 'PUT', body: { password } });
    setCreated(data.credentials);
    setMessage(`Mot de passe admin réinitialisé pour ${school.name}.`);
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Écoles locataires</h1>
          <p>Vous créez l’école et le compte admin. Ensuite, l’école crée elle-même les profs, élèves et parents.</p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>Nouvelle école</button>
      </div>
      {message && <div className="credentials-box">{message}</div>}
      {created && (
        <div className="credentials-box">
          <b>Identifiants à transmettre à l’école</b>
          <p>Email : {created.email}</p>
          <p>Mot de passe : {created.password}</p>
        </div>
      )}
      <div className="cycle-grid">
        {schools.map((item) => (
          <div className="cycle-card" key={item.id}>
            <span className={`badge ${item.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
              {item.status === 'active' ? 'Active' : 'Suspendue'}
            </span>
            <h3>{item.name}</h3>
            <p>{item.city || item.address || '—'}</p>
            <p>Admin : {item.adminName} — {item.adminEmail}</p>
            <p>{item.students} élèves · {item.teachers} enseignants · {item.classes} classes</p>
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => resetPassword(item)}>
                Nouveau mot de passe
              </button>
              <button type="button" className="btn btn-sm" onClick={() => toggleStatus(item)}>
                {item.status === 'active' ? 'Suspendre' : 'Réactiver'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!schools.length && <p className="empty-state">Aucune école pour le moment.</p>}

      {open && (
        <Modal title="Créer une école" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Nom de l’école</label><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Lycée Saint-Joseph" /></div>
              <div className="form-field"><label>Ville</label><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></div>
              <div className="form-field full"><label>Adresse</label><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
              <div className="form-field"><label>Téléphone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="form-field"><label>Nom de l’admin</label><input value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} required placeholder="Directeur" /></div>
              <div className="form-field"><label>Email admin (login)</label><input type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} required placeholder="direction@ecole.com" /></div>
              <div className="form-field"><label>Mot de passe admin</label><input value={form.adminPassword} onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} required minLength={6} /></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Créer l’école</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Tenants;
