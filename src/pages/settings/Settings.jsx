import React, { useEffect, useState } from 'react';
import { api, readPhoto } from '../../services/api';
import { refreshSchoolMeta, useSchool } from '../../context/SchoolContext';

function SettingsPage() {
  const { meta, setYear } = useSchool();
  const [form, setForm] = useState({
    schoolName: '', address: '', phone: '', email: '', currency: 'FC', currentYear: '2026-2027', tuitionAmount: '', directorName: '', signature: ''
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (meta?.settings) setForm((current) => ({ ...current, ...meta.settings }));
  }, [meta]);

  async function submit(event) {
    event.preventDefault();
    await api('/api/settings', { method: 'PUT', body: { ...form, tuitionAmount: Number(form.tuitionAmount) || 0 } });
    setYear(form.currentYear);
    refreshSchoolMeta();
    setSaved(true);
  }

  return (
    <div>
      <div className="page-header"><h1>Paramètres de l’établissement</h1><p>Identité, année scolaire, devise, scolarité, signature et coordonnées.</p></div>
      <form className="panel form-grid" onSubmit={submit}>
        <div className="form-field"><label>Nom</label><input value={form.schoolName} onChange={(event) => setForm({ ...form, schoolName: event.target.value })} /></div>
        <div className="form-field"><label>Devise</label><input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></div>
        <div className="form-field"><label>Année scolaire active</label><input value={form.currentYear} onChange={(event) => setForm({ ...form, currentYear: event.target.value })} /></div>
        <div className="form-field"><label>Scolarité attendue / élève</label><input type="number" min="0" value={form.tuitionAmount ?? ''} onChange={(event) => setForm({ ...form, tuitionAmount: event.target.value })} placeholder="Ex. 150000" /></div>
        <div className="form-field"><label>Téléphone</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
        <div className="form-field"><label>Premier responsable</label><input value={form.directorName || ''} onChange={(event) => setForm({ ...form, directorName: event.target.value })} placeholder="Nom du chef d’établissement" /></div>
        <div className="form-field full"><label>Adresse</label><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
        <div className="form-field full"><label>Email</label><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
        <div className="form-field full">
          <label>Signature du premier responsable</label>
          <input type="file" accept="image/*" onChange={(event) => event.target.files[0] && readPhoto(event.target.files[0], (signature) => setForm((current) => ({ ...current, signature })))} />
          {form.signature ? (
            <div style={{ marginTop: 10 }}>
              <img src={form.signature} alt="Signature" className="card-signature" />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm((current) => ({ ...current, signature: '' }))}>Retirer</button>
            </div>
          ) : <p className="muted-line">Image affichée sur la carte d’étudiant. Sinon, un espace est laissé pour signer à la main.</p>}
        </div>
        <div className="form-field"><button className="btn" type="submit">Enregistrer</button></div>
        {saved && <p>Paramètres mis à jour.</p>}
      </form>
      <p className="muted-line" style={{ marginTop: 16 }}>Kelassi IA fonctionne avec les données de l’école. Pour des réponses plus riches, ajoutez une clé <code>OPENAI_API_KEY</code>, <code>GROQ_API_KEY</code>, <code>ANTHROPIC_API_KEY</code> ou <code>GEMINI_API_KEY</code> dans le fichier <code>.env</code>.</p>
    </div>
  );
}

export default SettingsPage;
