import { h, mount } from './h.js'

export function render(root) {
  mount(root, h('div.page-head', h('h1', 'card-detail'), h('p', 'Coming soon.')))
}
