/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { getHandlers } from '../lib/handlers.ts'
import { registerAudioHandler } from '../lib/models/audios.ts'
import { registerImageHandler } from '../lib/models/images.ts'
import { registerSheetmusicHandler } from '../lib/models/sheetmusic.ts'
import { registerVideoHandler } from '../lib/models/videos.ts'
import { getViewer } from '../lib/viewer.ts'
import { makeFile } from './factories.ts'

// Each test starts on an empty registry
beforeEach(() => {
	registerAudioHandler()
	registerVideoHandler()
	registerImageHandler()
	registerSheetmusicHandler()
})

// <nc-viewer-file> shows them outside the viewer, which defined their
// elements only as it mounted
describe('the default handlers', () => {
	it.each(['images', 'videos', 'audios', 'sheetmusic'])('%s define their element when first needed', (id) => {
		expect(getHandlers().get(id)?.onInit).toBeTypeOf('function')
	})

	it('have their element defined before it is named', async () => {
		expect(customElements.get('oca-viewer-image')).toBeUndefined()

		expect(await getViewer().elementFor(makeFile({ mime: 'image/jpeg' }))).toBe('oca-viewer-image')
		expect(customElements.get('oca-viewer-image')).toBeDefined()
	})
})
