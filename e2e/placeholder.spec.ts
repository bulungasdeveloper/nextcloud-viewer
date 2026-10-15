/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { ViewerPage } from './support/viewer.ts'

test('shows a picture as its blurhash, at its size, while it loads', async ({ page }) => {
	// Slow enough to look at what is shown meanwhile, the viewer's first
	// opening included
	await page.route('**/photo.jpg', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 5000))
		await route.continue()
	})

	const viewer = new ViewerPage(page)
	await viewer.open('photo.jpg')

	await expect(viewer.container).toBeVisible()
	const placeholder = viewer.container.locator('.viewer__placeholder')
	await expect(placeholder.locator('canvas')).toBeVisible()
	// 3500 by 2335, the size Photos recorded of it
	const box = (await placeholder.boundingBox())!
	expect(box.width / box.height).toBeCloseTo(3500 / 2335, 1)

	// Gone once the picture is there, a while after the delay above
	await expect(placeholder).toHaveCount(0, { timeout: 15_000 })
	await viewer.waitForOpen()
	// The picture takes the place its blurhash had
	const picture = (await viewer.container.locator('oca-viewer-image img').first().boundingBox())!
	expect(Math.abs(picture.width - box.width)).toBeLessThanOrEqual(1)
	expect(Math.abs(picture.height - box.height)).toBeLessThanOrEqual(1)
})
