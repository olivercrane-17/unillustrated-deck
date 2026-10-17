import { h, mount } from './h.js'

export function render(root) {
  mount(root, h('div.page-head', h('h1', 'draw'), h('p', 'Coming soon.')))
}
