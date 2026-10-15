import type { SVGProps } from 'react';

/** Node/canvas icons exported from the AtiFlow v4 Figma file (via the reference Workflow Builder). Fixed colours match the design. */
type P = SVGProps<SVGSVGElement> & { size?: number };

export const PlayIcon = ({ size: _s = 12, ...rest }: P) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...rest}><path fillRule="evenodd" clipRule="evenodd" d="M3.375 2.65726V9.34102L9.01442 5.99914L3.375 2.65726ZM2.625 2.52564C2.625 2.00261 3.19416 1.6783 3.64412 1.94494L9.50565 5.41845C9.94683 5.67989 9.94683 6.3184 9.50565 6.57984L3.64412 10.0533C3.19416 10.32 2.625 9.99567 2.625 9.47265V2.52564Z" fill="black"/></svg>
);

export const KeyframesIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M15.8189 13.3287L10.4948 19.3183C9.69924 20.2134 8.30076 20.2134 7.50518 19.3183L2.18109 13.3287C1.50752 12.571 1.50752 11.429 2.18109 10.6713L7.50518 4.68167C8.30076 3.78664 9.69924 3.78664 10.4948 4.68167L15.8189 10.6713C16.4925 11.429 16.4925 12.571 15.8189 13.3287Z" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6.375L13.5052 4.68167C14.3008 3.78664 15.6992 3.78664 16.4948 4.68167L21.8189 10.6713C22.4925 11.429 22.4925 12.571 21.8189 13.3287L16.4948 19.3183C15.6992 20.2134 14.3008 20.2134 13.5052 19.3183L12 17.625" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const BoxIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M10 12L14 12" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 3L21 3" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 7V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4V7" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const ClockIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M12 6L12 12L18 12" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21.8883 10.5C21.1645 5.68874 17.013 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C16.1006 22 19.6248 19.5318 21.1679 16" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 16H21.4C21.7314 16 22 16.2686 22 16.6V21" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const PinIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M20 10C20 14.4183 12 22 12 22C12 22 4 14.4183 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10Z" stroke="#262626" strokeWidth="1.5"/><path d="M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z" fill="#262626" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const BadgeIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path fillRule="evenodd" clipRule="evenodd" d="M9.96668 2.11906C11.0575 0.92125 12.9422 0.921252 14.0331 2.11906L15.0533 3.23929C15.3039 3.51446 15.6641 3.66365 16.0358 3.64627L17.5493 3.57554C19.1677 3.4999 20.5003 4.8326 20.4247 6.45092L20.354 7.96443C20.3366 8.3362 20.4858 8.69638 20.761 8.94697L21.8812 9.96717C23.079 11.058 23.079 12.9427 21.8812 14.0336L20.761 15.0538C20.4858 15.3044 20.3366 15.6645 20.354 16.0363L20.4247 17.5498C20.5003 19.1681 19.1677 20.5008 17.5493 20.4252L16.0358 20.3545C15.6641 20.3371 15.3039 20.4863 15.0533 20.7615L14.0331 21.8817C12.9422 23.0795 11.0575 23.0795 9.96668 21.8817L8.94648 20.7615C8.69589 20.4863 8.33571 20.3371 7.96394 20.3545L6.45043 20.4252C4.83211 20.5008 3.49942 19.1681 3.57505 17.5498L3.64578 16.0363C3.66316 15.6645 3.51397 15.3044 3.2388 15.0538L2.11857 14.0336C0.920762 12.9427 0.920764 11.058 2.11857 9.96717L3.2388 8.94697C3.51397 8.69638 3.66316 8.3362 3.64578 7.96443L3.57505 6.45092C3.49942 4.83259 4.83211 3.4999 6.45043 3.57554L7.96394 3.64627C8.33571 3.66365 8.69589 3.51446 8.94648 3.23929L9.96668 2.11906ZM12.9241 3.12905C12.4282 2.58459 11.5715 2.58459 11.0757 3.12905L10.0555 4.24928C9.50419 4.85464 8.71181 5.18286 7.89392 5.14464L6.38041 5.0739C5.6448 5.03952 5.03904 5.64529 5.07341 6.38089L5.14415 7.89441C5.18237 8.7123 4.85415 9.50468 4.24879 10.056L3.12856 11.0762C2.5841 11.572 2.5841 12.4287 3.12856 12.9246L4.24879 13.9448C4.85415 14.4961 5.18237 15.2884 5.14415 16.1063L5.07341 17.6199C5.03904 18.3555 5.6448 18.9612 6.3804 18.9268L7.89392 18.8561C8.71181 18.8179 9.50419 19.1461 10.0555 19.7515L11.0757 20.8717C11.5715 21.4162 12.4282 21.4162 12.9241 20.8717L13.9443 19.7515C14.4956 19.1461 15.288 18.8179 16.1058 18.8561L17.6194 18.9268C18.355 18.9612 18.9607 18.3555 18.9264 17.6199L18.8556 16.1063C18.8174 15.2884 19.1456 14.4961 19.751 13.9448L20.8712 12.9246C21.4157 12.4287 21.4157 11.572 20.8712 11.0762L19.751 10.056C19.1456 9.50468 18.8174 8.7123 18.8556 7.89441L18.9264 6.38089C18.9607 5.64529 18.355 5.03952 17.6194 5.0739L16.1058 5.14464C15.288 5.18286 14.4956 4.85464 13.9443 4.24928L12.9241 3.12905Z" fill="black"/><path fillRule="evenodd" clipRule="evenodd" d="M8.46978 11.4697C8.76268 11.1768 9.23755 11.1768 9.53044 11.4697L11.0001 12.9393L14.4698 9.46967C14.7627 9.17678 15.2376 9.17678 15.5304 9.46967C15.8233 9.76256 15.8233 10.2374 15.5304 10.5303L11.5304 14.5303C11.2376 14.8232 10.7627 14.8232 10.4698 14.5303L8.46978 12.5303C8.17689 12.2374 8.17689 11.7626 8.46978 11.4697Z" fill="black"/></svg>
);

