/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IFile } from '@nextcloud/files'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@nextcloud/event-bus')
vi.mock('../../lib/services/dav.ts', () => ({ fetchFolderContent: vi.fn(async () => []) }))
// What the viewer is told once a turn is in the file
const written = vi.hoisted(() => ({ callback: undefined as ((node: IFile) => void) | undefined }))
vi.mock('../../lib/composables/useRotation.ts', () => ({
	useRotation: (_file: unknown, onWritten: (node: IFile) => void) => {
		written.callback = onWritten
		return { canRotate: ref(true), rotateLeft: vi.fn(), saving: ref(false), turns: ref(0) }
	},
}))

const { makeFile, makeHandler } = await import('../factories.ts')
const { mountViewer, unmountViewers } = await import('./mountViewer.ts')

afterEach(() => {
	unmountViewers()
	vi.useRealTimers()
})

/**
 * Open a picture, and tell the viewer a turn of it was written.
 *
 * @param writtenFile - The file the turn was written to, the one shown if none
 */
async function writeTurn(writtenFile?: IFile) {
	const { vm, wrapper } = mountViewer([makeHandler({ id: 'image', tagName: 'oca-viewer-image', enabled: () => true })])
	const file = makeFile({ mime: 'image/jpeg' })
	await vm.open([file], file)
	await flushPromises()
	vi.useFakeTimers()
	written.callback!(writtenFile ?? file)
	await wrapper.vm.$nextTick()
	return wrapper
}

describe('a turn written to the file', () => {
	it('is said briefly in the corner', async () => {
		const wrapper = await writeTurn()
		expect(wrapper.find('.viewer__rotated[role="status"]').text()).toBe('Rotation saved')

		vi.advanceTimersByTime(1200)
		await wrapper.vm.$nextTick()
		expect(wrapper.find('.viewer__rotated').exists()).toBe(false)
	})

	// The user has moved on: the check would be about a picture not shown
	it('is not said for a file no longer shown', async () => {
		const wrapper = await writeTurn(makeFile({ mime: 'image/jpeg' }))
		expect(wrapper.find('.viewer__rotated').exists()).toBe(false)
	})
})
