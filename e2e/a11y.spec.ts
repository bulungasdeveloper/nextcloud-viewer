/*!
 * SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test'
import { ViewerPage } from './support/viewer.ts'

test('exposes the viewer as a dialog named after the file, with named controls', async ({ page }) => {
	const viewer = new ViewerPage(page)
	await viewer.open('gradient.jpg')
	await viewer.waitForOpen()

	await expect(page.getByRole('dialog', { name: 'gradient.jpg' })).toBeVisible()
	await expect(viewer.nextButton).toBeVisible()
	await expect(viewer.previousButton).toBeVisible()
	await expect(viewer.closeButton).toBeVisible()
})

// nextcloud/viewer#860
test('takes the keyboard on open, and gives it back on close', async ({ page }) => {
	const viewer = new ViewerPage(page)
	await page.goto('/')
	const opener = page.getByRole('button', { name: 'gradient.jpg' })
	await opener.focus()
	await page.keyboard.press('Enter')
	await viewer.waitForOpen()
	await expect(viewer.container.locator(':focus')).toHaveCount(1)

	await page.keyboard.press('ArrowRight')
	await viewer.waitForOpen()
	await page.keyboard.press('Escape')
	await expect(viewer.container).toBeHidden()
	await expect(opener).toBeFocused()
})

test('gives a video\'s player the keyboard, and the arrows still step through files', async ({ page }) => {
	const viewer = new ViewerPage(page)
	await viewer.open('video.mp4')
	await viewer.waitForOpen()
	const video = viewer.container.locator('video')
	await expect(viewer.container.locator('video-skin')).toBeFocused()

	await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false)
	await page.keyboard.press('Space')
	await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true)

	await page.keyboard.press('ArrowRight')
	await expect.poll(() => viewer.currentName()).not.toBe('video.mp4')
})

test('gives an audio player the keyboard', async ({ page }) => {
	const viewer = new ViewerPage(page)
	await viewer.open('audio.mp3')
	await viewer.waitForOpen()
	const audio = viewer.container.locator('audio')
	await expect(viewer.container.locator('audio-skin')).toBeFocused()

	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
	await page.keyboard.press('Space')
	await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true)
})

test('gives the differences slider the keyboard', async ({ page }) => {
	await page.goto('/?compare=photo-edited.jpg,photo.jpg&view=differences')
	const slider = page.locator('.image-differences__slider')
	await expect(slider).toBeFocused()

	await page.keyboard.press('ArrowRight')
	await expect(slider).toHaveValue('51')
})
