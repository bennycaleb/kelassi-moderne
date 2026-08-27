import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const SchoolContext = createContext(null);

export function SchoolProvider({ children }) {
  const [year, setYearState] = useState(() => localStorage.getItem('kelassi_year') || '2026-2027');
  const [meta, setMeta] = useState(null);

  function setYear(value) {
    localStorage.setItem('kelassi_year', value);
    setYearState(value);
  }

  useEffect(() => {
    function loadMeta() {
      if (!localStorage.getItem('kelassi_token')) {
        setMeta(null);
        return;
      }
      api('/api/meta')
        .then((data) => {
          setMeta(data);
          if (!localStorage.getItem('kelassi_year') && data.settings?.currentYear) {
            setYear(data.settings.currentYear);
          }
        })
        .catch(() => {});
    }

    function onLogout() {
      setMeta(null);
    }

    loadMeta();
    window.addEventListener('kelassi-auth', loadMeta);
    window.addEventListener('kelassi-meta', loadMeta);
    window.addEventListener('kelassi-logout', onLogout);
    return () => {
      window.removeEventListener('kelassi-auth', loadMeta);
      window.removeEventListener('kelassi-meta', loadMeta);
      window.removeEventListener('kelassi-logout', onLogout);
    };
  }, []);

  useEffect(() => {
    if (!meta) return;
    if (!localStorage.getItem('kelassi_token')) return;
    api('/api/meta').then(setMeta).catch(() => {});
  }, [year]);

  return (
    <SchoolContext.Provider value={{ year, setYear, meta, settings: meta?.settings, classes: meta?.classes || [], subjects: meta?.subjects || [], teachers: meta?.teachers || [], cycles: meta?.cycles || [], evaluationTypes: meta?.evaluationTypes || [], years: meta?.years || ['2025-2026', '2026-2027', '2027-2028'] }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function refreshSchoolMeta() {
  window.dispatchEvent(new Event('kelassi-meta'));
}

export function useSchool() {
  return useContext(SchoolContext) || { year: '2026-2027', setYear: () => {}, classes: [], subjects: [], teachers: [], cycles: [], evaluationTypes: [], years: ['2026-2027'], settings: {} };
}
