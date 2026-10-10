import { Link } from 'react-router-dom';

/** A short-lived stand-in while the next phase is built. */
export default function Soon({ title, note }: { title: string; note: string }) {
  return (
    <div className="place plate">
      <p className="place__eyebrow">Arriving in the next update</p>
      <h1 className="place__title">{title}</h1>
      <p className="place__lede">{note}</p>
      <Link to="/" className="instrument">Back to the sky</Link>
    </div>
  );
}
