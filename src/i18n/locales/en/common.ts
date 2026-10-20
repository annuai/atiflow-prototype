/** Words and phrases used on many screens. Use these instead of repeating "Cancel" in every feature. */
export const common = {
  cancel: 'Cancel',
  save: 'Save',
  saveChanges: 'Save changes',
  delete: 'Delete',
  remove: 'Remove',
  edit: 'Edit',
  add: 'Add',
  close: 'Close',
  back: 'Back',
  forward: 'Forward',
  search: 'Search',
  tryAgain: 'Try again',
  required: 'Required',
  comingSoon: 'Coming soon',
  language: 'Language',
  noWebgl: {
    title: '3D view is not available in this browser',
    body: 'Your browser or graphics driver does not offer WebGL 2, which the 3D views need. Turn on hardware acceleration in the browser settings, update the browser, or open Ati Flow in a current Chrome, Edge, Firefox or Safari.',
  },
  unsaved: {
    title: 'Leave without saving?',
    body: 'You have changes that are not saved. If you leave now they are lost.',
    keep: 'Keep editing',
    discard: 'Discard changes',
  },
} as const;
