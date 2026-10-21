/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageDifferences from '../../lib/components/ImageDifferences.vue'
import Images from '../../lib/components/Images.vue'
import { makeFile } from '../factories.ts'

/**
 * Two versions of a picture, with the previews the versions tab gives them
 */
function twoVersions() {
	const older = makeFile({ basename: 'photo.jpg', mime: 'image/jpeg', attributes: { previewUrl: '/preview/older' } })
	const current = makeFile({ basename: 'photo.jpg', mime: 'image/jpeg', attributes: { previewUrl: '/preview/current' } })
	return [older, current]
}

function mountDifferences() {
	return mount(ImageDifferences, { props: { files: twoVersions(), maxWidth: 800, maxHeight: 600 } })
}

describe('the differences between two images', () => {
	it('shows the other one over the base, cut at the slider', async () => {
		const wrapper = mountDifferences()
		const [base, other] = wrapper.findAll('img')

		expect(base!.attributes('src')).toBe('/preview/older')
		expect(other!.attributes('src')).toBe('/preview/current')
		expect(other!.attributes('style')).toContain('inset(0 0 0 50%)')

		await wrapper.find('input[type="range"]').setValue('20')
		expect(other!.attributes('style')).toContain('inset(0 0 0 20%)')
	})

	it('is loaded once both images are', async () => {
		const wrapper = mountDifferences()
		const [base, other] = wrapper.findAll('img')

		await base!.trigger('load')
		expect(wrapper.emitted('loaded')).toBeUndefined()
		await other!.trigger('load')
		expect(wrapper.emitted('loaded')).toHaveLength(1)
	})

	it('fails once when an image cannot be shown', async () => {
		const wrapper = mountDifferences()
		const [base, other] = wrapper.findAll('img')

		await base!.trigger('error')
		await other!.trigger('error')
		expect(wrapper.emitted('errored')).toHaveLength(1)
	})

	// Dragging the slider would otherwise step to another file
	it('keeps the viewer from swiping', () => {
		expect(mountDifferences().emitted('update:canSwipe')).toEqual([[false]])
	})

	it('is what the image handler shows for the differences, without loading the file on its own', () => {
		const files = twoVersions()
		const wrapper = mount(Images, { props: { file: files[1]!, files, comparison: 'differences', maxWidth: 800, maxHeight: 600, editing: false, isSidebarShown: false } })

		expect(wrapper.findComponent(ImageDifferences).exists()).toBe(true)
		expect(wrapper.find('.image_container').exists()).toBe(false)
	})
})

// They would cover what is being compared
describe('the names of the two, under a finger', () => {
	it('make way while the slider is held', async () => {
		const wrapper = mountDifferences()
		const slider = wrapper.find('input[type="range"]')

		await slider.trigger('pointerdown')
		expect(wrapper.classes()).toContain('image-differences--touched')

		await slider.trigger('pointerup')
		expect(wrapper.classes()).not.toContain('image-differences--touched')
	})

	it('come back when the touch is taken over', async () => {
		const wrapper = mountDifferences()
		const slider = wrapper.find('input[type="range"]')

		await slider.trigger('pointerdown')
		await slider.trigger('pointercancel')
		expect(wrapper.classes()).not.toContain('image-differences--touched')
	})
})

// The arrows move the slider: a comparison has no files to step through
describe('the keyboard, once both images are on screen', () => {
	it('goes to the slider', async () => {
		const wrapper = mount(ImageDifferences, { props: { files: twoVersions(), maxWidth: 800, maxHeight: 600, shown: false }, attachTo: document.body })
		expect(document.activeElement).toBe(document.body)

		await wrapper.setProps({ shown: true })
		expect(document.activeElement).toBe(wrapper.find('input[type="range"]').element)
		wrapper.unmount()
	})

	it('is passed on by the image handler', async () => {
		const files = twoVersions()
		const wrapper = mount(Images, { props: { file: files[1]!, files, comparison: 'differences', maxWidth: 800, maxHeight: 600, editing: false, isSidebarShown: false, shown: true }, attachTo: document.body })
		await flushPromises()

		expect(wrapper.findComponent(ImageDifferences).props('shown')).toBe(true)
		wrapper.unmount()
	})
})
