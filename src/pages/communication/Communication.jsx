import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useSchool } from '../../context/SchoolContext';

function Communication() {
  const { year } = useSchool();
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', audience: 'Tous', date: '' });
  const [eventForm, setEventForm] = useState({ title: '', date: '', time: '', place: '' });

  async function refresh() {
    const [a, e] = await Promise.all([api('/api/announcements'), api('/api/events')]);
    setAnnouncements(a.announcements);
    setEvents(e.events);
  }

  useEffect(() => { refresh().catch(() => {}); }, [year]);

  return (
    <div>
      <div className="page-header"><h1>Communication</h1><p>Annonces internes, messages et calendrier d’événements.</p></div>
      <div className="grid-two">
        <form className="panel" onSubmit={async (event) => { event.preventDefault(); await api('/api/announcements', { method: 'POST', body: form }); setForm({ title: '', body: '', audience: 'Tous', date: '' }); refresh(); }}>
          <h2>Nouvelle annonce</h2>
          <div className="form-field"><label>Titre</label><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></div>
          <div className="form-field"><label>Message</label><textarea rows="3" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></div>
          <div className="form-field"><label>Public</label><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option>Tous</option><option>Étudiants</option><option>Enseignants</option><option>Parents</option></select></div>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Publier</button>
        </form>
        <form className="panel" onSubmit={async (event) => { event.preventDefault(); await api('/api/events', { method: 'POST', body: eventForm }); setEventForm({ title: '', date: '', time: '', place: '' }); refresh(); }}>
          <h2>Nouvel événement</h2>
          <div className="form-field"><label>Titre</label><input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} required /></div>
          <div className="form-field"><label>Date</label><input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} required /></div>
          <div className="form-field"><label>Heure</label><input value={eventForm.time} onChange={(event) => setEventForm({ ...eventForm, time: event.target.value })} placeholder="15:00" /></div>
          <div className="form-field"><label>Lieu</label><input value={eventForm.place} onChange={(event) => setEventForm({ ...eventForm, place: event.target.value })} /></div>
          <button className="btn" type="submit" style={{ marginTop: 12 }}>Ajouter au calendrier</button>
        </form>
      </div>
      <div className="grid-two">
        <div className="panel">
          <h2>Annonces</h2>
          {announcements.map((item) => (
            <div key={item.id} className="announce-item">
              <strong>📢 {item.title}</strong>
              <p>{item.body}</p>
              <button type="button" className="btn btn-danger btn-sm" onClick={async () => { if (!window.confirm('Supprimer cette annonce ?')) return; await api(`/api/announcements/${item.id}`, { method: 'DELETE' }); refresh(); }}>Supprimer</button>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Calendrier</h2>
          {events.map((item) => (
            <p key={item.id}>
              {item.date} {item.time} — {item.title} ({item.place}){' '}
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (!window.confirm('Supprimer cet événement ?')) return;
                  await api(`/api/events/${item.id}`, { method: 'DELETE' });
                  refresh();
                }}
              >
                Supprimer
              </button>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Communication;
