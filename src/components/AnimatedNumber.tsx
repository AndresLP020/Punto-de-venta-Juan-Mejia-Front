'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

/**
 * Muestra un número que "cuenta" desde 0 hasta `value` con animación.
 * Solo visual: no altera el valor recibido.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 1.2,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const mv = useMotionValue(0);
  const texto = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toLocaleString('en-US')));

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: 'easeOut' });
    return controls.stop;
  }, [value, duration, mv]);

  return <motion.span>{texto}</motion.span>;
}
