/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IFile } from '@nextcloud/files'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

// What the viewer answers: the element that shows a file, and opening it
const viewer = vi.hoisted(() => ({ elementFor: vi.fn(), open: vi.fn() }))
vi.mock('../../lib/viewer.ts', () => ({ getViewer: () => viewer }))

const { default: ViewerFile } = await import('../../lib/components/ViewerFile.vue')
const { makeFile } = await import('../factories.ts')

// A handler's element, keeping what it is given to read it back
class ShownElement extends HTMLElement {
	file?: IFile
	files?: IFile[]
	embedded?: boolean
	shown?: boolean
	maxWidth?: number
}
customElements.define('oca-viewer-embedded', ShownElement)

afterEach(() => {
	viewer.elementFor.mockReset()
	viewer.open.mockReset()
	document.body.innerHTML = ''
})

/**
 * Show a file as `<nc-viewer-file>` does.
 *
 * @param file - The file
 * @param tagName - The element the viewer names for it, none if nothing shows it
 * @param fallback - What the page put inside the element
 */
async function show(file: IFile, tagName?: string, fallback: Node[] = []) {
	viewer.elementFor.mockResolvedValue(tagName)
	const host = document.createElement('div')
	const wrapper = mount(ViewerFile, { props: { file, host, fallback }, attachTo: document.body })
	await flushPromises()
	const element = wrapper.find('oca-viewer-embedded').exists()
		? wrapper.find('oca-viewer-embedded').element as ShownElement
		: undefined
	return { wrapper, host, element }
}

describe('a file shown where it is mentioned', () => {
	it('is shown by the element of its handler, inline', async () => {
		const file = makeFile({ basename: 'beach.jpg' })
		const { element } = await show(file, 'oca-viewer-embedded')

		expect(viewer.elementFor).toHaveBeenCalledWith(file)
		expect(element!.file?.source).toBe(file.source)
		expect(element!.files?.map((shown) => shown.source)).toEqual([file.source])
		// Videos and sounds wait to be played
		expect(element!.embedded).toBe(true)
		expect(element!.shown).toBe(false)
	})

	it('is said to have loaded once its handler has', async () => {
		const { wrapper, host, element } = await show(makeFile({ basename: 'beach.jpg' }), 'oca-viewer-embedded')
		const loaded = vi.fn()
		host.addEventListener('loaded', loaded)
		expect(wrapper.find('.viewer-file__bar').exists()).toBe(false)

		element!.dispatchEvent(new CustomEvent('loaded'))
		await flushPromises()

		expect(loaded).toHaveBeenCalledOnce()
		expect(element!.shown).toBe(true)
		expect(wrapper.find('.viewer-file__name').text()).toBe('beach.jpg')
	})

	it('opens in the viewer from its menu', async () => {
		const file = makeFile({ basename: 'beach.jpg' })
		const { wrapper, element } = await show(file, 'oca-viewer-embedded')
		element!.dispatchEvent(new CustomEvent('loaded'))
		await flushPromises()

		await wrapper.find('.viewer-file__actions button').trigger('click')
		await flushPromises()
		const open = wrapper.findAllComponents({ name: 'NcActionButton' }).find((action) => action.text().includes('Open in the viewer'))
		await open!.vm.$emit('click')

		expect(viewer.open).toHaveBeenCalledOnce()
		const [files, shown] = viewer.open.mock.calls[0]!
		expect(files.map((opened: IFile) => opened.source)).toEqual([file.source])
		expect(shown.source).toBe(file.source)
	})
})

// The handler's whole player over a small box is a lot: a video waits behind
// its poster and one play button until played
describe('a video shown where it is mentioned', () => {
	/**
	 * Show a video, its handler's element holding a video with that poster.
	 *
	 * @param poster - The poster, none for a video without
	 */
	async function showVideo(poster?: string) {
		const shown = await show(makeFile({ basename: 'trailer.webm', mime: 'video/webm' }), 'oca-viewer-embedded')
		const video = document.createElement('video')
		if (poster) {
			video.poster = poster
		}
		video.play = vi.fn(async () => {})
		shown.element!.append(video)
		shown.element!.dispatchEvent(new CustomEvent('loaded'))
		await flushPromises()
		return { ...shown, video }
	}

	it('waits behind its poster', async () => {
		const { wrapper } = await showVideo('https://cloud.example.com/poster.jpg')
		const cover = wrapper.find('.viewer-file__cover')

		expect(cover.attributes('aria-label')).toBe('Play')
		expect(cover.attributes('style')).toContain('poster.jpg')
	})

	it('plays, and leaves its player to it, once the cover is clicked', async () => {
		const { wrapper, video } = await showVideo()

		await wrapper.find('.viewer-file__cover').trigger('click')

		expect(video.play).toHaveBeenCalledOnce()
		expect(wrapper.find('.viewer-file__cover').exists()).toBe(false)
	})

	it('is no cover over a picture', async () => {
		const { wrapper, element } = await show(makeFile({ basename: 'beach.jpg' }), 'oca-viewer-embedded')
		element!.dispatchEvent(new CustomEvent('loaded'))
		await flushPromises()

		expect(wrapper.find('.viewer-file__cover').exists()).toBe(false)
	})
})

