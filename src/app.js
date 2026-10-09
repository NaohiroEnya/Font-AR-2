// app.js is the main entry point for your three.js 8th Wall app.

import {initScenePipelineModule} from './threejs-scene-init'
import {loadFont} from './text-plane'
import {populateFontSelect} from './font-select'
import {readCourseFromLocation, normalizeCourse} from './course'
import {notePlayed, recordTime, addCreated} from './course-store'
import {createCommunityUi, showToast} from './community-ui'
import * as THREE from 'three'

window.THREE = THREE

const PLACEMENT_INSTRUCTIONS = '文字を入力して地面をタップすると設置、設置済みの文字をタップすると選択されます'
const SELECTION_INSTRUCTIONS = '選択中の文字をドラッグすると位置を移動できます。スライダーでサイズを調整できます'
const COURSE_INSTRUCTIONS = '地面をタップしてコースを置こう。緑のスタートに触れてから、文字をはみ出さずに赤のゴールまで進もう'
const CREATE_INSTRUCTIONS = '文字を入力して地面をタップすると、1文字ずつ並べて置かれます。文字をタップすると、その文字だけ移動・サイズ変更できます'

const instructionsEl = document.getElementById('instructions')
const placementPanel = document.getElementById('placement-panel')
const selectionPanel = document.getElementById('selection-panel')
const selectionSizeInput = document.getElementById('selection-size')
const fontSelect = document.getElementById('font-select')
const createPanel = document.getElementById('create-panel')
const courseNameInput = document.getElementById('course-name')

populateFontSelect(fontSelect)
// Start downloading the newly chosen font right away, so the first placement with it doesn't
// stall on the fetch.
fontSelect.addEventListener('change', () => loadFont(fontSelect.value))

let mode = 'menu' // 'menu' | 'single' | 'hub' | 'course' | 'create'
const instructionsFor = (selected) => {
  if (mode === 'course') {
    return COURSE_INSTRUCTIONS
  }
  if (mode === 'create' && !selected) {
    return CREATE_INSTRUCTIONS
  }
  return selected ? SELECTION_INSTRUCTIONS : PLACEMENT_INSTRUCTIONS
}

const handleSelectionChange = (group) => {
  const selected = !!group
  placementPanel.hidden = selected
  selectionPanel.hidden = !selected
  createPanel.hidden = selected
  instructionsEl.textContent = instructionsFor(selected)
  if (selected) {
    // Show the selected text's own size, so nudging the slider resizes from where it is.
    selectionSizeInput.value = String(group.scale.x)
  }
}

// While building a course every character shares one font, so it's locked once something is placed.
const handlePlacedChange = (count) => {
  if (mode === 'create') {
    fontSelect.disabled = count > 0
  }
}

// Clearing a course records the time against it (locally for now) and returns a line to show on
// the CLEAR screen.
const handleClear = ({course, elapsedMs}) => {
  const {best, isNewBest} = recordTime(course, elapsedMs)
  return isNewBest ? '自己ベスト更新！' : `自己ベスト ${(best / 1000).toFixed(1)}s`
}

const {
  pipelineModule, setSelectedScale, setRodLength, deleteSelected, deselect, resetScene,
  setCourse, startCreate, getCourseLayout,
} = initScenePipelineModule({
  onSelectionChange: handleSelectionChange,
  onClear: handleClear,
  onPlacedChange: handlePlacedChange,
})

const rodLengthInput = document.getElementById('rod-length')
const rodLengthValue = document.getElementById('rod-length-value')
rodLengthInput.addEventListener('input', (event) => {
  const length = Number(event.target.value)
  rodLengthValue.textContent = `${length}m`
  setRodLength(length)
})
selectionSizeInput.addEventListener('input', (event) => {
  setSelectedScale(Number(event.target.value))
})
document.getElementById('selection-delete').addEventListener('click', () => {
  deleteSelected()
})
document.getElementById('selection-done').addEventListener('click', () => {
  deselect()
})

// ---- modes / screens
const modeBackButton = document.getElementById('mode-back')
const menuScreen = document.getElementById('menu-screen')
const rodLengthSlider = document.getElementById('rod-length')
let lastHubTab = 'created'

