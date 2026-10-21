/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { ViewerPage } from './support/viewer.ts'

test.describe('The differences between two images', () => {
	test('show one over the other, and move with the slider', async ({ page }) => {
		const viewer = new ViewerPage(page)
		await page.goto('/?compare=photo-edited.jpg,photo.jpg&view=differences')
		await viewer.waitForOpen()

		const images = viewer.container.locator('.image-differences__image')
		await expect(images).toHaveCount(2)
		await expect(images.nth(1)).toHaveCSS('clip-path', 'inset(0px 0px 0px 50%)')

		// The slider is a native range input: the arrow keys move it
		await viewer.container.locator('.image-differences__slider').focus()
		await page.keyboard.press('ArrowLeft')
		await expect(images.nth(1)).toHaveCSS('clip-path', 'inset(0px 0px 0px 49%)')
	})

	test('switch back to side by side, and again with D', async ({ page }) => {
		const viewer = new ViewerPage(page)
		await page.goto('/?compare=photo-edited.jpg,photo.jpg&view=differences')
		await viewer.waitForOpen()

		await viewer.container.getByRole('button', { name: 'Show side by side' }).click()
		await expect(viewer.container.locator('.viewer__comparison oca-viewer-image')).toHaveCount(2)
		await expect(viewer.container.locator('.image-differences')).toHaveCount(0)

		await page.keyboard.press('d')
		await expect(viewer.container.locator('.image-differences')).toHaveCount(1)
	})
})

// Two versions of a tall picture, named by their dates as the versions tab
// names them, in a viewer made narrow by the sidebar
test.describe('A tall picture compared in a narrow viewer', () => {
	/**
	 * Compare two versions of portrait.jpg.
	 *
	 * @param page - The playground
	 * @param view - Side by side, or the differences
	 */
	async function compareVersions(page: Page, view: 'side-by-side' | 'differences') {
		await page.setViewportSize({ width: 600, height: 800 })
		await page.goto('/')
		await page.evaluate(async (opening) => {
			const { File } = await import('/@id/@nextcloud/files')
			const { service } = Object.values((window as unknown as { _nc_viewer_scope: Record<string, { service: { compare: (...args: unknown[]) => Promise<unknown> } }> })._nc_viewer_scope)[0]!
			const version = (date: string) => new File({
				source: `${location.origin}/remote.php/dav/files/playground/portrait.jpg`,
				root: '/files/playground',
				mime: 'image/jpeg',
				owner: 'playground',
				displayname: date,
				attributes: { etag: date },
			})
			await service.compare(version('21 October 2026, 08:51:41'), version('14 September 2026, 17:02:09'), { view: opening })
		}, view)
		await expect(page.locator('.viewer__comparison img').first()).toBeVisible()
	}

	test('fits side by side without scrolling', async ({ page }) => {
		await compareVersions(page, 'side-by-side')
		const content = page.locator('.modal-container__content')
		await expect.poll(() => content.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0)
	})

	test('hides the names of the two under the pointer', async ({ page }) => {
		await compareVersions(page, 'differences')
		const label = page.locator('.image-differences__label').first()
		await expect(label).toHaveCSS('opacity', '1')

		await page.locator('.image-differences').hover()
		await expect(label).toHaveCSS('opacity', '0')

		await page.mouse.move(5, 790)
		await expect(label).toHaveCSS('opacity', '1')
	})

	test('keeps the names of the two apart', async ({ page }) => {
		await compareVersions(page, 'differences')
		const [base, other] = await page.locator('.image-differences__label').all()
		const left = (await base!.boundingBox())!
		const right = (await other!.boundingBox())!
		expect(left.x + left.width).toBeLessThanOrEqual(right.x)
	})
})
