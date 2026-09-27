import React, { useEffect, useState } from 'react';
import { soundManager } from '../utils/audio';

interface CountdownOverlayProps {
  onComplete: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ onComplete }) => {
  const [count, setCount] = useState<number | 'GO'>(3);

  useEffect(() => {
    soundManager.playTick();

    const t1 = setTimeout(() => {
      setCount(2);
      soundManager.playTick();
    }, 700);

    const t2 = setTimeout(() => {
      setCount(1);
      soundManager.playTick();
    }, 1400);

    const t3 = setTimeout(() => {
      setCount('GO');
      soundManager.playGo();
    }, 2100);

    const t4 = setTimeout(() => {
      onComplete();
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center select-none">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold mb-2">
          Get Ready
        </p>
        <div
          key={String(count)}
          className={`font-black tracking-tighter animate-in zoom-in-75 duration-200 ${
            count === 'GO' ? 'text-7xl text-emerald-400' : 'text-8xl text-white'
          }`}
        >
          {count}
        </div>
        <p className="text-xs text-slate-400 mt-4 font-medium">
          Remember: Tap the <span className="text-white font-bold underline">COLOUR</span> of the text!
        </p>
      </div>
    </div>
  );
};
