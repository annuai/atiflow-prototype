/**
 * After a submit that found problems: moves focus to the first field marked invalid, in the open dialog if there is one, otherwise on the page, so a keyboard or screen-reader user lands
 * on the problem instead of hunting for it. It waits until the errors have been drawn (the field is only marked invalid after the re-render).
 */
export function focusFirstError() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document;
      scope.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }),
  );
}
