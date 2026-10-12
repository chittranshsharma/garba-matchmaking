import React, { useEffect, useState } from 'react'
import { age, AREAS, GENDERS, photoUrl, PROMPTS, resizePhoto, supabase, type Area, type Gender, type Profile, type PromptAnswer } from './lib'
import MotionScene from './MotionScene'
import PhotoCropper from './PhotoCropper'

type Props = { userId: string, initial?: Profile, onSaved: (profile: Profile) => void, onSignOut: () => void, onDelete?: () => Promise<void> }

const steps = [
  { label: 'The introduction', title: 'What should we call you?', hint: 'Start with your first name or whatever you like to go by.', scene: 'Every great circle starts with a hello.' },
  { label: 'The essentials', title: 'When is your birthday?', hint: 'Only your age will be shown. You need to be 18 or older.', scene: 'Good connections start with the little things.' },
  { label: 'The essentials', title: 'How do you identify?', hint: 'Pick the one that feels right for you.', scene: 'Show up as your whole self.' },
  { label: 'The essentials', title: 'Where in Delhi NCR?', hint: 'Your area helps you find people nearby.', scene: 'Your next garba person could be close.' },
  { label: 'Your circle', title: 'Who would you like to meet?', hint: 'Choose as many as you like. This is your circle.', scene: 'Make room for your kind of people.' },
  { label: 'Your three moments', title: 'Add your first photo.', hint: 'A clear photo of your face is a lovely place to start.', scene: 'Let them see the person behind the vibe.' },
  { label: 'Your three moments', title: 'Another side of you.', hint: 'A candid, a garba look, or a favourite moment.', scene: 'You are more than one moment.' },
  { label: 'Your three moments', title: 'One last moment.', hint: 'Give your profile a little more personality.', scene: 'Three photos. A thousand possible hellos.' },
  { label: 'Your story', title: 'Give them a conversation starter.', hint: 'Pick a prompt and answer it in your own words.', scene: 'A little story can start a big night.' },
  { label: 'Your story', title: 'Tell us a little more.', hint: 'A different prompt, a different side of you.', scene: 'The best stories keep unfolding.' },
  { label: 'Your story', title: 'One final little story.', hint: 'Keep it playful, honest, and you.', scene: 'Your people will get it.' },
  { label: 'The final touch', title: 'Anything else to say?', hint: 'An optional one-liner about your garba vibe.', scene: 'Your circle is waiting.' },
] as const

