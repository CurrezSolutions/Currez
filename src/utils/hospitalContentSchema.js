// Field schema for each editable content section on a hospital's public
// landing page. Drives the generic ContentSectionEditor so services,
// departments and testimonials share one implementation instead of near-
// identical editors. Doctors is special-cased (`noItems: true`) — that
// section is populated from real doctor staff accounts (Staff page), not
// manually-entered items, so only its visibility/order is editable here.
export const CONTENT_SECTIONS = [
  {
    key: 'services',
    label: 'Services',
    fields: [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
      { name: 'icon', label: 'Icon (emoji)', type: 'text' },
    ],
  },
  {
    key: 'departments',
    label: 'Departments',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
    ],
  },
  {
    key: 'doctors',
    label: 'Doctors',
    fields: [],
    noItems: true,
  },
  {
    key: 'testimonials',
    label: 'Testimonials',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'message', label: 'Message', type: 'text' },
      { name: 'rating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5 },
    ],
  },
]
