/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFile } from './factories.ts'

const dav = vi.hoisted(() => ({ properties: [] as string[] }))
vi.mock('@nextcloud/files/dav', () => ({
	getDavProperties: () => dav.properties.join(' '),
	registerDavProperty: vi.fn((property: string) => dav.properties.push(property)),
}))

const { blurhash, fitInto, photoSize, requestPhotoSize } = await import('../lib/utils/photoMetadata.ts')
const { registerDavProperty } = await import('@nextcloud/files/dav')

beforeEach(() => {
	dav.properties = []
	vi.mocked(registerDavProperty).mockClear()
})

describe('the size of a picture', () => {
	it('is the one the Photos app recorded', () => {
		expect(photoSize(makeFile({ attributes: { 'metadata-photos-size': { width: 4000, height: 3000 } } }))).toEqual({ width: 4000, height: 3000 })
	})

	// As the DAV answer can carry them
	it('reads numbers written as text', () => {
		expect(photoSize(makeFile({ attributes: { 'metadata-photos-size': { width: '4000', height: '3000' } } }))).toEqual({ width: 4000, height: 3000 })
	})

	it.each([
		['not recorded', undefined],
		['half recorded', { width: 4000 }],
		['empty', { width: 0, height: 0 }],
	])('is unknown when %s', (_, size) => {
		expect(photoSize(makeFile({ attributes: { 'metadata-photos-size': size } }))).toBeUndefined()
	})

	it('is asked of the server once, with the Files list', () => {
		requestPhotoSize()
		requestPhotoSize()

		expect(registerDavProperty).toHaveBeenCalledExactlyOnceWith('nc:metadata-photos-size')
	})
})

describe('the blurhash of a picture', () => {
	it('is the one the server keeps', () => {
		expect(blurhash(makeFile({ attributes: { 'metadata-blurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' } }))).toBe('LEHV6nWB2yk8pyo0adR*.7kCMdnj')
	})

	it('is unknown when empty', () => {
		expect(blurhash(makeFile({ attributes: { 'metadata-blurhash': '' } }))).toBeUndefined()
	})
})

describe('fitting a size into a space', () => {
	it.each([
		['a landscape picture into a wider screen', { width: 4000, height: 2000 }, 1024, 768, { width: 1024, height: 512 }],
		['a portrait picture', { width: 3000, height: 4000 }, 1024, 768, { width: 576, height: 768 }],
		['a small picture, enlarged as it is shown', { width: 100, height: 50 }, 1024, 768, { width: 1024, height: 512 }],
	])('fits %s', (_, size, maxWidth, maxHeight, fitted) => {
		expect(fitInto(size, maxWidth, maxHeight)).toEqual(fitted)
	})
})