export const SquareIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M21 3.6V20.4C21 20.7314 20.7314 21 20.4 21H3.6C3.26863 21 3 20.7314 3 20.4V3.6C3 3.26863 3.26863 3 3.6 3H20.4C20.7314 3 21 3.26863 21 3.6Z" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const AntennaIcon = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}><path d="M17.5 8C17.5 8 19 9.5 19 12C19 14.5 17.5 16 17.5 16" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.5 5C20.5 5 23 7.5 23 12C23 16.5 20.5 19 20.5 19" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 8C6.5 8 5 9.5 5 12C5 14.5 6.5 16 6.5 16" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 5C3.5 5 1 7.5 1 12C1 16.5 3.5 19 3.5 19" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" fill="#262626" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const ArrowIcon = ({ size: _size = 28, ...rest }: P) => (
  <svg width="28" height="14" viewBox="0 0 30 15" fill="none" aria-hidden="true" {...rest}><path d="M1 6.36328C0.447715 6.36328 0 6.811 0 7.36328C0 7.91557 0.447715 8.36328 1 8.36328V7.36328V6.36328ZM29.7071 8.07039C30.0976 7.67986 30.0976 7.0467 29.7071 6.65617L23.3431 0.292213C22.9526 -0.0983109 22.3195 -0.0983109 21.9289 0.292213C21.5384 0.682738 21.5384 1.3159 21.9289 1.70643L27.5858 7.36328L21.9289 13.0201C21.5384 13.4107 21.5384 14.0438 21.9289 14.4343C22.3195 14.8249 22.9526 14.8249 23.3431 14.4343L29.7071 8.07039ZM1 7.36328V8.36328H29V7.36328V6.36328H1V7.36328Z" fill="#1AB2A7"/></svg>
);

export const XmarkIcon = ({ size: _s = 12, ...rest }: P) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...rest}><path fillRule="evenodd" clipRule="evenodd" d="M4.32049 4.32062C4.46694 4.17417 4.70438 4.17417 4.85082 4.32062L5.99987 5.46967L7.14892 4.32062C7.29537 4.17417 7.5328 4.17417 7.67925 4.32062C7.8257 4.46707 7.8257 4.70451 7.67925 4.85095L6.5302 6L7.67925 7.14905C7.8257 7.29549 7.8257 7.53293 7.67925 7.67938C7.5328 7.82583 7.29537 7.82583 7.14892 7.67938L5.99987 6.53033L4.85082 7.67938C4.70438 7.82583 4.46694 7.82583 4.32049 7.67938C4.17405 7.53293 4.17405 7.2955 4.32049 7.14905L5.46954 6L4.32049 4.85095C4.17405 4.7045 4.17405 4.46707 4.32049 4.32062Z" fill="black"/><path fillRule="evenodd" clipRule="evenodd" d="M6 1.375C3.44568 1.375 1.375 3.44568 1.375 6C1.375 8.55432 3.44568 10.625 6 10.625C8.55432 10.625 10.625 8.55432 10.625 6C10.625 3.44568 8.55432 1.375 6 1.375ZM0.625 6C0.625 3.03147 3.03147 0.625 6 0.625C8.96853 0.625 11.375 3.03147 11.375 6C11.375 8.96853 8.96853 11.375 6 11.375C3.03147 11.375 0.625 8.96853 0.625 6Z" fill="black"/></svg>
);

