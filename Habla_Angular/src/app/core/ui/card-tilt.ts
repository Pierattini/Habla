// Inclinación 3D de las tarjetas siguiendo el mouse (solo computador).
// Un único listener para toda la app: no hay que tocar cada pantalla.
// No se activa en pantallas táctiles ni si el sistema pide "reducir movimiento".

const TILT_SELECTOR = [
  '.professional-card',
  '.metric-card',
  '.card-cita',
  '.option-card',
  '.role-card',
  '.service-card',
  '.quick-card',
].join(',');

// Grados máximos de inclinación: sutil, para que se sienta elegante y no maree.
const MAX_TILT_DEG = 7;

export function enableCardTilt(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reduceMotion) return () => {};

  let current: HTMLElement | null = null;
  let frame = 0;
  let lastEvent: PointerEvent | null = null;

  const reset = (element: HTMLElement) => {
    element.style.transition = 'transform 0.35s ease';
    element.style.transform = '';
    // Al terminar la vuelta se quita la transición propia para no interferir con otros estilos.
    window.setTimeout(() => {
      if (element !== current) element.style.transition = '';
    }, 360);
  };

  const apply = () => {
    frame = 0;
    const event = lastEvent;
    if (!event) return;

    const target = (event.target as Element | null)?.closest?.(TILT_SELECTOR) as HTMLElement | null;

    if (target !== current) {
      if (current) reset(current);
      current = target;
    }
    if (!current) return;

    const rect = current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // -0.5 .. 0.5 desde el centro de la tarjeta.
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    current.style.transition = 'transform 0.08s linear';
    current.style.transform =
      `perspective(900px) rotateX(${(-y * MAX_TILT_DEG * 2).toFixed(2)}deg) ` +
      `rotateY(${(x * MAX_TILT_DEG * 2).toFixed(2)}deg)`;
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    lastEvent = event;
    if (!frame) frame = window.requestAnimationFrame(apply);
  };

  const onLeaveWindow = () => {
    if (current) reset(current);
    current = null;
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeaveWindow);

  return () => {
    document.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
    if (frame) window.cancelAnimationFrame(frame);
    onLeaveWindow();
  };
}
