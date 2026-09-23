import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Doorway } from '@/components/Doorway';
import { Instrument } from '@/components/Instrument';
import { StarField } from '@/components/StarField';
import { useMuseumStore } from '@/store/museum';
import { DEMO_MUSEUM_ID } from '@/data/seed';
import { useUiStore } from '@/store/ui';
import { EASE_OUT_QUINT, prefersReducedMotion } from '@/lib/motion';
import { relativeAge, timeOfDayGreeting } from '@/lib/dates';
import type { Museum } from '@/types';
import './Entrance.css';

const HAS_VISITED = 'museum:hasVisited';

function readHasVisited(): boolean {
  try { return localStorage.getItem(HAS_VISITED) === '1'; } catch { return false; }
}
function writeHasVisited() {
  try { localStorage.setItem(HAS_VISITED, '1'); } catch { /* private window */ }
}

export function Entrance() {
  const navigate = useNavigate();
  const enter = useMuseumStore((s) => s.enter);
  const createOwnMuseum = useMuseumStore((s) => s.createOwnMuseum);
  const active = useMuseumStore((s) => s.active);
  const museums = useMuseumStore((s) => s.museums);
  const ownMuseums = museums.filter((m) => m.kind === 'own');
  const demo = museums.find((m) => m.id === DEMO_MUSEUM_ID) ?? null;
  const say = useUiStore((s) => s.say);

  const [firstVisit] = useState(() => !readHasVisited());
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState('');
  const [visitor, setVisitor] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { writeHasVisited(); }, []);

  const reduced = prefersReducedMotion();
  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 1.1, delay: reduced ? 0 : (firstVisit ? 0.5 : 0.1) + i * 0.16, ease: EASE_OUT_QUINT },
  });

  const open = async (m: Museum) => {
    setBusy(true);
    try {
      await enter(m.id);
      say(m.kind === 'demo' ? "You are walking through Alex's museum. Alex is fictional. Touch anything." : `Welcome back to ${m.name}.`, undefined, { quiet: true });
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const build = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const m = await createOwnMuseum(name, visitor);
      await enter(m.id);
      say('The doors are yours now. Nothing leaves this browser.');
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const returning = ownMuseums.length > 0 || active !== null;
  const primary = active ?? ownMuseums[0] ?? null;
  const others = [...ownMuseums.filter((m) => m.id !== primary?.id)];

  return (
    <div className="entrance">
      <StarField className="entrance__sky" seed="entrance" density={0.8} />
      <div className="entrance__horizon" aria-hidden="true" />

      <div className="entrance__stage">
        <motion.p className="plaque entrance__eyebrow" {...stagger(0)}>
          {returning ? timeOfDayGreeting() : 'Est. in this browser · No account · No cloud'}
        </motion.p>

        <motion.h1 className="entrance__title" {...stagger(1)}>
          The Museum <em>of</em> My Mind
        </motion.h1>

        <motion.p className="entrance__lede" {...stagger(2)}>
          {returning && primary
            ? <>Your museum is where you left it{primary.lastEnteredAt ? `, ${relativeAge(primary.lastEnteredAt)}` : ''}.</>
            : <>A private collection of goals, ideas, notes, and half-finished things, kept as rooms you can walk through.</>}
        </motion.p>

        <motion.div className={`entrance__doors ${returning ? 'entrance__doors--returning' : ''}`} {...stagger(3)}>
          {returning && primary && (
            <Doorway
              emphasis
              eyebrow={primary.kind === 'demo' ? 'Return to the demo' : 'Return'}
              title={primary.name}
              description={primary.visitorName ? `Kept by ${primary.visitorName}.` : 'Your collection, exactly as you left it.'}
              footnote={`Last entered ${relativeAge(primary.lastEnteredAt)}`}
              onOpen={() => void open(primary)}
            />
          )}

          {demo && primary?.id !== demo.id && (
            <Doorway
              eyebrow="Visit the demo"
              title={demo.name}
              description={<>Alex has a full-time job and is making slow, real progress on health, a side project, creativity, and the people they love. Alex is fictional. Everything in these rooms is possible in yours.</>}
              footnote="A 5K plan · a budget app · photo walks · Sunday calls home"
              onOpen={() => void open(demo)}
            />
          )}

          {!building ? (
            <Doorway
              eyebrow={returning ? 'Begin another museum' : 'Build your own'}
              title={returning ? 'A separate collection' : 'An empty museum'}
              description={<>{returning ? 'A second museum with its own rooms, kept apart from the others.' : 'Begins with nothing on the walls.'} Lives only on this device. You can export it whole, any time, as one file.</>}
              footnote="No login · works offline · yours to keep"
              onOpen={() => setBuilding(true)}
            />
          ) : (
            <Doorway as="div" eyebrow={returning ? 'A separate collection' : 'Build your own'} title="Name the museum" description={<>You can rename it later. The keeper's name is optional and appears only on the plaques.</>}>
              <form className="entrance__form" onSubmit={build}>
                <label className="entrance__field">
                  <span className="plaque">Museum name</span>
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="The North Wing" maxLength={80} />
                </label>
                <label className="entrance__field">
                  <span className="plaque">Keeper (optional)</span>
                  <input value={visitor} onChange={(e) => setVisitor(e.target.value)} placeholder="Your name" maxLength={80} />
                </label>
                <div className="entrance__form-actions">
                  <Instrument tone="primary" type="submit" disabled={busy}>Open the doors</Instrument>
                  <Instrument tone="quiet" type="button" onClick={() => setBuilding(false)}>Not yet</Instrument>
                </div>
              </form>
            </Doorway>
          )}
        </motion.div>

        {others.length > 0 && (
          <motion.div className="entrance__others" {...stagger(4)}>
            <span className="plaque">Other museums</span>
            <ul>
              {others.map((m) => (
                <li key={m.id}>
                  <button type="button" className="entrance__other" onClick={() => void open(m)}>
                    <span className="display">{m.name}</span>
                    <span className="entrance__other-age">{relativeAge(m.lastEnteredAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      <motion.p className="entrance__foot" {...stagger(5)}>
        Everything stays in this browser. Export a backup whenever you like.
      </motion.p>
    </div>
  );
}
