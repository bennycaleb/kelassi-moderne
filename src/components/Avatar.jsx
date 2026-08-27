import React from 'react';

function Avatar({ src, name, size = 'mini' }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const className = size === 'profile' ? 'profile-photo' : 'mini-photo';
  if (src) return <img src={src} alt="" className={className} />;
  return <span className={`${className} placeholder`}>{initial}</span>;
}

export default Avatar;