const setMode = (next) => {
  mode = next
  document.body.className = `mode-${next}`
  menuScreen.hidden = next !== 'menu'
  fontSelect.disabled = false
  createPanel.hidden = false
}

const showMenu = () => {
  setCourse(null)
  community.hide()
  setMode('menu')
}

const enterSingle = () => {
  setCourse(null)
  community.hide()
  setMode('single')
  setRodLength(Number(rodLengthSlider.value)) // a course may have reset the rod to its default
  modeBackButton.textContent = '← メニュー'
  placementPanel.hidden = false
  selectionPanel.hidden = true
  instructionsEl.textContent = instructionsFor(false)
}

const showHub = (tab) => {
  if (tab) {
    lastHubTab = tab
  }
  setCourse(null)
  setMode('hub')
  community.showHub(lastHubTab)
}

const playCourse = (course, fromTab) => {
  if (fromTab) {
    lastHubTab = fromTab
  }
  notePlayed(course)
  community.hide()
  setCourse(course)
  setMode('course')
  modeBackButton.textContent = '← コース一覧'
  placementPanel.hidden = true
  selectionPanel.hidden = true
  instructionsEl.textContent = instructionsFor(false)
}

const enterCreate = () => {
  community.hide()
  startCreate()
  setMode('create')
  courseNameInput.value = ''
  placementPanel.hidden = false
  selectionPanel.hidden = true
  instructionsEl.textContent = instructionsFor(false)
}

const community = createCommunityUi({onPlay: playCourse, onCreate: enterCreate, onBack: showMenu})

document.getElementById('create-save').addEventListener('click', () => {
  const layout = getCourseLayout()
  if (!layout) {
    showToast('文字を置いてから保存してください')
    return
  }
  const course = normalizeCourse({
    n: courseNameInput.value,
    f: layout.fontId,
    c: layout.chars.map((c) => [c.ch, c.x, c.z, c.s]),
  })
  if (!course) {
    showToast('コースを保存できませんでした')
    return
  }
  addCreated(course)
  showHub('created')
  showToast('コースを保存しました。「共有」でURLを送れます')
})
document.getElementById('create-clear').addEventListener('click', resetScene)
document.getElementById('create-cancel').addEventListener('click', () => {
  if (getCourseLayout() && !window.confirm('作成中のコースを破棄しますか？')) {
    return
  }
  showHub('created')
})
document.getElementById('course-replace').addEventListener('click', resetScene)

document.getElementById('menu-single').addEventListener('click', enterSingle)
document.getElementById('menu-community').addEventListener('click', () => showHub())
modeBackButton.addEventListener('click', () => (mode === 'course' ? showHub() : showMenu()))

// Opened from a shared course link: go straight into that course.
const sharedCourse = readCourseFromLocation()
if (sharedCourse && sharedCourse.invalid) {
  showToast('コースのURLが正しくありません')
} else if (sharedCourse) {
  playCourse(sharedCourse, 'played')
  showToast(`コース「${sharedCourse.name}」を開きました`)
}

const onxrloaded = () => {
  XR8.addCameraPipelineModules([  // Add camera pipeline modules.
    // Existing pipeline modules.
    XR8.GlTextureRenderer.pipelineModule(),      // Draws the camera feed.
    XR8.Threejs.pipelineModule(),                // Creates a ThreeJS AR Scene.
    XR8.XrController.pipelineModule(),           // Enables SLAM tracking.
    LandingPage.pipelineModule(),         // Detects unsupported browsers and gives hints.
    XRExtras.FullWindowCanvas.pipelineModule(),  // Modifies the canvas to fill the window.
    XRExtras.Loading.pipelineModule(),           // Manages the loading screen on startup.
    XRExtras.RuntimeError.pipelineModule(),      // Shows an error image on runtime error.
    // Custom pipeline modules.
    pipelineModule,  // Sets up the threejs camera and scene content.
  ])

  const canvas = document.getElementById('camerafeed')
  // Open the camera and start running the camera run loop.
  XR8.run({canvas})
}

window.XR8 ? onxrloaded() : window.addEventListener('xrloaded', onxrloaded)
