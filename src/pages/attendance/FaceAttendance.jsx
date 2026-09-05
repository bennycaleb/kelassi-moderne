import React, { useEffect, useRef, useState } from 'react';
import Avatar from '../../components/Avatar';
import PresenceMark from '../../components/PresenceMark';
import { useSchool } from '../../context/SchoolContext';
import { api } from '../../services/api';
import { detectFace, loadFaceModels, matchDescriptor } from '../../services/face';

function FaceAttendance() {
  const { year, classes } = useSchool();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const cooldownRef = useRef({});
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [faces, setFaces] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0 });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Choisissez une classe, puis démarrez le scan.');
  const [lastMatch, setLastMatch] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (classes[0] && !classId) setClassId(classes[0].id);
  }, [classes, classId]);

  async function loadClass() {
    if (!classId) return;
    const [faceData, attendanceData] = await Promise.all([
      api(`/api/students/faces?classId=${classId}`),
      api(`/api/attendance?classId=${classId}&date=${date}`)
    ]);
    setFaces(faceData.students || []);
    setRecords(attendanceData.attendance || []);
    setSummary(attendanceData.summary || { present: 0, absent: 0, late: 0 });
  }

  useEffect(() => {
    loadClass().catch((err) => setError(err.message));
  }, [classId, date, year]);

  useEffect(() => () => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const className = classes.find((item) => item.id === classId)?.name || '';

  async function startScan() {
    setError('');
    if (!faces.length) {
      setError('Aucun visage enregistré pour cette classe. Inscrivez d’abord l’élève dans Étudiants (scan du visage).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningRef.current = true;
      setRunning(true);
      setStatus('Chargement de la reconnaissance…');
      await loadFaceModels();
      setStatus('L’élève peut passer devant la caméra.');
      loop();
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Autorisez la caméra pour lancer la reconnaissance.' : err.message);
    }
  }

  function stopScan() {
    scanningRef.current = false;
    setRunning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setStatus('Scan arrêté.');
  }

  async function loop() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    if (video && video.videoWidth) {
      try {
        const detection = await detectFace(video);
        if (detection) {
          const match = matchDescriptor(detection.descriptor, faces);
          if (match) {
            const studentId = match.student.id;
            const last = cooldownRef.current[studentId] || 0;
            if (Date.now() - last > 12000) {
              cooldownRef.current[studentId] = Date.now();
              const result = await api('/api/attendance/face', {
                method: 'POST',
                body: { classId, date, studentId }
              });
              setLastMatch({
                ...match.student,
                at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                action: result.action,
                message: result.message
              });
              setRecords(result.attendance || []);
              if (result.summary) setSummary(result.summary);
              setStatus(result.message);
            }
          } else {
            setStatus('Visage vu, mais non reconnu dans cette classe.');
          }
        }
      } catch {
        /* keep scanning */
      }
    }
    if (scanningRef.current) setTimeout(loop, 900);
  }

  return (
    <div>
      <div className="page-toolbar">
        <div className="page-header">
          <h1>Reconnaissance faciale</h1>
          <p>Premier passage = heure d’arrivée. Deuxième passage à la sortie = heure de départ et statut Présent. Le parent voit les deux heures.</p>
        </div>
        {running
          ? <button type="button" className="btn btn-danger" onClick={stopScan}>Arrêter le scan</button>
          : <button type="button" className="btn" onClick={startScan}>Démarrer le scan</button>}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="panel form-grid">
        <div className="form-field">
          <label>Classe</label>
          <select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={running}>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Date</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={running} />
        </div>
        <div className="form-field">
          <label>Visages enregistrés</label>
          <p>{faces.length} élève{faces.length > 1 ? 's' : ''} de {className || '—'}</p>
        </div>
        <div className="form-field">
          <label>Présents aujourd’hui</label>
          <p>🟢 {summary.present || 0} présents · 🔵 {summary.arrived || 0} arrivés · 🔴 {summary.absent || 0} · 🟡 {summary.late || 0}</p>
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="face-scan-box">
            <video ref={videoRef} playsInline muted autoPlay />
            <p>{status}</p>
            {lastMatch && (
              <div className="face-match">
                <Avatar src={lastMatch.photo} name={lastMatch.firstName} size="profile" />
                <div>
                  <h3>{lastMatch.lastName} {lastMatch.firstName}</h3>
                  <p>{lastMatch.action === 'sortie' ? 'Sortie — présent au cours' : lastMatch.action === 'arrivée' ? 'Arrivée enregistrée' : lastMatch.message || `Scan à ${lastMatch.at}`}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <h2>Présences du jour</h2>
          <table>
            <thead><tr><th>Étudiant</th><th>Statut</th><th>Entrée</th><th>Sortie</th><th>Mode</th></tr></thead>
            <tbody>
              {records.map((item) => (
                <tr key={item.id}>
                  <td>{item.studentName}</td>
                  <td><PresenceMark status={item.status} /></td>
                  <td>{item.arrivedAtLabel || '—'}</td>
                  <td>{item.leftAtLabel || '—'}</td>
                  <td>{item.method === 'facial' ? 'Visage' : 'Manuel'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && <p className="empty-state">Personne n’a encore été scanné aujourd’hui.</p>}
        </div>
      </div>
    </div>
  );
}

export default FaceAttendance;
