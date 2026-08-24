import type { SVGProps } from 'react'

type IconName = 'upload' | 'play' | 'pause' | 'rewind' | 'forward' | 'search' | 'download' | 'shield' | 'chip' | 'edit' | 'close' | 'folder' | 'info' | 'back' | 'settings' | 'refresh' | 'check' | 'table' | 'analysis' | 'user' | 'logout' | 'trash'

const paths: Record<IconName, React.ReactNode> = {
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
  play: <path d="m8 5 11 7-11 7Z"/>,
  pause: <><path d="M8 5v14"/><path d="M16 5v14"/></>,
  rewind: <><path d="m11 7-5 5 5 5"/><path d="M18 7v10"/></>,
  forward: <><path d="m13 7 5 5-5 5"/><path d="M6 7v10"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
  download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
  shield: <path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6Z"/>,
  chip: <><rect x="7" y="7" width="10" height="10"/><path d="M9 2v5m6-5v5M9 17v5m6-5v5M2 9h5m-5 6h5m10-6h5m-5 6h5"/></>,
  edit: <><path d="m5 19 3.5-.7L19 7.8 16.2 5 5.7 15.5Z"/><path d="m14.8 6.4 2.8 2.8"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  folder: <path d="M3 6h7l2 2h9v11H3Z"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  back: <><path d="m10 6-6 6 6 6"/><path d="M5 12h15"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.5 6A7 7 0 0 0 9 7L6.6 6 4.7 9.5l2 1.5a7 7 0 0 0 0 2l-2 1.5L6.6 18 9 17a7 7 0 0 0 1.5 1l.2 2.6h4L15 18a7 7 0 0 0 1.5-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M18.5 16a8 8 0 1 1 .7-7.6L20 12"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  table: <><rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M8 4v16"/></>,
  analysis: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/><path d="M3 21h18"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.5 3.5-7 8-7s7.2 2.5 8 7"/></>,
  logout: <><path d="M14 5H5v14h9"/><path d="m15 8 4 4-4 4m4-4H9"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/><path d="M10 11v6m4-6v6"/></>,
}

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...props}>{paths[name]}</svg>
}
