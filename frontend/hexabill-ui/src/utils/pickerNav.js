// Keyboard model for a listbox-style picker. Returns the next active index (-1 = none) and an action.
export const pickerKey = (key, active, count) => {
  if (count <= 0) return { active: -1, action: key === 'Escape' ? 'close' : null }
  switch (key) {
    case 'ArrowDown': return { active: active < 0 ? 0 : (active + 1) % count, action: 'open' }
    case 'ArrowUp': return { active: active <= 0 ? count - 1 : active - 1, action: 'open' }
    case 'Home': return { active: 0, action: null }
    case 'End': return { active: count - 1, action: null }
    case 'Enter': return { active, action: active >= 0 ? 'select' : null }
    case 'Escape': return { active: -1, action: 'close' }
    default: return { active, action: null }
  }
}
