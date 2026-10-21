/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The view, which the element only fetches once it is on the page
const view = vi.hoisted(() => ({ update: vi.fn(), unmount: vi.fn() }))
const mountViewerFile = vi.hoisted(() => vi.fn(async () => view))
vi.mock('../lib/elements/mountViewerFile.ts', () => ({ mountViewerFile }))

const { defineViewerFileElement } = await import('../lib/elements/viewerFile.ts')
const { makeFile } = await import('./factories.ts')
defineViewerFileElement()

afterEach(() => {
	document.body.innerHTML = ''
	vi.clearAllMocks()
})

describe('<nc-viewer-file>', () => {
	it('fetches nothing until it is on the page', () => {
		document.createElement('nc-viewer-file').file = makeFile()
		expect(mountViewerFile).not.toHaveBeenCalled()
	})

	it('shows its file, and the next one it is given', async () => {
		const element = document.createElement('nc-viewer-file')
		const first = makeFile({ basename: 'first.jpg' })
		element.file = first
		document.body.append(element)
		await flushPromises()
		expect(mountViewerFile).toHaveBeenCalledWith(element, first, [])

		const second = makeFile({ basename: 'second.jpg' })
		element.file = second
		expect(view.update).toHaveBeenLastCalledWith(second)
	})

	// Shown when nothing can show the file
	it('keeps what the page put inside for its view', async () => {
		const element = document.createElement('nc-viewer-file')
		const link = document.createElement('a')
		const text = document.createTextNode(' and more')
		element.append(link, text)
		document.body.append(element)
		await flushPromises()

		expect(mountViewerFile).toHaveBeenCalledWith(element, undefined, [link, text])
		expect(element.contains(link)).toBe(false)
	})

	it('takes its view down once off the page', async () => {
		const element = document.createElement('nc-viewer-file')
		document.body.append(element)
		await flushPromises()

		element.remove()
		expect(view.unmount).toHaveBeenCalledOnce()
	})

	it('drops a view that arrives once it is off the page already', async () => {
		const element = document.createElement('nc-viewer-file')
		document.body.append(element)
		element.remove()
		await flushPromises()

		expect(view.unmount).toHaveBeenCalledOnce()
	})
})
