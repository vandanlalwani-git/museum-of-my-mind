import { Link } from 'react-router-dom';
import { StarField } from '@/components/StarField';
import { Join } from '../settings/Devices';
import '@/components/Field.css';
import '@/components/Instrument.css';
import '@/shell/shell.css';
import '../settings/settings.css';
import '../welcome/welcome.css';

/** A new device joins a museum that already lives on another one. */
export default function JoinPage() {
  return (
    <div className="welcome">
      <StarField seed="join" density={1.1} className="welcome__sky" />
      <div className="welcome__inner">
        <header className="welcome__head">
          <p className="welcome__over">The Museum of My Mind</p>
          <h1 className="welcome__title">Join from <em>another device</em></h1>
          <p className="welcome__lede">On the device that has your museum, open Settings, Your devices, and turn on sync. Then scan its code here, or type it.</p>
        </header>
        <section className="welcome__card plate">
          <Join onDone={() => undefined} />
          <Link to="/welcome" className="linkish">Back</Link>
        </section>
      </div>
    </div>
  );
}
