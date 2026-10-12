import { createClient } from '@supabase/supabase-js'
export { age } from './age'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url, key) : null

export const AREAS = ['Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Faridabad'] as const
export const GENDERS = ['Man', 'Woman', 'Non-binary', 'Other'] as const
export type Gender = typeof GENDERS[number]
export type Area = typeof AREAS[number]
export type PromptAnswer = { prompt: string, answer: string }
export const PROMPTS = [
  'My ideal garba night starts with…',
  'The song that gets me into the circle is…',
  'I will teach you…',
  'You should know this about me…',
  'The way to win me over is…',
  'After garba, find me…',
  'My most chaotic Navratri moment…',
  'Two truths and a garba lie…',
] as const

export type Profile = {
  id: string
  name: string
  birth_date: string
  gender: Gender
  interested_in: Gender[]
  area: Area
  bio: string
  photo_path: string | null
  photo_paths: string[]
  prompt_answers: PromptAnswer[]
  photo_url?: string
  photo_urls?: string[]
}

export type Match = {
  id: string
  other_id: string
  other_name: string
  other_area: Area
  other_photo_path: string | null
  other_photo_url?: string
  created_at: string
}

export type Message = {
  id: string
  match_id: string
  sender_id: string
  body: string
  created_at: string
}

export async function photoUrl(path: string | null) {
  if (!path || !supabase) return undefined
  const { data } = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
  return data?.signedUrl
}

export async function resizePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image under 10 MB.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not process image.')), 'image/jpeg', 0.78))
}
