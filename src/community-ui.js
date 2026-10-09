import {buildCourseUrl, courseText} from './course'
import {listCreated, removeCreated, listPlayed, removePlayed, getBest} from './course-store'
import {fontLabel} from './font-select'

const $ = (id) => document.getElementById(id)

const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`

let toastTimer = null
export const showToast = (message) => {
  const el = $('toast')
  el.textContent = message
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, 2600)
}

// Copies text to the clipboard; resolves true if it worked. Falls back to the old select-and-copy
// route where the async clipboard isn't available, and returns false if nothing worked.
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(box)
    box.select()
    box.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch (copyError) {
      ok = false
    }
    box.remove()
    return ok
  }
}

export const copyCourseUrl = async (course) => {
  const url = buildCourseUrl(course)
  if (await copyText(url)) {
    showToast('コースのURLをコピーしました')
  } else {
    window.prompt('このURLをコピーしてください', url)
  }
}

// Opens the share sheet where the browser has one, otherwise copies the link. The link goes inside
// the shared text rather than in the separate `url` field: with both, some share sheets' "Copy"
// (iOS in particular) copy the text and drop the link, which is the one thing that matters here.
export const shareCourse = async (course) => {
  const url = buildCourseUrl(course)
  if (navigator.share) {
    try {
      await navigator.share({title: 'Font AR', text: `「${course.name}」に挑戦しよう！\n${url}`})
      return
    } catch (error) {
      if (error.name === 'AbortError') {
        return
      }
    }
  }
  await copyCourseUrl(course)
}

// The community hub (course lists). Playing and creating happen in the AR view, so those are up to
// the caller: `onPlay(course, tab)` when a course is chosen, `onCreate()` for "new course", and
// `onBack()` to return to the mode menu.
export const createCommunityUi = ({onPlay, onCreate, onBack}) => {
  const hubScreen = $('hub-screen')
  const tabs = {created: $('tab-created'), played: $('tab-played')}
  const list = $('course-list')
  const empty = $('course-empty')
  let activeTab = 'created'

  const button = (label, className, onClick) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = `mini-button ${className}`
    el.textContent = label
    el.addEventListener('click', onClick)
    return el
  }

  const renderList = () => {
    const isCreated = activeTab === 'created'
    const courses = isCreated ? listCreated() : listPlayed()
    $('hub-new').hidden = !isCreated
    Object.entries(tabs).forEach(([name, el]) => {
      el.classList.toggle('active', name === activeTab)
      el.setAttribute('aria-selected', String(name === activeTab))
    })
    list.replaceChildren()
    empty.hidden = courses.length > 0
    empty.textContent = isCreated
      ? 'まだコースがありません。「新規作成」から作ってみましょう。'
      : 'まだプレイしたコースがありません。共有されたURLを開くと、ここにたまります。'

    courses.forEach((course) => {
      const item = document.createElement('li')
      item.className = 'course-item'

      const main = document.createElement('div')
      main.className = 'course-main'
      const title = document.createElement('div')
      title.className = 'course-title'
      title.textContent = course.name
      const meta = document.createElement('div')
      meta.className = 'course-meta'
      const best = getBest(course)
      meta.textContent = [
        `「${courseText(course)}」`,
        fontLabel(course.fontId),
        `${course.chars.length}文字`,
        best ? `自己ベスト ${formatSeconds(best)}` : '未クリア',
      ].join(' ・ ')
      main.append(title, meta)

      const actions = document.createElement('div')
      actions.className = 'course-actions'
      actions.append(button('プレイ', 'primary', () => onPlay(course, activeTab)))
      if (isCreated) {
        actions.append(button('共有', '', () => shareCourse(course)))
        actions.append(button('URLコピー', '', () => copyCourseUrl(course)))
      }
      actions.append(button('削除', 'danger', () => {
        if (!window.confirm(`「${course.name}」を${isCreated ? '削除' : '履歴から削除'}しますか？`)) {
          return
        }
        if (isCreated) {
          removeCreated(course.id)
        } else {
          removePlayed(course)
        }
        renderList()
      }))

      item.append(main, actions)
      list.append(item)
    })
  }

  const showHub = (tab = activeTab) => {
    activeTab = tab
    hubScreen.hidden = false
    renderList()
  }

  const hide = () => {
    hubScreen.hidden = true
  }

  Object.entries(tabs).forEach(([name, el]) => el.addEventListener('click', () => {
    activeTab = name
    renderList()
  }))
  $('hub-back').addEventListener('click', onBack)

  $('hub-new').addEventListener('click', onCreate)

  return {showHub, hide}
}
