const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function looksHashed(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ''));
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 10);
}

function verifyPassword(plain, stored) {
  const secret = String(plain || '');
  const current = String(stored || '');
  if (!secret || !current) return false;
  if (looksHashed(current)) return bcrypt.compareSync(secret, current);
  return secret === current;
}

function generatePassword(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let tail = '';
  for (let i = 0; i < 8; i += 1) tail += chars[crypto.randomInt(0, chars.length)];
  return `${prefix}${tail}`;
}

module.exports = { looksHashed, hashPassword, verifyPassword, generatePassword };
