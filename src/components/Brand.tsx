type BrandProps = {
  href: string
  className?: string
  label?: string
}

export function BrandMark() {
  return <span className="brand-cell" aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false">
      <path fillRule="evenodd" d="M3 10h5V7h4v3h3V5h4v5h3V7h4v3h3v6H19v13h-6V16H3v-6Zm4 2v2h2v-2H7Zm16 0v2h2v-2h-2Z"/>
    </svg>
  </span>
}

export function Brand({ href, className = '', label = 'Transkrip' }: BrandProps) {
  return <a className={`brand${className ? ` ${className}` : ''}`} href={href} aria-label={label}>
    <BrandMark/><strong>transkrip</strong>
  </a>
}
