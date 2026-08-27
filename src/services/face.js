const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';

let scriptLoading;
let modelsLoading;

function faceapi() {
  return window.faceapi;
}

function loadScript() {
  if (window.faceapi) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.faceapi ? resolve() : reject(new Error('Reconnaissance faciale indisponible')));
      script.onerror = () => reject(new Error('Impossible de charger la reconnaissance faciale. Vérifiez internet.'));
      document.head.appendChild(script);
    });
  }
  return scriptLoading;
}

export async function loadFaceModels() {
  await loadScript();
  const api = faceapi();
  if (api.nets.tinyFaceDetector.params && api.nets.faceRecognitionNet.params) return;
  if (!modelsLoading) {
    modelsLoading = Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      api.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
  }
  await modelsLoading;
}

export async function detectFace(input) {
  await loadFaceModels();
  const api = faceapi();
  return api
    .detectSingleFace(input, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
}

export function snapshotFromVideo(video) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 480;
  canvas.height = video.videoHeight || 360;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function matchDescriptor(descriptor, students, threshold = 0.48) {
  const api = faceapi();
  let best = null;
  let bestDistance = threshold;
  (students || []).forEach((student) => {
    if (!student.faceDescriptor?.length || !api) return;
    const distance = api.euclideanDistance(descriptor, student.faceDescriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { student, distance };
    }
  });
  return best;
}
