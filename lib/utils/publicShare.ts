/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { INode } from '@nextcloud/files'

/** The public share a node is reached through */
export interface PublicShare {
	/** The share's token */
	token: string
	/** The WebDAV endpoint of public shares, which its files are under */
	remoteURL: string
	/** Where the node is in the share, `/` for the share itself */
	path: string
}

// /public.php/dav/files/<token>, then the path in the share
const PUBLIC_DAV_PATH = /^(.*)\/public\.php\/dav\/files\/([^/]+)(\/.*)?$/
// /s/<token>, /s/<token>/download/<name>, or /s/<token>/download?path=…&files=<name>
const SHARE_LINK_PATH = /^(.*?)(?:\/index\.php)?\/s\/([^/]+)(?:\/download(?:\/(.+))?)?\/?$/

/**
 * The public share a node's address is in, whatever page it is shown on:
 * another app can hand the viewer files it took from a share, as Talk does
 * for a guest. Both forms a share has: its WebDAV address,
 * `/public.php/dav/files/<token>/…`, and its link, `/s/<token>…`, where
 * `?path=` names the folder a file is in.
 *
 * @param node - The file or folder
 */
export function publicShareOf(node: INode): PublicShare | undefined {
	// Encoded, so a # or a ? in a name stays part of the path
	const davURL = parse(node.encodedSource)
	const dav = davURL && PUBLIC_DAV_PATH.exec(davURL.pathname)
	if (davURL && dav) {
		return {
			token: decodeURIComponent(dav[2]!),
			remoteURL: `${davURL.origin}${dav[1]}/public.php/dav`,
			path: decodeURIComponent(dav[3] ?? '/'),
		}
	}

	// As it is, as the folder of a file in a share link is in its query
	const url = parse(node.source)
	const link = url && SHARE_LINK_PATH.exec(url.pathname)
	if (url && link) {
		const folder = (url.searchParams.get('path') ?? '').replace(/\/$/, '')
		const name = link[3] !== undefined ? decodeURIComponent(link[3]) : url.searchParams.get('files')
		return {
			token: decodeURIComponent(link[2]!),
			remoteURL: `${url.origin}${link[1]}/public.php/dav`,
			path: name ? `${folder}/${name}` : (folder || '/'),
		}
	}

	return undefined
}

/**
 * @param address - The address to read
 */
function parse(address: string): URL | undefined {
	try {
		return new URL(address)
	} catch {
		return undefined
	}
}
