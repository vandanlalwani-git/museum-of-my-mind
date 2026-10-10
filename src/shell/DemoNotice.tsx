import { useNavigate } from 'react-router-dom';
import { useMind } from '@/mind/store';

/** While looking around Alex's museum, the way to your own is always one tap away. */
export function DemoNotice() {
  const mind = useMind((s) => s.mind);
  const hasOwn = useMind((s) => s.minds.some((m) => m.kind === 'own'));
  const leave = useMind((s) => s.leave);
  const enter = useMind((s) => s.enter);
  const ownId = useMind((s) => [...s.minds].filter((m) => m.kind === 'own').sort((a, b) => b.lastEnteredAt - a.lastEnteredAt)[0]?.id);
  const navigate = useNavigate();
  if (mind?.kind !== 'demo') return null;
  const go = async () => {
    if (hasOwn && ownId) { await enter(ownId); navigate('/'); return; }
    await leave();
    navigate('/tour#begin');
  };
  return (
    <div className="demonotice">
      <span className="demonotice__text">Alex’s museum is a made-up example</span>
      <button type="button" className="demonotice__btn" onClick={() => void go()}>{hasOwn ? 'Back to my museum' : 'Make my own'}</button>
    </div>
  );
}
