export const validators = {
  required: (msg) => (value) =>
    value === undefined || value === null || String(value).trim() === '' ? msg : undefined,

  email: (msg) => (value) =>
    value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? msg : undefined,

  phone: (msg) => (value) =>
    value && !/^\+?\d{7,15}$/.test(value.replace(/[\s-]/g, '')) ? msg : undefined,

  minLength: (min, msg) => (value) =>
    value && String(value).trim().length < min ? msg : undefined,

  maxLength: (max, msg) => (value) =>
    value && String(value).length > max ? msg : undefined,

  pattern: (regex, msg) => (value) =>
    value && !regex.test(value) ? msg : undefined,

  slug: (msg) => (value) =>
    value && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? msg : undefined,

  url: (msg) => (value) => {
    if (!value) return undefined
    try {
      const parsed = new URL(value)
      // http(s) only — new URL() alone accepts any scheme, including
      // javascript:/data:, which would parse "successfully" here and pass
      // straight through to an <img src>/CSS url()/background-image.
      return ['http:', 'https:'].includes(parsed.protocol) ? undefined : msg
    } catch {
      return msg
    }
  },

  number: (msg) => (value) =>
    value && (isNaN(Number(value)) || Number(value) < 0) ? msg : undefined,
}
