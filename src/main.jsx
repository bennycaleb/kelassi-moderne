import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SchoolProvider } from './context/SchoolContext';
import AppRouter from './router/AppRouter';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SchoolProvider>
        <AppRouter />
      </SchoolProvider>
    </BrowserRouter>
  </React.StrictMode>
);
