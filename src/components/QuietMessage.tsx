import { AnimatePresence, motion } from 'motion/react';
import { useUiStore } from '@/store/ui';
import { EASE_OUT_QUINT } from '@/lib/motion';
import './QuietMessage.css';

/** One quiet message at a time, bottom-left, that fades. */
export function QuietMessage() {
  const message = useUiStore((s) => s.message);
  return (
    <div className="quiet" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.p
            key={message.id}
            className="quiet__text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.36, ease: EASE_OUT_QUINT }}
          >
            {message.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
