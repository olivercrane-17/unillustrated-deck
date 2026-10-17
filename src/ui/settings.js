import { h, mount } from './h.js'

export function render(root) {
  mount(root, h('div.page-head', h('h1', 'settings'), h('p', 'Coming soon.')))
}
