/**
 * The size of the cards operators pick from (a material to request, a trip to book): the same height and the same grid columns, so the Request Material and Book Trips tabs feel
 * like one page. A material card may grow beyond it when its content needs more room (a cart line adds buttons); a trip card is exactly this tall.
 */
export const OPERATOR_CARD_MIN_H = 'min-h-[256px]';
export const OPERATOR_CARD_H = 'h-[256px]';
export const OPERATOR_CARD_GRID = '[grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]';
