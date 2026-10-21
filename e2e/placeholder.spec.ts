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

// It fades out over the picture rather than vanishing, and rather than next
// to it, which had the picture jump into place once the blurhash was gone
test('fades the blurhash out over the picture', async ({ page }) => {
	await page.route('**/photo.jpg', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 1500))
		await route.continue()
	})

	const viewer = new ViewerPage(page)
	await viewer.open('photo.jpg')
	await expect(viewer.container.locator('.viewer__placeholder canvas')).toBeVisible()

	// Every frame where both are on screen, until the blurhash is gone
	const frames = await page.evaluate(() => new Promise<{ placeholder: DOMRect, picture: DOMRect, leaving: boolean }[]>((resolve) => {
		const seen: { placeholder: DOMRect, picture: DOMRect, leaving: boolean }[] = []
		const start = performance.now()
		const frame = () => {
			const overlay = document.querySelector<HTMLElement>('.viewer__loading')
			const placeholder = document.querySelector('.viewer__placeholder')
			const element = document.querySelector('oca-viewer-image')
			const picture = element?.querySelector('img')
			if (overlay && placeholder && picture && getComputedStyle(element!).display !== 'none') {
				seen.push({ placeholder: placeholder.getBoundingClientRect(), picture: picture.getBoundingClientRect(), leaving: overlay.classList.contains('viewer__loading-leave-active') })
			}
			if (!overlay && seen.length > 0) {
				resolve(JSON.parse(JSON.stringify(seen)))
			} else if (performance.now() - start < 10_000) {
				requestAnimationFrame(frame)
			} else {
				resolve(seen)
			}
		}
		frame()
	}))

	expect(frames.length).toBeGreaterThan(1)
	// Fading out: how far it got in the frames drawn depends on the machine
	expect(frames.some(({ leaving }) => leaving)).toBe(true)
	for (const { placeholder, picture } of frames) {
		expect(Math.abs(placeholder.x - picture.x)).toBeLessThanOrEqual(1)
		expect(Math.abs(placeholder.y - picture.y)).toBeLessThanOrEqual(1)
	}
})
