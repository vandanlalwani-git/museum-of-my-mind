import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarField } from '@/components/StarField';
import { DEMO_MIND_ID } from '@/mind/demo';
import { useMind } from '@/mind/store';
import '@/components/Field.css';
import '@/components/Instrument.css';
import './welcome.css';

/** The front door: begin your own museum, or look around Alex's first. */
export default function Welcome() {
  const navigate = useNavigate();
  const minds = useMind((s) => s.minds);
  const enter = useMind((s) => s.enter);
  const createMind = useMind((s) => s.createMind);
  const own = minds.filter((m) => m.kind === 'own').sort((a, b) => b.lastEnteredAt - a.lastEnteredAt);
  const [name, setName] = useState('');
  const [keeper, setKeeper] = useState('');
  const [galaxy, setGalaxy] = useState('Personal');
  const [busy, setBusy] = useState(false);

  const open = async (id: string) => { setBusy(true); try { await enter(id); navigate('/'); } finally { setBusy(false); } };
  const begin = async () => {
    setBusy(true);
    try {
      await createMind({ name: name || (keeper ? `${keeper}'s mind` : 'My Mind'), visitorName: keeper, galaxyName: galaxy });
      navigate('/');
    } finally { setBusy(false); }
  };

  return (
    <div className="welcome">
      <StarField seed="welcome" density={1.2} className="welcome__sky" />
      <div className="welcome__inner">
        <header className="welcome__head">
          <p className="welcome__over">The Museum of</p>
          <h1 className="welcome__title">My <em>Mind</em></h1>
          <p className="welcome__lede">A quiet place to see your thoughts, sort them, and find your way when life feels crowded. Areas of your life become galaxies. Goals become stars. Thoughts drift until you are ready to give them a home.</p>
        </header>

        {own.length > 0 && (
          <section className="welcome__card plate" aria-label="Your museums">
            <p className="place__eyebrow">Welcome back</p>
            <ul className="welcome__list">
              {own.map((m) => (
                <li key={m.id}><button type="button" className="welcome__open" onClick={() => void open(m.id)} disabled={busy}>{m.name}<span>Open</span></button></li>
              ))}
            </ul>
          </section>
        )}

        <div className="welcome__paths">
          <form className="welcome__card plate" onSubmit={(e) => { e.preventDefault(); void begin(); }}>
            <p className="place__eyebrow">{own.length ? 'Another museum' : 'Begin your own'}</p>
            <label className="field"><span className="plaque">Your name (optional)</span><input className="field__input" value={keeper} onChange={(e) => setKeeper(e.target.value)} autoComplete="given-name" /></label>
            <label className="field"><span className="plaque">Name your museum</span><input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder={keeper ? `${keeper}'s mind` : 'My Mind'} /></label>
            <label className="field"><span className="plaque">Your first galaxy</span><input className="field__input" value={galaxy} onChange={(e) => setGalaxy(e.target.value)} /></label>
            <p className="meta">A galaxy is an area of your life. You can add more any time. Everything stays in this browser.</p>
            <button type="submit" className="instrument instrument--primary" disabled={busy}>Open my museum</button>
          </form>
          <div className="welcome__card plate welcome__demo">
            <p className="place__eyebrow">Not sure yet?</p>
            <h2 className="welcome__demo-title">Look around Alex's museum</h2>
            <p className="meta">A fictional person with a full-time job, slowly making room for health, a side project, creativity and people. Touch anything; it resets itself.</p>
            <button type="button" className="instrument" onClick={() => void open(DEMO_MIND_ID)} disabled={busy}>Look around</button>
          </div>
        </div>
      </div>
    </div>
  );
}
