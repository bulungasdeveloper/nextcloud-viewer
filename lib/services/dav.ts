/*!
 * SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { IFile, IFolder } from '@nextcloud/files'
import type { FileStat, ResponseDataDetailed, WebDAVClient } from 'webdav'
import type { PublicShare } from '../utils/publicShare.ts'

import { FileType, sortNodes } from '@nextcloud/files'
import { getClient, getDefaultPropfind, resultToNode } from '@nextcloud/files/dav'
import { publicShareOf } from '../utils/publicShare.ts'
import { getSortingConfig } from './sortingConfig.ts'

export const client = getClient()

// The ones for the public shares a folder was reached through, by endpoint
const shareClients = new Map<string, WebDAVClient>()

/**
 * The client to list a folder with: the page's, or the public shares' one
 * for a folder in a share outside a Files share page, which the page's
 * would ask as the logged-in user that a guest is not.
 *
 * @param share - The public share the folder is in, if it is in one
 */
function clientFor(share: PublicShare | undefined): WebDAVClient {
	if (share === undefined) {
		return client
	}
	let shareClient = shareClients.get(share.remoteURL)
	if (shareClient === undefined) {
		shareClient = getClient(share.remoteURL)
		shareClients.set(share.remoteURL, shareClient)
	}
	return shareClient
}

/**
 * The list is ordered the way the user has their files list ordered. Callers
 * that already have a list pass it to `open()` and keep their own order; only
 * `openFolder()` builds the list here, and it asks the files list how it is
 * sorted rather than assuming. Leaving the WebDAV order would step through the
 * files in whatever order the server happened to reply.
 *
 * @param folder - The folder whose file contents should be fetched
 * @param signal - Drops the listing when the viewer has moved on
 */
export async function fetchFolderContent(folder: IFolder, signal?: AbortSignal): Promise<IFile[]> {
	const propfindPayload = getDefaultPropfind()
	const share = publicShareOf(folder)
	// Where a share's link leaves it, its WebDAV path
	const path = share ? `/files/${share.token}${share.path === '/' ? '' : share.path}` : `${folder.root}${folder.path}`
	const result = (await clientFor(share).getDirectoryContents(path, {
		details: true,
		data: propfindPayload,
		signal,
	})) as ResponseDataDetailed<Array<FileStat>>

	const files = result.data
		.map((node) => resultToNode(node))
		.filter((node) => node.type === FileType.File)

	return sortNodes(files, await getSortingConfig()) as IFile[]
}
