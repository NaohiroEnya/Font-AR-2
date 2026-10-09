import {FONTS} from './text-plane'

// Fills a <select> with the available fonts, grouped by gothic/mincho.
export const populateFontSelect = (select) => {
  FONTS.forEach(({id, group, label}, i) => {
    let optgroup = select.querySelector(`optgroup[label="${group}"]`)
    if (!optgroup) {
      optgroup = document.createElement('optgroup')
      optgroup.label = group
      select.appendChild(optgroup)
    }
    const option = document.createElement('option')
    option.value = id
    option.textContent = label
    option.selected = i === 0
    optgroup.appendChild(option)
  })
}

export const fontLabel = (fontId) => (FONTS.find((f) => f.id === fontId) || FONTS[0]).label
