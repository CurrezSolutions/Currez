import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { updateDoctorProfile } from '../../firebase/users'
import { useAuth } from '../../contexts/AuthContext'
import { renderMarkdown } from '../../utils/renderMarkdown'
import { validators } from '../../utils/validations'
import { useFormValidation } from '../../hooks/useFormValidation'
import NavIcon from '../../components/common/NavIcon'

const MD_BUTTONS = [
  { label: 'B', title: 'Bold', before: '**', after: '**' },
  { label: 'I', title: 'Italic', before: '*', after: '*' },
  { label: 'H1', title: 'Heading 1', before: '# ', after: '', block: true },
  { label: 'H2', title: 'Heading 2', before: '## ', after: '', block: true },
  { label: 'H3', title: 'Heading 3', before: '### ', after: '', block: true },
  { label: '\u2022', title: 'Bullet list', before: '- ', after: '', block: true },
  { label: '1.', title: 'Numbered list', before: '1. ', after: '', block: true },
  { label: '\u201C', title: 'Quote', before: '> ', after: '', block: true },
  { label: '\u2014', title: 'Divider', before: '\n---\n', after: '', block: true },
]

function DoctorProfileEditor() {
  const { user, userDoc } = useAuth()
  const location = useLocation()
  const textareaRef = useRef(null)

  const [displayName, setDisplayName] = useState(userDoc?.displayName || '')
  const [specialization, setSpecialization] = useState(userDoc?.specialization || '')
  const [department, setDepartment] = useState(userDoc?.department || '')
  const [about, setAbout] = useState(userDoc?.about || '')
  const [yearsOfExperience, setYearsOfExperience] = useState(userDoc?.yearsOfExperience ?? '')
  const [consultationFee, setConsultationFee] = useState(userDoc?.consultationFee ?? '')
  const [languages, setLanguages] = useState((userDoc?.languages || []).join(', '))
  const [credentials, setCredentials] = useState(userDoc?.credentials || [])
  const [photoUrl, setPhotoUrl] = useState(userDoc?.photoUrl || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editorTab, setEditorTab] = useState('write') // 'write' | 'preview'
  const [sectionTab, setSectionTab] = useState('basic') // 'basic' | 'about' | 'credentials'
  const { errors, validate, clearFieldError } = useFormValidation({
    photoUrl: [validators.url('Enter a valid image URL (http/https).')],
  })

  function insertMarkdown(btn) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = about.substring(start, end)

    let newText
    if (btn.block) {
      const lineStart = about.lastIndexOf('\n', start - 1) + 1
      newText = about.substring(0, lineStart) + btn.before + about.substring(lineStart)
    } else {
      const replacement = selected ? `${btn.before}${selected}${btn.after}` : `${btn.before}text${btn.after}`
      newText = about.substring(0, start) + replacement + about.substring(end)
    }
    setAbout(newText)
    setEditorTab('write')
    setTimeout(() => {
      ta.focus()
      const pos = start + btn.before.length + (selected || 'text').length
      ta.setSelectionRange(pos, pos)
    }, 0)
  }

  function addCredential() {
    setCredentials([...credentials, { degree: '', institution: '', year: '' }])
  }

  function updateCredential(index, field, value) {
    setCredentials(credentials.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  function removeCredential(index) {
    setCredentials(credentials.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError('')
    setSaved(false)
    if (!validate({ photoUrl })) return
    setSaving(true)
    try {
      await updateDoctorProfile(user.uid, {
        displayName,
        specialization,
        department,
        about,
        photoUrl: photoUrl.trim(),
        yearsOfExperience: yearsOfExperience !== '' ? Math.max(0, Number(yearsOfExperience)) : null,
        consultationFee: consultationFee !== '' ? Math.max(0, Number(consultationFee)) : null,
        languages: languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        credentials: credentials.filter((c) => c.degree.trim() !== ''),
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-heading focus:border-line-strong focus:outline-none'
  const labelCls = 'block text-sm font-medium text-body'

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-heading">My Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Manage how patients see your profile on the hospital's public page.
      </p>

      {/* ── Section Tabs ────────────────────────────── */}
      <div className="mt-6 flex gap-1 rounded-xl border border-line bg-card p-1">
        {[
          { key: 'basic', label: 'Basic Info', icon: 'profile' },
          { key: 'about', label: 'About & Bio', icon: 'chat' },
          { key: 'credentials', label: 'Credentials', icon: 'clipboard' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSectionTab(tab.key)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              sectionTab === tab.key
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                : 'text-muted hover:bg-card-strong hover:text-heading'
            }`}
          >
            <NavIcon name={tab.icon} className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Basic Info ──────────────────────────────── */}
      {sectionTab === 'basic' && (
        <div className="mt-6 rounded-2xl border border-line bg-card p-6 animate-fade-in-up">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div>
                <label className={labelCls}>Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="Cardiology"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="Internal Medicine"
                />
              </div>
              <div>
                <label className={labelCls}>Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Consultation Fee (\u20B9)</label>
                <input
                  type="number"
                  min="0"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="500"
                />
              </div>
              <div>
                <label className={labelCls}>Languages (comma separated)</label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className={`mt-1 ${inputCls}`}
                  placeholder="English, Hindi, Marathi"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Photo URL</label>
              <div className="mt-1 flex items-center gap-3">
                {photoUrl && !errors.photoUrl ? (
                  <img src={photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card-strong text-xs font-bold text-faint">
                    {(displayName || '?')[0]?.toUpperCase()}
                  </span>
                )}
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => { setPhotoUrl(e.target.value); clearFieldError('photoUrl') }}
                  className={inputCls}
                  placeholder="https://example.com/your-photo.jpg"
                />
              </div>
              <p className="mt-1.5 text-xs text-faint">
                Shown on your public profile and the hospital's doctor listing instead of your initials. Leave blank to
                keep the initials.
              </p>
              {errors.photoUrl && <p className="mt-1 text-xs text-red-500">{errors.photoUrl}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── About / Bio (Markdown Editor) ───────────── */}
      {sectionTab === 'about' && (
        <div className="mt-6 rounded-2xl border border-line bg-card animate-fade-in-up">
          {/* toolbar + tabs */}
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <div className="flex items-center gap-1">
              {MD_BUTTONS.map((btn) => (
                <button
                  key={btn.title}
                  onClick={() => insertMarkdown(btn)}
                  title={btn.title}
                  className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-card-strong hover:text-heading"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg border border-line p-0.5">
              {['write', 'preview'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEditorTab(tab)}
                  className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    editorTab === tab
                      ? 'bg-card-strong text-heading'
                      : 'text-muted hover:text-body'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* editor / preview */}
          <div className="min-h-[260px]">
            {editorTab === 'write' ? (
              <textarea
                ref={textareaRef}
                rows={12}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full resize-y bg-transparent p-4 font-mono text-sm text-heading focus:outline-none"
                placeholder="Write about yourself using **markdown**...&#10;&#10;## My Approach&#10;I believe in patient-centered care...&#10;&#10;**Special interests:**&#10;- Preventive cardiology&#10;- Heart failure management"
              />
            ) : (
              <div
                className="p-4 text-sm leading-relaxed text-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(about) || '<p class="text-faint">Nothing to preview.</p>' }}
              />
            )}
          </div>

          <div className="border-t border-line px-4 py-2">
            <p className="text-xs text-faint">Supports **bold**, *italic*, headings, lists, blockquotes, and [links](url).</p>
          </div>
        </div>
      )}

      {/* ── Credentials ─────────────────────────────── */}
      {sectionTab === 'credentials' && (
        <div className="mt-6 animate-fade-in-up space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-heading">Academic Credentials</h2>
              <p className="mt-0.5 text-xs text-faint">Add your degrees, diplomas and certifications.</p>
            </div>
            <button
              onClick={addCredential}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            >
              <span className="text-base leading-none">+</span> Add Credential
            </button>
          </div>

          {credentials.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-card-strong">
                <NavIcon name="clipboard" className="h-5 w-5 text-faint" />
              </span>
              <p className="mt-3 text-sm font-medium text-heading">No credentials yet</p>
              <p className="mt-1 text-xs text-faint">Add your academic qualifications so patients can see your background.</p>
              <button
                onClick={addCredential}
                className="mt-4 cursor-pointer rounded-lg border border-line px-4 py-2 text-xs font-medium text-body transition-colors hover:bg-card-strong hover:text-heading"
              >
                + Add your first credential
              </button>
            </div>
          )}

          {credentials.map((cred, i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-line bg-card p-5 transition-all hover:border-line-strong"
            >
              {/* card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: 'var(--color-body)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-heading">
                    {cred.degree || cred.institution ? `${cred.degree || '...'}${cred.institution ? ` — ${cred.institution}` : ''}` : `Credential ${i + 1}`}
                  </span>
                </div>
                <button
                  onClick={() => removeCredential(i)}
                  className="cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Remove credential"
                >
                  <NavIcon name="close" className="h-4 w-4" />
                </button>
              </div>

              {/* fields */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-muted">Degree / Qualification</label>
                  <input
                    type="text"
                    value={cred.degree}
                    onChange={(e) => updateCredential(i, 'degree', e.target.value)}
                    placeholder="e.g. MD, MBBS, DM, Fellowship"
                    className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-heading placeholder:text-faint focus:border-line-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">Institution / University</label>
                  <input
                    type="text"
                    value={cred.institution}
                    onChange={(e) => updateCredential(i, 'institution', e.target.value)}
                    placeholder="e.g. AIIMS, JIPMER"
                    className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-heading placeholder:text-faint focus:border-line-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">Year</label>
                  <input
                    type="text"
                    value={cred.year}
                    onChange={(e) => updateCredential(i, 'year', e.target.value)}
                    placeholder="e.g. 2015"
                    className="mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-heading placeholder:text-faint focus:border-line-strong focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          {credentials.length > 0 && (
            <button
              onClick={addCredential}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:bg-card-strong hover:text-heading"
            >
              <span className="text-base leading-none">+</span> Add another credential
            </button>
          )}
        </div>
      )}

      {/* ── Save Bar ────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        {saved && <span className="text-sm font-medium text-emerald-500">Saved successfully.</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <Link
          to={{ pathname: '/', search: location.search }}
          className="text-sm text-muted hover:text-heading"
        >
          &larr; Back to dashboard
        </Link>
      </div>
    </div>
  )
}

export default DoctorProfileEditor
