/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IHandler } from '../lib/index.ts'

import { flushPromises } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { makeFile } from './factories.ts'

vi.mock('../lib/components/Images.vue', () => ({ default: { name: 'Images', render: () => null } }))

// jsdom has no decode(), which is the browser saying whether it can
beforeAll(() => {
	HTMLImageElement.prototype.decode = () => Promise.reject(new DOMException('', 'EncodingError'))
})

afterAll(() => {
	// @ts-expect-error -- put back what jsdom had: nothing
	delete HTMLImageElement.prototype.decode
})

/**
 * The image handler, registered in a browser that decodes JPEG XL or not
 *
 * @param decodes - Whether the browser decodes it
 */
async function imageHandler(decodes: boolean): Promise<IHandler> {
	const decode = vi.spyOn(HTMLImageElement.prototype, 'decode')
	decode.mockImplementation(() => decodes ? Promise.resolve() : Promise.reject(new DOMException('', 'EncodingError')))

	vi.resetModules()
	const { registerImageHandler } = await import('../lib/models/images.ts')
	const { getHandlers } = await import('../lib/index.ts')
	registerImageHandler()
	await flushPromises()
	return getHandlers().get('images')!
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('JPEG XL', () => {
	it('opens where the browser decodes it', async () => {
		const handler = await imageHandler(true)

		expect(handler.enabled([makeFile({ mime: 'image/jxl' })])).toBe(true)
	})

	it('is left to download where the browser does not', async () => {
		const handler = await imageHandler(false)

		expect(handler.enabled([makeFile({ mime: 'image/jxl' })])).toBe(false)
		// Nothing else changes for the other images
		expect(handler.enabled([makeFile({ mime: 'image/jpeg' })])).toBe(true)
	})

	it('is tried with a JPEG XL image', async () => {
		const { canDecodeJxl } = await import('../lib/models/images.ts')
		const decode = vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()

		await canDecodeJxl()

		expect((decode.mock.contexts[0] as HTMLImageElement).src).toMatch(/^data:image\/jxl;base64,/)
	})
	it('is not offered where the browser cannot even tell', async () => {
		vi.resetModules()
		const { canDecodeJxl } = await import('../lib/models/images.ts')
		const decode = HTMLImageElement.prototype.decode
		// @ts-expect-error -- a browser, or jsdom, without decode()
		delete HTMLImageElement.prototype.decode

		await expect(canDecodeJxl()).resolves.toBe(false)
		HTMLImageElement.prototype.decode = decode
	})
})
