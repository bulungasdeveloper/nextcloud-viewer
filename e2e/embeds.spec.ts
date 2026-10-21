/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { ViewerPage } from './support/viewer.ts'

// Files shown where they are mentioned, as the preview of a link in a chat
test.describe('<nc-viewer-file>', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/?embeds')
	})

	test('shows a picture, and names it under the pointer', async ({ page }) => {
		const element = page.locator('nc-viewer-file').nth(0)
		await element.scrollIntoViewIfNeeded()
		await expect(element.locator('oca-viewer-image img')).toBeVisible()
		const bar = element.locator('.viewer-file__bar')
		await expect(bar).toHaveCSS('opacity', '0')

		await element.hover()
		await expect(bar).toHaveCSS('opacity', '1')
		await expect(bar).toContainText('photo.jpg')
	})

	test('opens it in the viewer from its menu', async ({ page }) => {
		const element = page.locator('nc-viewer-file').nth(0)
		await element.scrollIntoViewIfNeeded()
		await expect(element.locator('oca-viewer-image img')).toBeVisible()
		await element.hover()
		await element.locator('.viewer-file__actions button').first().click()
		await page.getByRole('menuitem', { name: 'Open in the viewer' }).click()

		const viewer = new ViewerPage(page)
		await viewer.waitForOpen()
		expect(await viewer.currentName()).toBe('photo.jpg')
	})

	test('keeps a video behind one play button until played', async ({ page }) => {
		const element = page.locator('nc-viewer-file').nth(1)
		await element.scrollIntoViewIfNeeded()
		const cover = element.getByRole('button', { name: 'Play' }).and(element.locator('.viewer-file__cover'))
		await expect(cover).toBeVisible()

		await cover.click()
		await expect(cover).toHaveCount(0)
	})

	test('says when nothing can show a file, and offers it to download', async ({ page }) => {
		const card = page.locator('.viewer-file__card')
		await card.scrollIntoViewIfNeeded()
		await expect(card).toContainText('report.zip')
		await expect(card).toContainText('No preview available')
		await expect(card.getByRole('button', { name: 'Download' })).toBeVisible()
	})

	test('shows what the page put inside instead, when it put something', async ({ page }) => {
		const own = page.locator('.playground__embed--own')
		await own.scrollIntoViewIfNeeded()
		await expect(own.getByRole('link', { name: 'report.zip' })).toBeVisible()
		await expect(own.locator('.viewer-file__card')).toHaveCount(0)
	})
})
