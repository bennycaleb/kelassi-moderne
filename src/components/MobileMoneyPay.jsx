import React, { useState } from 'react';

function Channel({ label, name, number }) {
  const [copied, setCopied] = useState(false);
  if (!number) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pay-channel">
      <h3>{label}</h3>
      {name ? <p>Au nom de <b>{name}</b></p> : null}
      <p className="pay-number">{number}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
        {copied ? 'Numéro copié' : 'Copier le numéro'}
      </button>
    </div>
  );
}

function MobileMoneyPay({ channels, title = 'Payer la scolarité en ligne' }) {
  const data = channels || {};
  if (!data.hasAny && !data.momoNumber && !data.airtelMoneyNumber) return null;

  return (
    <div className="panel pay-mobile">
      <h2>{title}</h2>
      <p>Envoyez le montant dû par Mobile Money, puis indiquez le nom et la classe de l’élève en référence. L’école validera le paiement dans Kelassi.</p>
      <div className="pay-channels">
        <Channel label="MTN MoMo" name={data.momoName} number={data.momoNumber} />
        <Channel label="Airtel Money" name={data.airtelMoneyName} number={data.airtelMoneyNumber} />
      </div>
      {data.paymentInstructions ? <p className="muted-line">{data.paymentInstructions}</p> : null}
    </div>
  );
}

export default MobileMoneyPay;
