import { ChevronRight } from '@untitledui/icons';

export interface Crumb {
  label: string;
  /** Omit for a crumb that is not a page. */ onPress?(): void;
}
/** Breadcrumb trail; the last crumb is the current page. (Untitled UI's Breadcrumbs is PRO, so this is a plain nav.) */
export function DetailBreadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-semibold">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 text-fg-quaternary" />}
            {last ? (
              <span aria-current="page" className="rounded-md bg-primary_hover px-2 py-1 text-tertiary">
                {c.label}
              </span>
            ) : c.onPress ? (
              <button
                type="button"
                onClick={c.onPress}
                className="cursor-pointer rounded-md px-2 py-1 text-tertiary hover:bg-primary_hover hover:text-secondary"
              >
                {c.label}
              </button>
            ) : (
              <span className="px-2 py-1 text-quaternary">{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