describe('a file nothing shows', () => {
	it('says so, with its name, its size and the download', async () => {
		const { wrapper } = await show(makeFile({ basename: 'report.zip', mime: 'application/zip', size: 4404019 }))

		expect(wrapper.find('.viewer-file__type').text()).toBe('ZIP')
		expect(wrapper.find('.viewer-file__card-name').text()).toBe('report.zip')
		expect(wrapper.find('.viewer-file__card-meta').text()).toBe('4.2 MB · No preview available')
		expect(wrapper.find('button[aria-label="Download"]').exists()).toBe(true)
	})

	it('offers no download where its share forbids it', async () => {
		const file = makeFile({ basename: 'report.zip', mime: 'application/zip', attributes: { 'hide-download': true } })
		const { wrapper } = await show(file)

		expect(wrapper.find('.viewer-file__card').exists()).toBe(true)
		expect(wrapper.find('button[aria-label="Download"]').exists()).toBe(false)
	})

	it('shows what the page put inside instead', async () => {
		const link = document.createElement('a')
		link.textContent = 'report.zip'
		const { wrapper } = await show(makeFile({ basename: 'report.zip', mime: 'application/zip' }), undefined, [link])

		expect(wrapper.find('.viewer-file__card').exists()).toBe(false)
		expect(wrapper.find('.viewer-file__fallback').element.contains(link)).toBe(true)
	})

	it('says so as well when its handler fails to show it', async () => {
		const { wrapper, host, element } = await show(makeFile({ basename: 'beach.jpg' }), 'oca-viewer-embedded')
		const errored = vi.fn()
		host.addEventListener('errored', errored)

		element!.dispatchEvent(new CustomEvent('errored', { detail: [new Error('broken')] }))
		await flushPromises()

		expect(errored).toHaveBeenCalledOnce()
		expect(wrapper.find('.viewer-file__card-name').text()).toBe('beach.jpg')
	})
})

describe('another file given', () => {
	it('is asked for, and a late answer for the one before is dropped', async () => {
		let answerFirst!: (tag: string | undefined) => void
		viewer.elementFor.mockReturnValueOnce(new Promise((resolve) => {
			answerFirst = resolve
		}))
		const host = document.createElement('div')
		const first = makeFile({ basename: 'first.jpg' })
		const wrapper = mount(ViewerFile, { props: { file: first, host, fallback: [] } })

		viewer.elementFor.mockResolvedValueOnce(undefined)
		await wrapper.setProps({ file: makeFile({ basename: 'second.zip', mime: 'application/zip' }) })
		await flushPromises()
		answerFirst('oca-viewer-embedded')
		await flushPromises()

		expect(wrapper.find('oca-viewer-embedded').exists()).toBe(false)
		expect(wrapper.find('.viewer-file__card-name').text()).toBe('second.zip')
	})
})

// Touch has no hover: a tap on the file shows its name and menu
describe('a tap on the file', () => {
	it('shows its strip, and the next one hides it', async () => {
		const { wrapper } = await show(makeFile({ basename: 'beach.jpg' }), 'oca-viewer-embedded')
		const root = wrapper.find('.viewer-file')

		await root.trigger('pointerdown', { pointerType: 'touch' })
		expect(root.classes()).toContain('viewer-file--active')
		await root.trigger('pointerdown', { pointerType: 'touch' })
		expect(root.classes()).not.toContain('viewer-file--active')
	})

	it('is not a mouse click', async () => {
		const { wrapper } = await show(makeFile({ basename: 'beach.jpg' }), 'oca-viewer-embedded')
		const root = wrapper.find('.viewer-file')

		await root.trigger('pointerdown', { pointerType: 'mouse' })
		expect(root.classes()).not.toContain('viewer-file--active')
	})
})
