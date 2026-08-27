import React from 'react';

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${wide ? 'wide' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
