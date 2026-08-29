import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import MobileMoneyPay from '../../components/MobileMoneyPay';
import { FEE_TYPES, PAYMENT_METHODS } from '../../constants';
import { useSchool } from '../../context/SchoolContext';
import { money } from '../../services/api';
import { createPayment, deletePayment, getPayments, settlePayment, updatePayment } from '../../services/payment';
import { getStudents } from '../../services/student';

const emptyForm = {
  studentId: '',
  amount: '',
  method: PAYMENT_METHODS[0],
  feeType: 'Frais de scolarité',
  month: '',
  status: 'payé',
  dueDate: '',
  paidAt: new Date().toISOString().slice(0, 10)
};

function badgeClass(status) {
  if (status === 'payé') return 'badge badge-success';
  if (status === 'partiel') return 'badge badge-warning';
  if (status === 'impayé') return 'badge badge-danger';
  return 'badge';
}

function Payments() {
  const { year, settings, classes } = useSchool();
  const currency = settings?.currency || 'FCFA';
  const [tab, setTab] = useState('situation');
  const [payments, setPayments] = useState([]);
  const [situation, setSituation] = useState([]);
  const [totals, setTotals] = useState({ paid: 0, unpaid: 0 });
  const [tuitionAmount, setTuitionAmount] = useState(0);
  const [paymentChannels, setPaymentChannels] = useState(null);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [settleFor, setSettleFor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [settleForm, setSettleForm] = useState({ amount: '', method: PAYMENT_METHODS[0], paidAt: new Date().toISOString().slice(0, 10) });
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [paymentData, studentData] = await Promise.all([getPayments(), getStudents()]);
    setPayments(paymentData.payments);
    setSituation(paymentData.situation || []);
    setTotals(paymentData.totals || { paid: 0, unpaid: 0 });
    setTuitionAmount(Number(paymentData.tuitionAmount || 0));
    setPaymentChannels(paymentData.paymentChannels || null);
    setStudents(studentData.students);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  const filteredSituation = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return situation.filter((item) => {
      const haystack = `${item.lastName} ${item.firstName} ${item.matricule} ${item.className}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (classFilter && item.classId !== classFilter) return false;
      if (statusFilter && item.tuitionStatus !== statusFilter) return false;
      return true;
    });
  }, [situation, query, classFilter, statusFilter]);

  const filteredPayments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.filter((item) => {
      const haystack = `${item.studentName} ${item.receiptNumber} ${item.feeType}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (statusFilter === 'payé' && item.status !== 'payé') return false;
      if (statusFilter && statusFilter !== 'payé' && item.status === 'payé') return false;
      return true;
    });
  }, [payments, query, statusFilter]);

  function openCreate(studentId = '') {
    setForm({ ...emptyForm, studentId, paidAt: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openSettle(student) {
    const due = Number(student.tuitionDue || student.tuition?.due || 0);
    setSettleFor(student);
    setSettleForm({
      amount: due > 0 ? String(due) : '',
      method: PAYMENT_METHODS[0],
      paidAt: new Date().toISOString().slice(0, 10)
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await createPayment({ ...form, amount: Number(form.amount), date: form.paidAt });
      setOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitSettle(event) {
    event.preventDefault();
    setError('');
    try {
      await settlePayment({
        studentId: settleFor.id,
        amount: settleForm.amount === '' ? undefined : Number(settleForm.amount),
        method: settleForm.method,
        paidAt: settleForm.paidAt,
        feeType: 'Frais de scolarité'
      });
      setSettleFor(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Scolarité & paiements</h1>
          <p>Encaissé : {money(totals.paid, currency)} · Reste dû : {money(totals.unpaid, currency)}{tuitionAmount ? ` · Scolarité attendue : ${money(tuitionAmount, currency)} / élève` : ''}</p>
        </div>
        <button type="button" className="btn" onClick={() => openCreate()}>Enregistrer un paiement</button>
      </div>

      {!tuitionAmount && (
        <div className="credentials-box">
          Pour voir qui a payé ou qui doit encore, indiquez le montant de scolarité dans <Link to="/dashboard/settings">Paramètres</Link>.
        </div>
      )}
      {paymentChannels?.hasAny
        ? <MobileMoneyPay channels={paymentChannels} title="Numéros visibles par les parents" />
        : (
          <div className="credentials-box">
            Ajoutez les numéros MTN MoMo et Airtel Money dans <Link to="/dashboard/settings">Paramètres</Link> : les parents les verront pour payer la scolarité.
          </div>
        )}
      {error && !open && !settleFor && <p className="error">{error}</p>}

      <div className="tabs">
        <button type="button" className={tab === 'situation' ? 'active' : ''} onClick={() => setTab('situation')}>Situation par élève</button>
        <button type="button" className={tab === 'historique' ? 'active' : ''} onClick={() => setTab('historique')}>Historique des encaissements</button>
      </div>

      <div className="panel toolbar-filters" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
        <div className="form-field">
          <label>Recherche</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, matricule, reçu…" />
        </div>
        {tab === 'situation' && (
          <div className="form-field">
            <label>Classe</label>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">Toutes</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-field">
          <label>Statut</label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Tous</option>
            <option value="payé">Payé</option>
            <option value="partiel">Partiel</option>
            <option value="impayé">Impayé</option>
            <option value="non renseigné">Non renseigné</option>
          </select>
        </div>
      </div>

      {tab === 'situation' && (
        <div className="panel">
          {filteredSituation.length === 0 ? (
            <div className="empty-state"><p>Aucun élève à afficher.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Classe</th>
                    <th>Payé</th>
                    <th>Reste dû</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSituation.map((student) => (
                    <tr key={student.id}>
                      <td><b>{student.lastName} {student.firstName}</b><small className="muted-line">{student.matricule}</small></td>
                      <td>{student.className || '—'}</td>
                      <td>{money(student.tuitionPaid || 0, currency)}</td>
                      <td>{money(student.tuitionDue || 0, currency)}</td>
                      <td><span className={badgeClass(student.tuitionStatus)}>{student.tuitionLabel}</span></td>
                      <td className="row-actions">
                        {student.tuitionStatus !== 'payé' && (
                          <button type="button" className="btn btn-sm" onClick={() => openSettle(student)}>Marquer payé</button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCreate(student.id)}>Versement</button>
                        <Link className="btn btn-secondary btn-sm" to={`/dashboard/students/${student.id}`}>Fiche</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'historique' && (
        <div className="panel">
          {filteredPayments.length === 0 ? (
            <div className="empty-state"><p>Aucun paiement enregistré.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Reçu</th><th>Étudiant</th><th>Motif</th><th>Montant</th><th>Mode</th><th>Date</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.receiptNumber}</td>
                      <td>{payment.studentName}<small className="muted-line">{payment.className}</small></td>
                      <td>{payment.feeType}</td>
                      <td>{money(payment.amount, currency)}</td>
                      <td>{payment.method}</td>
                      <td>{payment.paidAt || payment.createdAt?.slice(0, 10) || payment.dueDate || '—'}</td>
                      <td><span className={payment.status === 'payé' ? 'badge badge-success' : 'badge badge-warning'}>{payment.status}</span></td>
                      <td className="row-actions">
                        {payment.status !== 'payé' && (
                          <button type="button" className="btn btn-sm" onClick={async () => { await updatePayment(payment.id, { status: 'payé' }); refresh(); }}>Valider</button>
                        )}
                        {payment.status === 'payé' && <a className="btn btn-secondary btn-sm" href={`/print/receipt?paymentId=${payment.id}&studentId=${payment.studentId}`} target="_blank" rel="noreferrer">Reçu PDF</a>}
                        <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer ce paiement ?')) return; await deletePayment(payment.id); refresh(); }}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open && (
        <Modal title="Enregistrer un paiement" onClose={() => setOpen(false)}>
          {error && <p className="error">{error}</p>}
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Étudiant</label><select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required><option value="">Choisir</option>{students.map((item) => <option key={item.id} value={item.id}>{item.lastName} {item.firstName}</option>)}</select></div>
              <div className="form-field"><label>Motif</label><select value={form.feeType} onChange={(event) => setForm({ ...form, feeType: event.target.value })}>{FEE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="form-field"><label>Montant ({currency})</label><input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></div>
              <div className="form-field"><label>Mode</label><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="form-field"><label>Date</label><input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} /></div>
              <div className="form-field"><label>Échéance</label><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div>
              <div className="form-field"><label>Statut</label><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="payé">Payé</option><option value="en attente">En attente</option></select></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn" type="submit">Enregistrer</button></div>
          </form>
        </Modal>
      )}

      {settleFor && (
        <Modal title={`Marquer payé — ${settleFor.lastName} ${settleFor.firstName}`} onClose={() => setSettleFor(null)}>
          {error && <p className="error">{error}</p>}
          <form onSubmit={submitSettle}>
            <p>Les versements en attente seront validés. Indiquez le montant reçu maintenant{tuitionAmount ? ` (reste dû : ${money(settleFor.tuitionDue || 0, currency)})` : ''}.</p>
            <div className="form-grid">
              <div className="form-field"><label>Montant ({currency})</label><input type="number" min="0" value={settleForm.amount} onChange={(event) => setSettleForm({ ...settleForm, amount: event.target.value })} placeholder={tuitionAmount ? String(settleFor.tuitionDue || '') : 'Montant payé'} /></div>
              <div className="form-field"><label>Mode</label><select value={settleForm.method} onChange={(event) => setSettleForm({ ...settleForm, method: event.target.value })}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="form-field"><label>Date</label><input type="date" value={settleForm.paidAt} onChange={(event) => setSettleForm({ ...settleForm, paidAt: event.target.value })} /></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setSettleFor(null)}>Annuler</button><button className="btn" type="submit">Confirmer le paiement</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Payments;