export default function ProfileEditor({ userId, initial, onSaved, onSignOut, onDelete }: Props) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initial?.name || '')
  const [birthDate, setBirthDate] = useState(initial?.birth_date || '')
  const [gender, setGender] = useState<Gender>(initial?.gender || 'Woman')
  const [interests, setInterests] = useState<Gender[]>(initial?.interested_in || [])
  const [area, setArea] = useState<Area>(initial?.area || 'Delhi')
  const [bio, setBio] = useState(initial?.bio || '')
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null])
  const [previews, setPreviews] = useState<(string | undefined)[]>([])
  const [existingUrls, setExistingUrls] = useState<(string | undefined)[]>([])
  const [answers, setAnswers] = useState<PromptAnswer[]>([0, 1, 2].map(index => initial?.prompt_answers?.[index] || { prompt: PROMPTS[index], answer: '' }))
  const [busy, setBusy] = useState(false)
  const [cropSource, setCropSource] = useState<{ index: number, file: File } | null>(null)
  const [openingCrop, setOpeningCrop] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const paths = initial?.photo_paths?.length ? initial.photo_paths : initial?.photo_path ? [initial.photo_path] : []
  const current = steps[step]
  const maxBirthDate = new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)

  useEffect(() => { void Promise.all(paths.map(photoUrl)).then(setExistingUrls) }, [initial?.id, initial?.photo_paths?.join('|')])
  useEffect(() => {
    const urls = photos.map(file => file ? URL.createObjectURL(file) : undefined)
    setPreviews(urls)
    return () => urls.forEach(url => { if (url) URL.revokeObjectURL(url) })
  }, [photos])

  function changeAnswer(index: number, patch: Partial<PromptAnswer>) {
    setAnswers(current => current.map((item, i) => i === index ? { ...item, ...patch } : item))
    setError('')
  }

  function choosePhoto(index: number, file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Choose an image under 10 MB.'); return }
    setError('')
    setCropSource({ index, file })
  }

  async function adjustPhoto(index: number) {
    if (photos[index]) { setCropSource({ index, file: photos[index]! }); return }
    if (!existingUrls[index]) return
    setOpeningCrop(true)
    setError('')
    try {
      const response = await fetch(existingUrls[index]!)
      if (!response.ok) throw new Error('Could not open this photo. Try replacing it.')
      const blob = await response.blob()
      setCropSource({ index, file: new File([blob], `photo-${index + 1}.jpg`, { type: blob.type || 'image/jpeg' }) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this photo.')
    } finally { setOpeningCrop(false) }
  }

  function validate(index: number): string {
    if (index === 0 && (name.trim().length < 2 || name.trim().length > 40)) return 'Add a name between 2 and 40 characters.'
    if (index === 1 && (!birthDate || !Number.isFinite(age(birthDate)) || age(birthDate) < 18)) return 'You must be 18 or older to join.'
    if (index === 4 && !interests.length) return 'Choose at least one person you would like to meet.'
    if (index >= 5 && index <= 7 && !photos[index - 5] && !paths[index - 5]) return 'Add this photo to continue.'
    if (index >= 8 && index <= 10) {
      const answer = answers[index - 8]
      if (!answer.answer.trim()) return 'Add an answer to continue.'
      if (answers.slice(0, index - 8).some(item => item.prompt === answer.prompt)) return 'Pick a different prompt for this answer.'
    }
    return ''
  }

  async function next(e: React.FormEvent) {
    e.preventDefault()
    const issue = validate(step)
    if (issue) { setError(issue); return }
    setError('')
    if (step < steps.length - 1) { setStep(value => value + 1); return }
    for (let i = 0; i < steps.length; i++) {
      const problem = validate(i)
      if (problem) { setStep(i); setError(problem); return }
    }
    await save()
  }

  async function save() {
    if (!supabase) { setError('Supabase is not configured yet.'); return }
    setBusy(true); setError('')
    const uploaded: string[] = []
    try {
      const nextPaths = [...paths]
      for (let i = 0; i < 3; i++) {
        if (!photos[i]) continue
        const blob = await resizePhoto(photos[i]!)
        if (blob.size > 2 * 1024 * 1024) throw new Error('A photo is too large after resizing. Choose another.')
        const path = `${userId}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('profile-photos').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        uploaded.push(path)
        nextPaths[i] = path
      }
      const values = {
        id: userId, name: name.trim(), birth_date: birthDate, gender, interested_in: interests,
        area, bio: bio.trim(), photo_path: nextPaths[0], photo_paths: nextPaths.slice(0, 3),
        prompt_answers: answers.map(item => ({ prompt: item.prompt, answer: item.answer.trim() })),
      }
      const { data, error: saveError } = await supabase.from('profiles').upsert(values).select('*').single()
      if (saveError) throw saveError
      const replaced = paths.filter((path, i) => photos[i] && path)
      if (replaced.length) void supabase.storage.from('profile-photos').remove(replaced)
      onSaved(data as Profile)
      setPhotos([null, null, null])
      setExistingUrls(await Promise.all(nextPaths.map(photoUrl)))
    } catch (cause) {
      if (uploaded.length) await supabase.storage.from('profile-photos').remove(uploaded)
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.')
    } finally { setBusy(false) }
  }

  function renderQuestion() {
    if (step === 0) return <label className="wizard-field">Your name<input autoFocus required minLength={2} maxLength={40} value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="What should we call you?" autoComplete="given-name" /></label>
    if (step === 1) return <label className="wizard-field">Date of birth<input autoFocus required type="date" max={maxBirthDate} value={birthDate} onChange={e => { setBirthDate(e.target.value); setError('') }} /></label>
    if (step === 2) return <div className="wizard-choices">{GENDERS.map(item => <button type="button" key={item} aria-pressed={gender === item} className={gender === item ? 'wizard-choice active' : 'wizard-choice'} onClick={() => { setGender(item); setError('') }}><span>{item}</span><b>{gender === item ? '✓' : '↗'}</b></button>)}</div>
    if (step === 3) return <div className="wizard-choices wizard-areas">{AREAS.map(item => <button type="button" key={item} aria-pressed={area === item} className={area === item ? 'wizard-choice active' : 'wizard-choice'} onClick={() => { setArea(item); setError('') }}><span>{item}</span><b>{area === item ? '✓' : '↗'}</b></button>)}</div>
    if (step === 4) return <div className="wizard-choices"><p className="wizard-mini-note">Select one or more</p>{GENDERS.map(item => <button type="button" key={item} aria-pressed={interests.includes(item)} className={interests.includes(item) ? 'wizard-choice active' : 'wizard-choice'} onClick={() => { setInterests(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item]); setError('') }}><span>{item}</span><b>{interests.includes(item) ? '✓' : '+'}</b></button>)}</div>
    if (step >= 5 && step <= 7) {
      const index = step - 5
      const image = previews[index] || existingUrls[index]
      return <div className="wizard-photo-wrap"><label className="wizard-photo" htmlFor={`photo-${index}`}>
        {image ? <img src={image} alt={`Profile photo ${index + 1} preview`} /> : <><span className="wizard-photo-plus">+</span><strong>Choose photo {index + 1}</strong><small>Tap to upload from your device</small></>}
        <input id={`photo-${index}`} type="file" accept="image/*" aria-label={`Upload photo ${index + 1}`} onChange={e => { choosePhoto(index, e.target.files?.[0]); e.currentTarget.value = '' }} />
      </label><div className="wizard-photo-dots">{[0, 1, 2].map(i => <span key={i} className={i === index ? 'current' : photos[i] || paths[i] ? 'filled' : ''}>{i + 1}</span>)}</div>{image && <div className="wizard-photo-tools"><button type="button" onClick={() => { void adjustPhoto(index) }} disabled={openingCrop}>{openingCrop ? 'Opening photo…' : 'Adjust crop ↗'}</button><label htmlFor={`photo-${index}`}>Replace photo</label></div>}</div>
    }
    if (step >= 8 && step <= 10) {
      const index = step - 8
      const item = answers[index]
      return <div className="wizard-prompt"><label>Choose a prompt<select value={item.prompt} onChange={e => changeAnswer(index, { prompt: e.target.value })}>{PROMPTS.map(prompt => <option key={prompt}>{prompt}</option>)}</select></label><label>Your answer<textarea autoFocus required maxLength={160} rows={4} value={item.answer} onChange={e => changeAnswer(index, { answer: e.target.value })} placeholder="Say something only you would say…" /><small>{item.answer.length}/160</small></label></div>
    }
    return <label className="wizard-field">Your garba vibe <span>(optional)</span><textarea autoFocus maxLength={240} rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="I'm the one who…" /><small>{bio.length}/240</small></label>
  }

  return <div className={initial ? 'form-wrap inline-form wizard-wrap' : 'form-wrap wizard-wrap'}>
    {!initial && <div className="form-intro wizard-intro">
      <MotionScene ambient />
      <span className="brand">✺ raas<span className="brand-dot">.</span></span>
      <div className="wizard-intro-copy" key={step}><span className="eyebrow">YOUR STORY / {String(step + 1).padStart(2, '0')}</span><h1>{current.scene}</h1><p>One little detail at a time. Then the good part begins.</p></div>
      <div className="intro-stamp"><span>✳</span> GOOD PEOPLE.<br />GREAT NIGHTS.</div>
      <div className="intro-orbit orbit-a">✦</div><div className="intro-orbit orbit-b">✺</div>
    </div>}
    <form className="profile-form wizard-card" onSubmit={next} noValidate>
      <div className="wizard-topline"><span className="eyebrow">{initial ? 'EDIT YOUR VIBE' : 'THE GARBA CIRCLE'}</span><span>{String(step + 1).padStart(2, '0')} / {steps.length}</span></div>
      <div className="wizard-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label="Profile progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      <div className="wizard-question" key={step}><span className="wizard-step-label">{current.label}</span><h2>{current.title}</h2><p>{current.hint}</p><div className="wizard-input">{renderQuestion()}</div></div>
      {error && <div className="form-error wizard-error" role="alert">{error}</div>}
      <div className="wizard-actions"><button type="button" className="wizard-back" onClick={() => { setStep(value => Math.max(0, value - 1)); setError('') }} disabled={step === 0 || busy} aria-label="Previous step">← <span>Back</span></button><button className="primary-btn wizard-next" disabled={busy}>{busy ? 'Saving your story…' : step === steps.length - 1 ? initial ? 'Save my profile ↗' : 'Join the circle ↗' : 'Continue ↗'}</button></div>
      <button type="button" className="signout-link" onClick={onSignOut}>Sign out</button>
      {initial && onDelete && (
        <div className="delete-profile-zone">
          {deleteConfirm ? (
            <>
              <strong>Delete your profile?</strong>
              <p>This will permanently remove your profile, photos, matches, and messages. This cannot be undone.</p>
              <div className="delete-profile-actions">
                <button type="button" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                <button type="button" className="delete-confirm" disabled={deleting} onClick={async () => {
                  setDeleting(true)
                  setError('')
                  try { await onDelete() }
                  catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete profile. Try again.'); setDeleting(false); setDeleteConfirm(false) }
                }}>{deleting ? 'Deleting…' : 'Yes, delete everything'}</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setDeleteConfirm(true)}>Delete my profile</button>
          )}
        </div>
      )}
    </form>
    {cropSource && <PhotoCropper key={cropSource.file.name + cropSource.file.lastModified} file={cropSource.file} number={cropSource.index + 1} onCancel={() => setCropSource(null)} onDone={file => {
      setPhotos(current => current.map((item, index) => index === cropSource.index ? file : item))
      setCropSource(null)
      setError('')
    }} />}
  </div>
}
