import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/** Highest history position reached so far: positions above the current one are what "Forward" can still reach. Survives page changes (module level). */
let furthest = 0;

/**
 * Back / Forward for the top bar, on top of the router's own history (so it behaves exactly like the browser buttons).
 * react-router stores each entry's position in `history.state.idx`; a push cuts off everything after it, a back/forward (POP) does not.
 */
export function useHistoryNav() {
  const navigate = useNavigate();
  const type = useNavigationType();
  useLocation(); // re-evaluate on every navigation
  const idx: number = window.history.state?.idx ?? 0;
  if (type === 'PUSH') furthest = idx;
  else furthest = Math.max(furthest, idx);
  return { canBack: idx > 0, canForward: idx < furthest, back: () => navigate(-1), forward: () => navigate(1) };
}
