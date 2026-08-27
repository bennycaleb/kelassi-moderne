import React, { useEffect, useRef, useState } from 'react';
import { detectFace, loadFaceModels, snapshotFromVideo } from '../services/face';

function FaceCapture({ photo, onCapture, label = 'Scanner le visage' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('Autorisez la caméra si Chrome le demande…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Ce navigateur ne permet pas la caméra. Importez une photo.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = async () => {
            try {
              await video.play();
              setReady(true);
              setStatus('Placez le visage dans le cadre, puis scannez.');
            } catch {
              setError('Impossible de démarrer la vidéo. Réessayez.');
            }
          };
        }
        loadFaceModels().catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setReady(false);
        setError(err.name === 'NotAllowedError' || err.name === 'NotFoundError'
          ? 'Autorisez la caméra dans Chrome (icône à gauche de l’adresse), puis rechargez.'
          : (err.message || 'Caméra indisponible. Vous pouvez importer une photo.'));
        setStatus('');
      }
    }

    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function scan() {
    setBusy(true);
    setError('');
    try {
      const video = videoRef.current;
      if (!ready || !video || !video.videoWidth) {
        throw new Error('Caméra pas encore prête. Attendez l’image, ou autorisez-la dans Chrome.');
      }
      setStatus('Analyse du visage…');
      const detection = await detectFace(video);
      if (!detection) throw new Error('Aucun visage détecté. Reculez un peu, face à la caméra, puis scannez.');
      onCapture({
        photo: snapshotFromVideo(video),
        faceDescriptor: Array.from(detection.descriptor)
      });
      setStatus('Visage enregistré.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="face-capture">
      <p><b>{label}</b></p>
      <div className="face-preview">
        <video ref={videoRef} playsInline muted autoPlay />
        {photo ? <img src={photo} alt="Photo de l’étudiant" /> : null}
      </div>
      {status && <p className="muted-line">{status}</p>}
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn" onClick={scan} disabled={busy}>
        {busy ? 'Analyse…' : '📷 Prendre / scanner le visage'}
      </button>
    </div>
  );
}

export default FaceCapture;
