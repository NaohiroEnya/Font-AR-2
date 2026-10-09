import {normalizeCourse, courseKey, toRaw} from './course'

// Courses and times live in this browser only (localStorage) for now. Every read re-validates what
// it finds, since anything in storage could have been edited by hand.
// (v2: courses became per-character layouts; courses saved in the earlier single-text format
// aren't carried over.)
const KEYS = {
  created: 'fontar.created.v2',
  played: 'fontar.played.v2',
  best: 'fontar.best.v2',
}

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch (error) {
    return fallback // storage unavailable (e.g. private browsing) or corrupt
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // storage full/unavailable: the list just won't persist
  }
}

const readCourses = (key) =>
  read(key, [])
    .map((entry) => {
      const course = normalizeCourse(entry)
      return course && {...course, id: String(entry.id || ''), at: Number(entry.at) || 0}
    })
    .filter(Boolean)

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

const stored = (course) => ({...toRaw(course), id: course.id, at: course.at})

export const listCreated = () => readCourses(KEYS.created).sort((a, b) => b.at - a.at)

export const addCreated = (course) => {
  const entry = {...course, id: newId(), at: Date.now()}
  write(KEYS.created, [{...toRaw(entry), id: entry.id, at: entry.at}, ...readCourses(KEYS.created).map(stored)])
  return entry
}

export const removeCreated = (id) => {
  write(KEYS.created, readCourses(KEYS.created).filter((c) => c.id !== id).map(stored))
}

export const listPlayed = () => readCourses(KEYS.played).sort((a, b) => b.at - a.at)

// Adds a course to the "played" list (or bumps it to the top if it's already there). Courses you made
// yourself aren't added: they already have their own list.
export const notePlayed = (course) => {
  const key = courseKey(course)
  if (readCourses(KEYS.created).some((c) => courseKey(c) === key)) {
    return
  }
  const others = readCourses(KEYS.played).filter((c) => courseKey(c) !== key)
  write(KEYS.played, [stored({...course, id: key, at: Date.now()}), ...others.map(stored)])
}

export const removePlayed = (course) => {
  const key = courseKey(course)
  write(KEYS.played, readCourses(KEYS.played).filter((c) => courseKey(c) !== key).map(stored))
}

const readBest = () => {
  const saved = read(KEYS.best, {})
  return saved && typeof saved === 'object' ? saved : {}
}

export const getBest = (course) => {
  const ms = Number(readBest()[courseKey(course)])
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

// Records a clear time; returns {best, isNewBest}.
export const recordTime = (course, ms) => {
  const previous = getBest(course)
  const isNewBest = previous === null || ms < previous
  if (isNewBest) {
    write(KEYS.best, {...readBest(), [courseKey(course)]: ms})
  }
  return {best: isNewBest ? ms : previous, isNewBest}
}
