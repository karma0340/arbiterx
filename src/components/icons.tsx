import type { SVGProps } from 'react';

export const Icons = {
  logo: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
       <path d="M17 10L7 15" />
    </svg>
  ),
  soccer: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 0-3.38 19.4" />
      <path d="M12 2a10 10 0 0 1 3.38 19.4" />
      <path d="M2.6 10H8" />
      <path d="M16 10h5.4" />
      <path d="M4.2 17.8L9 15" />
      <path d="M15 15l4.8 2.8" />
      <path d="M4.2 6.2L9 9" />
      <path d="M15 9l4.8-2.8" />
    </svg>
  ),
};
