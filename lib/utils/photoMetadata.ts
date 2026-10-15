/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { INode } from '@nextcloud/files'

import { getDavProperties, registerDavProperty } from '@nextcloud/files/dav'

/** A picture's width and height */
export interface Size {
	width: number
	height: number
}

/** The size of a picture, which the Photos app records */
const PHOTOS_SIZE_PROPERTY = 'nc:metadata-photos-size'

/**
 * Have the Files list ask the server for the size of each picture.
 *
 * Files already asks for its blurhash.
 */
export function requestPhotoSize(): void {
	if (!getDavProperties().includes(PHOTOS_SIZE_PROPERTY)) {
		registerDavProperty(PHOTOS_SIZE_PROPERTY)
	}
}

/**
 * The size of a picture as it is shown, its EXIF rotation applied.
 *
 * Only there once the Photos app has read the file. Photos also hands out
 * a size of its own making for a file it has not read yet, so it is what
 * the picture may be, not what it is.
 *
 * @param node - The picture
 */
export function photoSize(node: INode): Size | undefined {
	const size = node.attributes['metadata-photos-size'] as Partial<Record<keyof Size, number | string>> | undefined
	const width = Number(size?.width)
	const height = Number(size?.height)
	return width > 0 && height > 0 ? { width, height } : undefined
}

/**
 * The blurhash the server keeps of a picture.
 *
 * @param node - The picture
 */
export function blurhash(node: INode): string | undefined {
	const hash = node.attributes['metadata-blurhash']
	return typeof hash === 'string' && hash !== '' ? hash : undefined
}

/**
 * The largest box of the same proportions that fits the space.
 *
 * @param size - The size to fit
 * @param maxWidth - The width there is
 * @param maxHeight - The height there is
 */
export function fitInto(size: Size, maxWidth: number, maxHeight: number): Size {
	const ratio = Math.min(maxHeight / size.height, maxWidth / size.width)
	return {
		width: Math.floor(size.width * ratio),
		height: Math.floor(size.height * ratio),
	}
}
