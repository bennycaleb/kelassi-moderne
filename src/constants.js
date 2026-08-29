export const CLASS_OPTIONS = [
  '6e A',
  '6e B',
  '5e A',
  '3e A',
  '2nde A',
  'Terminale C',
  'L1 Informatique',
  'L2 Informatique',
  'L3 Informatique',
  'Master'
];

export const SUBJECT_OPTIONS = [
  'Mathématiques',
  'Français',
  'Anglais',
  'Informatique',
  'Physique',
  'Réseaux',
  'Data Science',
  'Sport'
];

export const GRADE_LABELS = ['Contrôle 1', 'Contrôle 2', 'Contrôle continu', 'Interrogation', 'Devoir', 'Examen', 'Projet'];

export const PAYMENT_METHODS = ['Espèces', 'MTN MoMo', 'Airtel Money', 'Mobile Money', 'Banque', 'Virement bancaire'];

export const FEE_TYPES = [
  "Frais d'inscription",
  'Frais de scolarité',
  "Frais d'examen",
  'Autres frais'
];

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00'];

export const TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

export const ATTENDANCE_STATUSES = [
  { value: 'présent', label: 'Présent' },
  { value: 'absent', label: 'Absent' },
  { value: 'retard', label: 'Retard' }
];

export const STAFF_ROLES = ['admin', 'superadmin', 'director', 'secretary', 'accountant'];

export const ROLE_LABELS = {
  owner: 'Entreprise Kelassi',
  superadmin: 'Super Admin',
  admin: 'Administrateur',
  director: 'Directeur',
  secretary: 'Secrétaire',
  accountant: 'Comptable',
  teacher: 'Enseignant',
  student: 'Étudiant',
  parent: 'Parent'
};

export const DOCUMENT_TYPES = [
  { id: 'certificate', label: 'Certificat de scolarité' },
  { id: 'enrollment', label: "Attestation d'inscription" },
  { id: 'attendance', label: 'Attestation de fréquentation' },
  { id: 'transcript', label: 'Relevé de notes' },
  { id: 'bulletin', label: 'Bulletin' },
  { id: 'success', label: 'Certificat de réussite' },
  { id: 'receipt', label: 'Reçu de paiement' },
  { id: 'convocation', label: 'Convocation' },
  { id: 'card', label: "Carte d'étudiant" }
];

export function roleHome(role) {
  if (role === 'owner') return '/owner';
  if (['admin', 'superadmin', 'director', 'secretary', 'accountant'].includes(role)) return '/dashboard';
  if (role === 'teacher') return '/teacher';
  if (role === 'parent') return '/parent';
  return '/student';
}

export function canSee(role, section) {
  if (['admin', 'superadmin', 'director'].includes(role)) return true;
  if (role === 'secretary') {
    return !['users'].includes(section) || true;
  }
  if (role === 'accountant') {
    return ['dashboard', 'payments', 'documents', 'settings', 'ai'].includes(section);
  }
  if (role === 'teacher') {
    return ['grades', 'academic'].includes(section);
  }
  return false;
}
