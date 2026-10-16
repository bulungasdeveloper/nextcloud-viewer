/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it } from 'vitest'
import { isLegacyServer } from '../lib/utils/legacyServer.ts'

afterEach(() => {
	delete window.OC
	delete window.OCA
})

describe('a server older than the library is made for', () => {
	it('is one still shipping the viewer app', () => {
		window.OCA = { Viewer: { registerHandler: () => {} } }
		expect(isLegacyServer()).toBe(true)
	})

	it('is one that says it is older', () => {
		window.OC = { config: { version: '35.0.2.1' } }
		expect(isLegacyServer()).toBe(true)
	})

	// The compatibility layer of 36 keeps OCA.Viewer, but not registerHandler
	it('is not 36, with its OCA.Viewer of old', () => {
		window.OC = { config: { version: '36.0.0.5' } }
		window.OCA = { Viewer: {} }
		expect(isLegacyServer()).toBe(false)
	})

	// The playground, or a page that says nothing of itself
	it('is not a page that says nothing', () => {
		expect(isLegacyServer()).toBe(false)
	})
})
