import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Modal from '../../components/Modal';
import { api, money } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

const KINDS = {
  budget: {
    title: 'Budget',
    text: 'Préparer et suivre le budget du lycée.',
    add: 'Ajouter une ligne budgétaire',
    statuses: ['prévu', 'engagé', 'consommé'],
    fields: ['title', 'amount', 'status', 'detail']
  },
  expense: {
    title: 'Dépenses et factures',
    text: 'Suivre les sorties d’argent et les factures à payer.',
    add: 'Enregistrer une dépense',
    statuses: ['à payer', 'payée'],
    fields: ['title', 'amount', 'supplier', 'date', 'status', 'detail']
  },
  purchase: {
    title: 'Achats et commandes',
    text: 'Devis, commande, livraison — comme pour 20 ordinateurs.',
    add: 'Nouvelle commande',
    statuses: ['demande', 'devis', 'commandé', 'livré'],
    fields: ['title', 'amount', 'quantity', 'supplier', 'status', 'detail']
  },
  inventory: {
    title: 'Inventaire et stocks',
    text: 'Enregistrer le matériel reçu et contrôler les stocks.',
    add: 'Ajouter un équipement',
    statuses: ['en stock', 'en service', 'hors service'],
    fields: ['title', 'quantity', 'place', 'status', 'detail']
  },
  maintenance: {
    title: 'Entretien et réparations',
    text: 'Organiser la maintenance des bâtiments et du matériel.',
    add: 'Signaler une réparation',
    statuses: ['à faire', 'en cours', 'fait'],
    fields: ['title', 'place', 'status', 'detail']
  },
  service: {
    title: 'Services généraux',
    text: 'Entretien, sécurité, cantine, approvisionnements, transport, internat.',
    add: 'Ajouter un suivi',
    statuses: ['à suivre', 'en cours', 'fait'],
    fields: ['title', 'category', 'status', 'detail']
  },
  supplier: {
    title: 'Fournisseurs et contrats',
    text: 'Tenir les dossiers fournisseurs et les marchés.',
    add: 'Ajouter un fournisseur',
    statuses: ['actif', 'terminé'],
    fields: ['title', 'supplier', 'status', 'detail']
  },
  report: {
    title: 'Rapports à la direction',
    text: 'Produire un point financier ou matériel pour le D.E.',
    add: 'Nouveau rapport',
    statuses: ['brouillon', 'transmis'],
    fields: ['title', 'status', 'detail']
  }
};

function currentRole() {
  try { return JSON.parse(localStorage.getItem('kelassi_user') || '{}').role; } catch { return ''; }
}

function emptyForm(kind) {
  return {
    title: '',
    amount: '',
    quantity: '',
    place: '',
    supplier: '',
    category: '',
    status: kind.statuses[0],
    date: new Date().toISOString().slice(0, 10),
    detail: ''
  };
}

function EstateRecords() {
  const { type } = useParams();
  const kind = KINDS[type];
  if (!kind) return <Navigate to="/dashboard/estate" replace />;
  return <EstateBoard type={type} kind={kind} />;
}

function EstateBoard({ type, kind }) {
  const { settings } = useSchool();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(kind));
  const [error, setError] = useState('');
  const role = currentRole();
  const canWrite = role === 'intendant';
  const currency = settings?.currency || 'FC';

  async function refresh() {
    const data = await api(`/api/estate?type=${encodeURIComponent(type)}`);
    setItems(data.records || []);
  }

  useEffect(() => {
    setForm(emptyForm(kind));
    refresh().catch((err) => setError(err.message));
  }, [type]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items]
  );

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/estate', { method: 'POST', body: { ...form, type } });
      setOpen(false);
      setForm(emptyForm(kind));
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>{kind.title}</h1>
          <p>{kind.text}{kind.fields.includes('amount') && total ? ` · Total : ${money(total, currency)}` : ''}</p>
        </div>
        {canWrite && (
          <button type="button" className="btn" onClick={() => { setError(''); setForm(emptyForm(kind)); setOpen(true); }}>
            ➕ {kind.add}
          </button>
        )}
      </div>
      {error && !open && <p className="error">{error}</p>}
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Intitulé</th>
                {kind.fields.includes('amount') && <th>Montant</th>}
                {kind.fields.includes('quantity') && <th>Qté</th>}
                {kind.fields.includes('place') && <th>Lieu</th>}
                {kind.fields.includes('supplier') && <th>Fournisseur</th>}
                {kind.fields.includes('category') && <th>Service</th>}
                <th>Statut</th>
                <th>Par</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="9">Aucun enregistrement pour le moment.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date || '—'}</td>
                  <td>
                    <strong>{item.title}</strong>
                    {item.detail ? <small className="muted-line">{item.detail}</small> : null}
                  </td>
                  {kind.fields.includes('amount') && <td>{item.amount ? money(item.amount, currency) : '—'}</td>}
                  {kind.fields.includes('quantity') && <td>{item.quantity || '—'}</td>}
                  {kind.fields.includes('place') && <td>{item.place || '—'}</td>}
                  {kind.fields.includes('supplier') && <td>{item.supplier || '—'}</td>}
                  {kind.fields.includes('category') && <td>{item.category || '—'}</td>}
                  <td><span className="badge">{item.status}</span></td>
                  <td>{item.createdByName || '—'}</td>
                  {canWrite && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          if (!window.confirm('Supprimer cette ligne ?')) return;
                          await api(`/api/estate/${item.id}`, { method: 'DELETE' });
                          refresh();
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && canWrite && (
        <Modal title={kind.add} onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field full"><label>Intitulé</label><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Ex. 20 ordinateurs salle info" /></div>
              {kind.fields.includes('amount') && (
                <div className="form-field"><label>Montant</label><input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
              )}
              {kind.fields.includes('quantity') && (
                <div className="form-field"><label>Quantité</label><input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></div>
              )}
              {kind.fields.includes('place') && (
                <div className="form-field"><label>Lieu</label><input value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} placeholder="Salle, bâtiment…" /></div>
              )}
              {kind.fields.includes('supplier') && (
                <div className="form-field"><label>Fournisseur</label><input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></div>
              )}
              {kind.fields.includes('category') && (
                <div className="form-field">
                  <label>Service</label>
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    <option value="">—</option>
                    <option>Entretien</option>
                    <option>Sécurité / maintenance</option>
                    <option>Cantine / restauration</option>
                    <option>Achats / approvisionnements</option>
                    <option>Transport</option>
                    <option>Internat / hébergement</option>
                  </select>
                </div>
              )}
              {kind.fields.includes('date') && (
                <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
              )}
              <div className="form-field">
                <label>Statut</label>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  {kind.statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-field full"><label>Détail</label><textarea rows="3" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></div>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
              <button className="btn" type="submit">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default EstateRecords;
