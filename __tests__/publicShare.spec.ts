/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { File } from '@nextcloud/files'
import { describe, expect, it } from 'vitest'
import { publicShareOf } from '../lib/utils/publicShare.ts'

/**
 * A file at an address, as an app hands it to the viewer
 *
 * @param source - Its address
 * @param root - The part of the address it is relative to
 */
function file(source: string, root: string): File {
	return new File({ source, root, mime: 'image/jpeg', owner: null })
}

describe('the public share a file is in, from its WebDAV address', () => {
	it('is the one its address is under, with its path in the share', () => {
		expect(publicShareOf(file('https://cloud.example.com/public.php/dav/files/abc123/holiday/beach.jpg', '/files/abc123'))).toEqual({
			token: 'abc123',
			remoteURL: 'https://cloud.example.com/public.php/dav',
			path: '/holiday/beach.jpg',
		})
	})

	// A file shared alone is the share's root
	it('is the share itself for a file shared alone', () => {
		expect(publicShareOf(file('https://cloud.example.com/public.php/dav/files/abc123', '/files/abc123'))).toMatchObject({ token: 'abc123', path: '/' })
	})

	it('keeps a # or a ? in a name', () => {
		expect(publicShareOf(file('https://cloud.example.com/public.php/dav/files/abc123/a #1?.jpg', '/files/abc123'))?.path).toBe('/a #1?.jpg')
	})

	it('is under the address of a server in a subfolder', () => {
		expect(publicShareOf(file('https://example.com/nextcloud/public.php/dav/files/abc123/a.jpg', '/files/abc123'))?.remoteURL).toBe('https://example.com/nextcloud/public.php/dav')
	})

	it('is none for a user\'s file', () => {
		expect(publicShareOf(file('https://cloud.example.com/remote.php/dav/files/alice/a.jpg', '/files/alice'))).toBeUndefined()
	})
})

// The links Talk hands a guest (nextcloud-libraries/nextcloud-viewer#146):
// a share for each file, or one folder share for each user, in which a
// file at the top has no ?path= and one in a subfolder does
describe('the public share a file is in, from its link', () => {
	it.each([
		['a file shared alone, or at the top of a shared folder', 'https://cloud.example.com/index.php/s/abc123/download/beach.jpg', '/index.php/s/abc123', '/beach.jpg'],
		['a file in a subfolder of a shared folder', 'https://cloud.example.com/index.php/s/abc123/download/beach.jpg?path=/holiday', '/index.php/s/abc123', '/holiday/beach.jpg'],
		['a file named in the query', 'https://cloud.example.com/index.php/s/abc123/download?path=/holiday/&files=beach.jpg', '/index.php/s/abc123', '/holiday/beach.jpg'],
		['a link without index.php', 'https://cloud.example.com/s/abc123/download/beach.jpg', '/s/abc123', '/beach.jpg'],
		['the shared folder itself', 'https://cloud.example.com/index.php/s/abc123', '/index.php/s/abc123', '/'],
		['a subfolder of it', 'https://cloud.example.com/index.php/s/abc123?path=/holiday', '/index.php/s/abc123', '/holiday'],
	])('is found for %s', (_, source, root, path) => {
		expect(publicShareOf(file(source, root))).toEqual({
			token: 'abc123',
			remoteURL: 'https://cloud.example.com/public.php/dav',
			path,
		})
	})

	it('is under the address of a server in a subfolder', () => {
		expect(publicShareOf(file('https://example.com/nextcloud/index.php/s/abc123/download/a.jpg', '/nextcloud/index.php/s/abc123'))?.remoteURL).toBe('https://example.com/nextcloud/public.php/dav')
	})

	it('decodes the name', () => {
		expect(publicShareOf(file('https://cloud.example.com/index.php/s/abc123/download/beach%20day.jpg', '/index.php/s/abc123'))?.path).toBe('/beach day.jpg')
	})
})
