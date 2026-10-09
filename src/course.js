import {FONTS, DEFAULT_FONT_ID} from './text-plane'

export const MAX_CHARS = 10
export const MAX_NAME_LENGTH = 20
export const SCALE_MIN = 0.25
export const SCALE_MAX = 2.5
export const POSITION_LIMIT = 100 // meters from the course's origin; just a sanity bound
const STEP = 0.05 // positions and sizes are kept to this grid, so a course re-encodes identically

// A course is a font plus a list of single characters, each with its own size and its position
// relative to the course's origin. x is to the right and z toward the player, in the frame the
// course was laid out in (so it can be re-placed facing whoever is playing it). Where the course
// sits in the room isn't part of it -- SLAM coordinates don't carry over between sessions -- and
// start/goal follow from the first/last character, so a course fits in a URL.
//
// Everything here is treated as untrusted input (it can come straight out of a shared link): the
// character list is length-clamped, numbers are bounded and snapped, the font must be one we ship,
// and the result is only ever put on screen via textContent.
const snap = (value, min, max, fallback) => {
  const n = Number(value)
  const v = Number.isFinite(n) ? n : fallback
  return Number((Math.round(Math.min(max, Math.max(min, v)) / STEP) * STEP).toFixed(2))
}

export const normalizeCourse = (raw) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.c)) {
    return null
  }
  const chars = []
  raw.c.forEach((entry) => {
    if (!Array.isArray(entry) || chars.length >= MAX_CHARS) {
      return
    }
    const ch = Array.from(String(entry[0] ?? ''))[0]
    if (!ch || !ch.trim()) {
      return
    }
    chars.push({
      ch,
      x: snap(entry[1], -POSITION_LIMIT, POSITION_LIMIT, 0),
      z: snap(entry[2], -POSITION_LIMIT, POSITION_LIMIT, 0),
      s: snap(entry[3], SCALE_MIN, SCALE_MAX, 1),
    })
  })
  if (chars.length === 0) {
    return null
  }
  const fontId = FONTS.some((f) => f.id === raw.f) ? raw.f : DEFAULT_FONT_ID
  const name = Array.from(String(raw.n ?? '').trim()).slice(0, MAX_NAME_LENGTH).join('') || chars.map((c) => c.ch).join('')
  return {name, fontId, chars}
}

// The compact form used in URLs and in storage.
export const toRaw = (course) => ({
  n: course.name,
  f: course.fontId,
  c: course.chars.map((c) => [c.ch, c.x, c.z, c.s]),
})

export const courseText = (course) => course.chars.map((c) => c.ch).join('')

// Identity of a course for records: the same font and layout is the same course no matter who made
// it or what they called it.
export const courseKey = (course) =>
  `${course.fontId}:${course.chars.map((c) => `${c.ch}@${c.x},${c.z}x${c.s}`).join('|')}`

const toBase64Url = (bytes) => {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export const encodeCourse = (course) =>
  toBase64Url(new TextEncoder().encode(JSON.stringify({v: 2, ...toRaw(course)})))

export const decodeCourse = (encoded) => {
  try {
    const raw = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)))
    return raw && raw.v === 2 ? normalizeCourse(raw) : null
  } catch (error) {
    return null
  }
}

export const buildCourseUrl = (course) => {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('c', encodeCourse(course))
  return url.toString()
}

// null when the page wasn't opened from a course link; {invalid: true} when it was but the link is broken.
export const readCourseFromLocation = () => {
  const encoded = new URLSearchParams(window.location.search).get('c')
  if (encoded === null) {
    return null
  }
  return decodeCourse(encoded) || {invalid: true}
}
