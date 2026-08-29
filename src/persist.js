const mongoose = require('mongoose');

function mongoUri() {
  return String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
}

let Snapshot = null;
let connected = false;
const pending = new Map();
let flushTimer = null;

function snapshotModel() {
  if (Snapshot) return Snapshot;
  Snapshot = mongoose.models.KelassiSnapshot || mongoose.model(
    'KelassiSnapshot',
    new mongoose.Schema({
      _id: { type: String },
      data: { type: mongoose.Schema.Types.Mixed },
      updatedAt: Date
    }, { collection: 'kelassi_snapshots' })
  );
  return Snapshot;
}

async function connect() {
  const uri = mongoUri();
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Sans MONGODB_URI, Render efface les comptes à chaque déploiement.');
    }
    return false;
  }
  if (connected) return true;
  await mongoose.connect(uri);
  snapshotModel();
  connected = true;
  console.log('Kelassi : données enregistrées dans MongoDB (les comptes survivent aux mises à jour).');
  return true;
}

function mode() {
  return connected ? 'mongodb' : 'local_json';
}

async function read(id) {
  if (!connected) return null;
  const doc = await snapshotModel().findById(id).lean();
  return doc && doc.data !== undefined ? doc.data : null;
}

async function writeNow(id, data) {
  if (!connected) return;
  pending.delete(id);
  await snapshotModel().findByIdAndUpdate(
    id,
    { data, updatedAt: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

function queue(id, data) {
  pending.set(id, data);
  if (!connected) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flush().catch((error) => console.error('Sauvegarde MongoDB :', error.message));
  }, 400);
}

async function flush() {
  clearTimeout(flushTimer);
  const jobs = [...pending.entries()];
  pending.clear();
  for (const [id, data] of jobs) {
    await writeNow(id, data);
  }
}

module.exports = { mongoUri, connect, connected: () => connected, mode, read, writeNow, queue, flush };
