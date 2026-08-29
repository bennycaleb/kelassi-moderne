import React, { useEffect, useRef, useState } from 'react';
import { askAi, getAiDesk } from '../services/ai';

function AiAssistant({ variant = 'dock' }) {
  const [open, setOpen] = useState(variant === 'page');
  const [desk, setDesk] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef(null);

  useEffect(() => {
    getAiDesk().then(setDesk).catch(() => {});
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  async function send(text) {
    const message = String(text || input).trim();
    if (!message || loading) return;
    setInput('');
    setError('');
    const next = messages.concat({ role: 'user', content: message });
    setMessages(next);
    setLoading(true);
    try {
      const history = next.slice(-6).map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.content }));
      const data = await askAi(message, history.slice(0, -1));
      setMessages(next.concat({ role: 'assistant', content: data.answer, mode: data.mode }));
      if (data.suggestions) setDesk((current) => ({ ...(current || {}), suggestions: data.suggestions, mode: data.mode }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const body = (
    <div className={`ai-panel ${variant === 'page' ? 'ai-panel-page' : ''}`}>
      <div className="ai-panel-head">
        <div>
          <strong>Kelassi IA</strong>
          <small>École, Kelassi, ou n’importe quelle question comme ChatGPT</small>
        </div>
        {variant !== 'page' && <button type="button" className="ai-close" onClick={() => setOpen(false)}>×</button>}
      </div>
      {desk?.briefing && messages.length === 0 && (
        <div className="ai-briefing">{desk.briefing}</div>
      )}
      <div className="ai-messages">
        {messages.map((item, index) => (
          <div key={`${item.role}-${index}`} className={`ai-bubble ai-${item.role}`}>
            {item.content}
          </div>
        ))}
        {loading && <div className="ai-bubble ai-assistant">Kelassi IA réfléchit…</div>}
        <div ref={bottom} />
      </div>
      {error && <p className="error">{error}</p>}
      <p className="ai-hint">Posez n’importe quelle question : l’école, un cours, un devoir, ou un sujet général.</p>
      <div className="ai-suggestions">
        {(desk?.suggestions || []).map((item) => (
          <button type="button" key={item} onClick={() => send(item)}>{item}</button>
        ))}
      </div>
      <form
        className="ai-form"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Une question sur l’école, ou n’importe quel sujet (comme ChatGPT)…"
        />
        <button className="btn" type="submit" disabled={loading}>Envoyer</button>
      </form>
    </div>
  );

  if (variant === 'page') return body;

  return (
    <div className="ai-dock no-print">
      {open ? body : null}
      <button type="button" className="ai-fab" onClick={() => setOpen((current) => !current)}>
        {open ? 'Fermer' : 'Kelassi IA'}
      </button>
    </div>
  );
}

export default AiAssistant;
