import { useState, type ReactNode } from "react";

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`library-section__chevron${open ? " library-section__chevron--open" : ""}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LibrarySection({
  sectionId,
  title,
  defaultOpen = false,
  headerExtra,
  className,
  children,
}: {
  sectionId: string;
  title: string;
  defaultOpen?: boolean;
  headerExtra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${sectionId}-panel`;
  const headingId = `${sectionId}-heading`;
  return (
    <div className={`card library-section${className ? ` ${className}` : ""}`}>
      <div className="library-section__head">
        <button
          type="button"
          className="library-section__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          id={headingId}
          onClick={() => setOpen((v) => !v)}
        >
          <SectionChevron open={open} />
          <span className="library-section__title">{title}</span>
        </button>
        {headerExtra ? <div className="library-section__extra">{headerExtra}</div> : null}
      </div>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={headingId} className="library-section__body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
