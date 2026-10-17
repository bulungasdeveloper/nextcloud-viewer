/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IFolder } from '@nextcloud/files'

import { Folder } from '@nextcloud/files'
import { describe, expect, it, vi } from 'vitest'

const getDirectoryContents = vi.fn()
const getShareDirectoryContents = vi.fn()
const getClient = vi.hoisted(() => vi.fn())

vi.mock('@nextcloud/files/dav', () => ({
	getClient: (remoteURL?: string) => getClient(remoteURL) ?? (remoteURL === undefined ? { getDirectoryContents } : { getDirectoryContents: getShareDirectoryContents }),
	getDefaultPropfind: () => '',
	resultToNode: (stat: { basename: string, type?: string }) => ({
		basename: stat.basename,
		type: stat.type ?? 'file',
		attributes: {},
	}),
}))

const { fetchFolderContent } = await import('../lib/services/dav.ts')

/**
 * A folder to fetch, the path of which the fake client ignores.
 */
function folder(): IFolder {
	return { root: '/files/user', path: '/photos' } as IFolder
}

describe('fetchFolderContent', () => {
	it('orders the files the way the Files app does, not the way the server replied', async () => {
		// WebDAV gives no ordering guarantee, so the reply order here is
		// deliberately neither sorted nor reversed. Natural order (2 before
		// 10) is the Files comparator's, not a plain string sort
		getDirectoryContents.mockResolvedValue({
			data: [{ basename: 'img10.jpg' }, { basename: 'img2.jpg' }, { basename: 'img1.jpg' }],
		})

		const files = await fetchFolderContent(folder())
		expect(files.map((file) => file.basename)).toEqual(['img1.jpg', 'img2.jpg', 'img10.jpg'])
	})

	// A guest of a Talk conversation, say: the page's client would ask
	// remote.php/dav as a user they are not
	it('lists a folder from a public share through the share', async () => {
		getShareDirectoryContents.mockResolvedValue({ data: [{ basename: 'beach.jpg' }] })
		const shared = new Folder({ source: 'https://cloud.example.com/public.php/dav/files/abc123/holiday', root: '/files/abc123', owner: null })

		const files = await fetchFolderContent(shared)

		expect(getClient).toHaveBeenLastCalledWith('https://cloud.example.com/public.php/dav')
		expect(getShareDirectoryContents).toHaveBeenLastCalledWith('/files/abc123/holiday', expect.anything())
		expect(files.map((file) => file.basename)).toEqual(['beach.jpg'])
	})

	it('lists a folder from a share link through the share', async () => {
		getShareDirectoryContents.mockResolvedValue({ data: [{ basename: 'beach.jpg' }] })
		const shared = new Folder({ source: 'https://cloud.example.com/index.php/s/abc123?path=/holiday', root: '/index.php/s/abc123', owner: null })

		await fetchFolderContent(shared)

		expect(getShareDirectoryContents).toHaveBeenLastCalledWith('/files/abc123/holiday', expect.anything())
	})

	it('drops the folders, which the viewer has nothing to show for', async () => {
		getDirectoryContents.mockResolvedValue({
			data: [{ basename: 'a.jpg' }, { basename: 'sub', type: 'folder' }],
		})

		const files = await fetchFolderContent(folder())
		expect(files.map((file) => file.basename)).toEqual(['a.jpg'])
	})
})