export const Menu12Icon = ({ size = 12, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" {...rest}><path fillRule="evenodd" clipRule="evenodd" d="M1.125 2.5C1.125 2.29289 1.29289 2.125 1.5 2.125H10.5C10.7071 2.125 10.875 2.29289 10.875 2.5C10.875 2.70711 10.7071 2.875 10.5 2.875H1.5C1.29289 2.875 1.125 2.70711 1.125 2.5Z" fill="black"/><path fillRule="evenodd" clipRule="evenodd" d="M1.125 6C1.125 5.79289 1.29289 5.625 1.5 5.625H10.5C10.7071 5.625 10.875 5.79289 10.875 6C10.875 6.20711 10.7071 6.375 10.5 6.375H1.5C1.29289 6.375 1.125 6.20711 1.125 6Z" fill="black"/><path fillRule="evenodd" clipRule="evenodd" d="M1.125 9.5C1.125 9.29289 1.29289 9.125 1.5 9.125H10.5C10.7071 9.125 10.875 9.29289 10.875 9.5C10.875 9.70711 10.7071 9.875 10.5 9.875H1.5C1.29289 9.875 1.125 9.70711 1.125 9.5Z" fill="black"/></svg>
);

export const CheckIcon = ({ size: _size = 10, ...rest }: P) => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" {...rest}><path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const Plus16Icon = ({ size: _size = 16, ...rest }: P) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...rest}><path d="M7.99992 3.33398V12.6673M3.33325 8.00065H12.6666" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const Plus20Icon = ({ size: _size = 20, ...rest }: P) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...rest}><path d="M10.0001 4.16602V15.8327M4.16675 9.99935H15.8334" stroke="#A3A3A3" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const OkIcon = ({ size: _size = 16, ...rest }: P) => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" {...rest}><path d="M6.25008 9.99935L8.75008 12.4993L13.7501 7.49935M18.3334 9.99935C18.3334 14.6017 14.6025 18.3327 10.0001 18.3327C5.39771 18.3327 1.66675 14.6017 1.66675 9.99935C1.66675 5.39698 5.39771 1.66602 10.0001 1.66602C14.6025 1.66602 18.3334 5.39698 18.3334 9.99935Z" stroke="#4DC3BA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export const ErrIcon = ({ size: _size = 16, ...rest }: P) => (
  <svg width="16" height="16" viewBox="0 0 12 12" fill="none" {...rest}><path fillRule="evenodd" clipRule="evenodd" d="M4.32049 4.32062C4.46694 4.17417 4.70438 4.17417 4.85082 4.32062L5.99987 5.46967L7.14892 4.32062C7.29537 4.17417 7.5328 4.17417 7.67925 4.32062C7.8257 4.46707 7.8257 4.70451 7.67925 4.85095L6.5302 6L7.67925 7.14905C7.8257 7.29549 7.8257 7.53293 7.67925 7.67938C7.5328 7.82583 7.29537 7.82583 7.14892 7.67938L5.99987 6.53033L4.85082 7.67938C4.70438 7.82583 4.46694 7.82583 4.32049 7.67938C4.17405 7.53293 4.17405 7.2955 4.32049 7.14905L5.46954 6L4.32049 4.85095C4.17405 4.7045 4.17405 4.46707 4.32049 4.32062Z" fill="#DC2626"/><path fillRule="evenodd" clipRule="evenodd" d="M6 1.375C3.44568 1.375 1.375 3.44568 1.375 6C1.375 8.55432 3.44568 10.625 6 10.625C8.55432 10.625 10.625 8.55432 10.625 6C10.625 3.44568 8.55432 1.375 6 1.375ZM0.625 6C0.625 3.03147 3.03147 0.625 6 0.625C8.96853 0.625 11.375 3.03147 11.375 6C11.375 8.96853 8.96853 11.375 6 11.375C3.03147 11.375 0.625 8.96853 0.625 6Z" fill="#DC2626"/></svg>
);
