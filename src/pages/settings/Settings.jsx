import React, { useEffect, useState } from 'react';
import { api, readPhoto } from '../../services/api';
import { refreshSchoolMeta, useSchool } from '../../context/SchoolContext';
import MobileMoneyPay from '../../components/MobileMoneyPay';

function SettingsPage() {
  const { meta, setYear } = useSchool();
  const [form, setForm] = useState({
    schoolName: '', address: '', phone: '', email: '', currency: 'FC', currentYear: '2026-2027', tuitionAmount: '', directorName: '', signature: '',
    momoName: '', momoNumber: '', airtelMoneyName: '', airtelMoneyNumber: '', paymentInstructions: ''
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

  const preview = {
    momoName: form.momoName,
    momoNumber: form.momoNumber,
    airtelMoneyName: form.airtelMoneyName,
    airtelMoneyNumber: form.airtelMoneyNumber,
    paymentInstructions: form.paymentInstructions,
    hasAny: Boolean(String(form.momoNumber || '').trim() || String(form.airtelMoneyNumber || '').trim())
  };

  return (
    <div>
      <div className="page-header"><h1>Paramètres de l’établissement</h1><p>Identité, année scolaire, devise, scolarité, Mobile Money, signature et coordonnées.</p></div>
      <form className="panel form-grid" onSubmit={submit}>
        <div className="form-field"><label>Nom</label><input value={form.schoolName} onChange={(event) => setForm({ ...form, schoolName: event.target.value })} /></div>
        <div className="form-field"><label>Devise</label><input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></div>
        <div className="form-field"><label>Année scolaire active</label><input value={form.currentYear} onChange={(event) => setForm({ ...form, currentYear: event.target.value })} /></div>
        <div className="form-field"><label>Scolarité attendue / élève</label><input type="number" min="0" value={form.tuitionAmount ?? ''} onChange={(event) => setForm({ ...form, tuitionAmount: event.target.value })} placeholder="Ex. 150000" /></div>
        <div className="form-field"><label>Téléphone de l’école</label><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
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

      <form className="panel form-grid" onSubmit={submit} style={{ marginTop: 18 }}>
        <div className="form-field full">
          <h2 style={{ margin: 0 }}>Paiement Mobile Money (visible aux parents)</h2>
          <p className="muted-line">Ces numéros s’affichent dans l’espace parent (et élève) pour payer la scolarité en ligne.</p>
        </div>
        <div className="form-field"><label>Nom du compte MTN MoMo</label><input value={form.momoName || ''} onChange={(event) => setForm({ ...form, momoName: event.target.value })} placeholder="Ex. École Saint-Joseph" /></div>
        <div className="form-field"><label>Numéro MTN MoMo</label><input value={form.momoNumber || ''} onChange={(event) => setForm({ ...form, momoNumber: event.target.value })} placeholder="Ex. 06 000 00 00" /></div>
        <div className="form-field"><label>Nom du compte Airtel Money</label><input value={form.airtelMoneyName || ''} onChange={(event) => setForm({ ...form, airtelMoneyName: event.target.value })} placeholder="Ex. École Saint-Joseph" /></div>
        <div className="form-field"><label>Numéro Airtel Money</label><input value={form.airtelMoneyNumber || ''} onChange={(event) => setForm({ ...form, airtelMoneyNumber: event.target.value })} placeholder="Ex. 05 000 00 00" /></div>
        <div className="form-field full">
          <label>Consignes aux parents (optionnel)</label>
          <textarea rows="3" value={form.paymentInstructions || ''} onChange={(event) => setForm({ ...form, paymentInstructions: event.target.value })} placeholder="Ex. Mettez le nom de l’élève et la classe en référence, puis envoyez la capture à la comptabilité." />
        </div>
        <div className="form-field"><button className="btn" type="submit">Enregistrer les numéros</button></div>
        {saved && <p>Paramètres mis à jour.</p>}
      </form>
      {preview.hasAny ? <MobileMoneyPay channels={preview} title="Aperçu côté parent" /> : null}

      <p className="muted-line" style={{ marginTop: 16 }}>Sur Render, ajoutez <code>MONGODB_URI</code> (MongoDB Atlas, gratuit) pour que les comptes et l’école survivent aux mises à jour du site.</p>
      <p className="muted-line">Kelassi IA répond à toute question dès qu’une clé <code>GROQ_API_KEY</code>, <code>OPENAI_API_KEY</code> ou <code>GEMINI_API_KEY</code> est dans Render / .env.</p>
    </div>
  );
}

export default SettingsPage;
