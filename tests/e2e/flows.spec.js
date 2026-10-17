import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const sets = JSON.parse(readFileSync(new URL('../../src/data/sets.json', import.meta.url), 'utf8'))
const PHOTO = new URL('./fixtures/drawing.jpg', import.meta.url).pathname

async function dealQuick(page) {
  await page.goto('./')
  await page.getByRole('button', { name: /A quick doodle/ }).first().click()
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click()
  await expect(page.locator('.slip .sentence')).toBeVisible()
  return page.locator('.fan .card').first().getAttribute('data-card')
}

async function startDrawing(page) {
  await page.getByRole('button', { name: /Start drawing/ }).click()
  await expect(page).toHaveURL(/#\/draw\//)
  await page.getByRole('button', { name: /I.ve drawn it/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('seal a photo: it lands in Your Deck and survives a reload', async ({ page }) => {
  const cardId = await dealQuick(page)
  await startDrawing(page)
  await page.locator('input[type=file]:not([capture])').setInputFiles(PHOTO)
  await page.getByRole('button', { name: 'Seal it' }).click()
  await page.getByRole('button', { name: 'Lovely' }).click()
  await expect(page).toHaveURL(new RegExp(`#/card/${cardId}`))
  await page.goto('./#/deck')
  const sealed = page.locator(`.card[data-card="${cardId}"] img`).first()
  await expect(sealed).toBeVisible()
  await page.reload()
  await expect(page.locator(`.card[data-card="${cardId}"] img`).first()).toBeVisible()
})

test('drawn, no photo: the card is ticked in Your Deck', async ({ page }) => {
  const cardId = await dealQuick(page)
  await startDrawing(page)
  await page.getByRole('button', { name: 'Drawn, no photo' }).click()
  await page.getByRole('button', { name: 'Lovely' }).click()
  await page.goto('./#/deck')
  await expect(page.locator(`.card[data-card="${cardId}"]`).first()).toBeVisible()
  await expect(page.locator(`.card[data-card="${cardId}"] .card-date`).first()).toContainText('✓')
})

test('switching the tin to the 12 box: every dealt pencil is in that box', async ({ page }) => {
  await page.goto('./#/tin')
  await expect(page.getByText(/48 pencils in your tin/)).toBeVisible()
  await page.getByRole('button', { name: '12 pencils', exact: true }).click()
  const confirm = page.getByRole('dialog')
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button').filter({ hasNotText: /Keep|Not now|Close/ }).first().click()
  await expect(page.getByText(/12 pencils in your tin/)).toBeVisible()
  const allowed = new Set(sets['12'].codes)
  await page.goto('./')
  await page.getByRole('button', { name: /Something big/ }).first().click()
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click()
  await expect(page.locator('.slip .sentence')).toBeVisible()
  for (let i = 0; i < 3; i++) {
    const codes = await page.locator('.pencil-row .pencil-name code').allTextContents()
    expect(codes.length).toBeGreaterThan(0)
    for (const code of codes) expect(allowed.has(code.trim())).toBe(true)
    await page.getByRole('button', { name: 'New colours, same picture' }).click()
  }
})

test('works offline once it has been opened', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: /A quick doodle/ }).first().click()
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click()
  await expect(page.locator('.slip .sentence')).toBeVisible()
  await context.setOffline(false)
})

test('save a copy, wipe everything, restore it', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'downloads are exercised on desktop')
  const cardId = await dealQuick(page)
  await startDrawing(page)
  await page.getByRole('button', { name: 'Drawn, no photo' }).click()
  await page.getByRole('button', { name: 'Lovely' }).click()

  await page.goto('./#/settings')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save a copy' }).click()
  const download = await downloading
  const zipPath = info.outputPath('backup.zip')
  await download.saveAs(zipPath)
  expect(download.suggestedFilename()).toMatch(/^unillustrated-deck-\d{4}-\d{2}-\d{2}\.zip$/)

  await page.evaluate(async () => {
    localStorage.clear()
    await new Promise((resolve) => { const r = indexedDB.deleteDatabase('unillustrated-deck'); r.onsuccess = r.onerror = r.onblocked = () => resolve() })
  })
  await page.goto('./#/deck')
  await page.reload()
  await expect(page.locator(`.card[data-card="${cardId}"]`)).toHaveCount(0)

  await page.goto('./#/settings')
  await page.locator('input[type=file]').setInputFiles(zipPath)
  await page.getByRole('button', { name: /^Replace/ }).click()
  await expect(page.getByText(/Restored/)).toBeVisible()
  await page.goto('./#/deck')
  await expect(page.locator(`.card[data-card="${cardId}"]`).first()).toBeVisible()
})
