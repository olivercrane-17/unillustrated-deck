// A tiny DOM helper: h('button.btn.btn-gilt', { onclick }, 'Draw a card').
// Strings are always text nodes; use raw() for trusted SVG markup.

const RAW = Symbol('raw')

export function raw(html) {
  return { [RAW]: html }
}

export function h(tag, attrs, ...children) {
  if (attrs === null || typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node || attrs[RAW]) {
    children.unshift(attrs)
    attrs = {}
  }
  const [name, ...classes] = tag.split('.')
  const el = document.createElement(name || 'div')
  if (classes.length) el.className = classes.join(' ')
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ')
    else if (k === 'style' && typeof v === 'object') {
      // setProperty is the only way to set custom properties like --tilt.
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val)
        else el.style[prop] = val
      }
    }
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'html') el.innerHTML = v
    else if (v === true) el.setAttribute(k, '')
    else if (k in el && !k.includes('-') && k !== 'list' && k !== 'form') el[k] = v
    else el.setAttribute(k, v)
  }
  append(el, children)
  return el
}

function append(el, children) {
  for (const c of children) {
    if (c === undefined || c === null || c === false || c === '') continue
    if (Array.isArray(c)) append(el, c)
    else if (c instanceof Node) el.appendChild(c)
    else if (c[RAW] !== undefined) el.insertAdjacentHTML('beforeend', c[RAW])
    else el.appendChild(document.createTextNode(String(c)))
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
  return el
}

export function mount(el, ...children) {
  clear(el)
  append(el, children)
  return el
}

let idSeq = 0
export function uid(prefix = 'u') {
  idSeq += 1
  return `${prefix}${idSeq}`
}

export function prefersReducedMotion() {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))
