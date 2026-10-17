import { test, expect } from '@playwright/test'

async function freshStart(page) {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Draw a card', exact: true })).toBeVisible()
}

async function dealSpread(page, label = 'A cosy evening') {
  await page.getByRole('button', { name: new RegExp(label) }).first().click()
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click()
  await expect(page.locator('.slip .sentence')).toBeVisible()
}

test('first open, one tap, a full reading with pencils from the tin', async ({ page }) => {
  await freshStart(page)
  await expect(page.getByText('Tap the deck.')).toBeVisible()
  await dealSpread(page)
  const sentence = await page.locator('.slip .sentence').textContent()
  expect(sentence).toMatch(/^[A-Z].+\.$/)
  expect(sentence).not.toMatch(/[{}]|undefined/)
  const rows = page.locator('.pencil-row')
  expect(await rows.count()).toBeGreaterThanOrEqual(3)
  await expect(page.locator('.first-mark p')).toContainText(/Start/)
  await expect(page.locator('.fan .card')).toHaveCount(3)
})

test('the reading survives a reload', async ({ page }) => {
  await freshStart(page)
  await dealSpread(page)
  const before = await page.locator('.slip .sentence').textContent()
  await page.reload()
  await expect(page.locator('.slip .sentence')).toHaveText(before)
})

test('swapping one card keeps the others', async ({ page }) => {
  await freshStart(page)
  await dealSpread(page)
  const ids = async () => page.locator('.fan .card').evaluateAll((els) => els.map((e) => e.dataset.card))
  const [who, where, when] = await ids()
  await page.locator('.fan .card-slot').nth(2).click()
  await page.getByRole('button', { name: 'Swap this card' }).click()
  await expect.poll(async () => (await ids())[2]).not.toBe(when)
  const after = await ids()
  expect(after[0]).toBe(who)
  expect(after[1]).toBe(where)
})

test('new colours, same picture keeps the cards; a locked pencil stays', async ({ page }) => {
  await freshStart(page)
  await dealSpread(page)
  const ids = await page.locator('.fan .card').evaluateAll((els) => els.map((e) => e.dataset.card))
  const firstPencil = await page.locator('.pencil-row .pencil-name code').first().textContent()
  await page.locator('.pencil-row').first().getByRole('button', { name: /^Keep / }).click()
  await page.getByRole('button', { name: 'New colours, same picture' }).click()
  await expect(page.locator('.pencil-row .pencil-name code').first()).toHaveText(firstPencil)
  expect(await page.locator('.fan .card').evaluateAll((els) => els.map((e) => e.dataset.card))).toEqual(ids)
})

test('every spread deals', async ({ page }) => {
  await freshStart(page)
  await dealSpread(page, 'A quick doodle')
  for (const label of ['Something big', 'A page of small things', 'A cosy evening', 'A quick doodle']) {
    await page.locator('.ask-again-for .chip', { hasText: label }).click()
    await expect(page.locator('.slip .sentence')).toBeVisible()
    await expect(page.locator('.ask-again-for .chip', { hasText: label })).toHaveCount(0)
  }
})

test('asking again three times spreads out choices', async ({ page }) => {
  await freshStart(page)
  await dealSpread(page)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Ask the deck again' }).click()
    await expect(page.locator('.slip .sentence')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Ask the deck again' }).click()
  await expect(page.locator('.choices .card-slot')).toHaveCount(3)
  await page.locator('.choices .card-slot').first().click()
  await expect(page.locator('.slip .sentence')).toBeVisible()
})
