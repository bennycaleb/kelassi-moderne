import React from 'react';

const LABELS = {
  présent: { icon: '🟢', label: 'Présent', className: 'present' },
  arrivé: { icon: '🔵', label: 'Arrivé', className: 'arrived' },
  absent: { icon: '🔴', label: 'Absent', className: 'absent' },
  retard: { icon: '🟡', label: 'Retard', className: 'late' }
};

function PresenceMark({ status }) {
  const item = LABELS[status] || LABELS.présent;
  return <span className={`presence-mark ${item.className}`}>{item.icon} {item.label}</span>;
}

export default PresenceMark;
