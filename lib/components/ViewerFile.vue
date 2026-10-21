<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div
		ref="root"
		class="viewer-file"
		:class="{
			'viewer-file--active': active || menuOpen,
			'viewer-file--said': status === 'none' || status === 'failed',
		}"
		@pointerdown="onPointerDown">
		<template v-if="file">
			<!-- Nothing can show it, or it failed to -->
			<template v-if="status === 'none' || status === 'failed'">
				<div v-if="fallback.length > 0" ref="fallbackHolder" class="viewer-file__fallback" />
				<div v-else class="viewer-file__card">
					<span class="viewer-file__type" aria-hidden="true">{{ extension }}</span>
					<span class="viewer-file__about">
						<span class="viewer-file__card-name">{{ file.displayname }}</span>
						<span class="viewer-file__card-meta">{{ meta }}</span>
					</span>
					<NcButton
						v-if="downloadable"
						class="viewer-file__download"
						variant="secondary"
						:aria-label="t('Download')"
						:title="t('Download')"
						@click="download">
						<template #icon>
							<DownloadIcon :size="20" />
						</template>
					</NcButton>
				</div>
			</template>

			<template v-else>
				<!-- The handlers are custom elements: they observe hyphenated
				     attributes, so camelCase bindings are lost whenever the element
				     is patched before it upgrades. -->
				<!-- eslint-disable vue/attribute-hyphenation -->
				<div class="viewer-file__handler">
					<component
						:is="tagName"
						v-if="tagName"
						v-show="status === 'shown'"
						ref="handlerElement"
						:file="file"
						:files="[file]"
						:max-width="width"
						:max-height="height"
						:is-sidebar-shown="false"
						:editing="false"
						:embedded="true"
						:shown="status === 'shown'"
						@loaded="onLoaded"
						@errored="onErrored" />
				</div>
				<!-- eslint-enable vue/attribute-hyphenation -->

				<span v-if="status === 'loading'" class="viewer-file__loading">
					<!-- The picture's colours, blurred, at the size it will take -->
					<span
						v-if="placeholder"
						class="viewer-file__placeholder"
						:style="{ width: `${placeholder.width}px`, height: `${placeholder.height}px` }">
						<NcBlurHash :hash="placeholder.hash" />
					</span>
					<NcLoadingIcon appearance="light" :size="28" />
				</span>

				<!-- A video waits behind its poster and one play button until
				     played, rather than its whole player over a small box -->
				<button
					v-if="status === 'shown' && poster !== undefined && !started"
					type="button"
					class="viewer-file__cover"
					:style="poster ? { backgroundImage: `url(${JSON.stringify(poster)})` } : undefined"
					:aria-label="t('Play')"
					@click="play">
					<span class="viewer-file__play">
						<PlayIcon :size="32" />
					</span>
				</button>

				<div v-if="status === 'shown'" class="viewer-file__bar">
					<span class="viewer-file__name">{{ file.displayname }}</span>
					<NcActions
						v-model:open="menuOpen"
						class="viewer-file__actions"
						placement="bottom-end"
						variant="tertiary-no-background"
						:aria-label="t('Actions')">
						<NcActionButton closeAfterClick @click="openInViewer">
							<template #icon>
								<FullscreenIcon :size="20" />
							</template>
							{{ t('Open in the viewer') }}
						</NcActionButton>
						<NcActionButton v-if="downloadable" closeAfterClick @click="download">
							<template #icon>
								<DownloadIcon :size="20" />
							</template>
							{{ t('Download') }}
						</NcActionButton>
					</NcActions>
				</div>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { IFile } from '@nextcloud/files'

import { formatFileSize } from '@nextcloud/files'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcBlurHash from '@nextcloud/vue/components/NcBlurHash'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import DownloadIcon from 'vue-material-design-icons/Download.vue'
import FullscreenIcon from 'vue-material-design-icons/Fullscreen.vue'
import PlayIcon from 'vue-material-design-icons/Play.vue'
import { logger } from '../services/logger.ts'
import { canDownload } from '../utils/canDownload.ts'
import { emittedValue } from '../utils/handlerEvents.ts'
import { t } from '../utils/l10n.ts'
import { blurhash, fitInto, photoSize } from '../utils/photoMetadata.ts'
import { getViewer } from '../viewer.ts'

const props = defineProps<{
	/** The file to show */
	file?: IFile
	/** The `<nc-viewer-file>` this is the view of, which tells the page */
	host: HTMLElement
	/** What the page put inside the element, shown when nothing can show the file */
	fallback: Node[]
}>()

/**
 * Where the file is at: its handler being found or it loading, shown,
 * failed, or no handler taking it at all
 */
const status = ref<'loading' | 'shown' | 'failed' | 'none'>('loading')
const tagName = ref<string>()

// Which file the handler was asked for, so a late answer for one replaced
// meanwhile is dropped
let asked: IFile | undefined
watch(() => props.file, async (file) => {
	asked = file
	tagName.value = undefined
	status.value = 'loading'
	if (file === undefined) {
		return
	}
	try {
		const found = await getViewer().elementFor(file)
		if (asked !== file) {
			return
		}
		tagName.value = found
		status.value = found === undefined ? 'none' : 'loading'
	} catch (error) {
		logger.error('Could not find what shows the file', { file, error })
		if (asked === file) {
			status.value = 'failed'
		}
	}
}, { immediate: true })

// The space the element was given, which the file is fitted into
const root = useTemplateRef<HTMLElement>('root')
const width = ref(0)
const height = ref(0)
const resizeObserver = new ResizeObserver(([entry]) => {
	width.value = Math.floor(entry!.contentRect.width)
	height.value = Math.floor(entry!.contentRect.height)
})
onMounted(() => resizeObserver.observe(root.value!))
onBeforeUnmount(() => resizeObserver.disconnect())

const placeholder = computed(() => {
	const file = props.file
	const hash = file && blurhash(file)
	const size = file && photoSize(file)
	if (hash === undefined || size === undefined || width.value === 0) {
		return undefined
	}
	return { hash, ...fitInto(size, width.value, height.value) }
})

const handlerElement = useTemplateRef<HTMLElement>('handlerElement')
// The video's poster, `''` for one without, nothing for a file that is no video
const poster = ref<string>()
// Whether the video was played, which its whole player is left to from then on
const started = ref(false)
watch(() => props.file, () => {
	poster.value = undefined
	started.value = false
})

/**
 * Play the video behind the cover, and leave it to its player.
 */
function play() {
	started.value = true
	void handlerElement.value?.querySelector('video')?.play()
}

/**
 * The handler's element has shown the file.
 */
function onLoaded() {
	poster.value = handlerElement.value?.querySelector('video')?.poster
	status.value = 'shown'
	props.host.dispatchEvent(new CustomEvent('loaded'))
}

/**
 * The handler's element could not show the file.
 *
 * @param reported - What it emitted
 */
function onErrored(reported: unknown) {
	const error = emittedValue(reported)
	logger.error('Could not show the file', { file: props.file, error })
	status.value = 'failed'
	props.host.dispatchEvent(new CustomEvent('errored', { detail: error }))
}

// What the page put inside the element, moved into the view when it is shown
const fallbackHolder = useTemplateRef<HTMLElement>('fallbackHolder')
watch(status, async () => {
	await nextTick()
	fallbackHolder.value?.append(...props.fallback)
})

const downloadable = computed(() => props.file !== undefined && canDownload(props.file))
const extension = computed(() => (props.file?.extension ?? '').replace(/^\./, '').toUpperCase().slice(0, 4))
const meta = computed(() => {
	const size = props.file?.size
	const parts = size === undefined ? [] : [formatFileSize(size)]
	return [...parts, t('No preview available')].join(' · ')
})

/**
 * Download the file through the browser.
 */
function download() {
	if (props.file === undefined) {
		return
	}
	const link = document.createElement('a')
	link.href = props.file.encodedSource
	link.download = props.file.basename
	document.body.append(link)
	link.click()
	link.remove()
}

/**
 * Open the file in the viewer, for the full screen and everything it offers.
 */
function openInViewer() {
	if (props.file !== undefined) {
		void getViewer().open([props.file], props.file)
	}
}

// The strip shows on hover and focus. Touch has neither: a tap on the file
// shows it, and the next one hides it
const active = ref(false)
const menuOpen = ref(false)

/**
 * A tap on the file, rather than on its strip, shows or hides the strip.
 *
 * @param event - The pointer going down
 */
function onPointerDown(event: PointerEvent) {
	if (event.pointerType === 'touch' && !(event.target as Element).closest('.viewer-file__bar')) {
		active.value = !active.value
	}
}
</script>

<style lang="scss">
// Sized by the page, as any block
nc-viewer-file {
	display: block;
	position: relative;
	overflow: hidden;
	border-radius: var(--border-radius-container, var(--border-radius-large));
}
</style>

<style scoped lang="scss">
.viewer-file {
	position: absolute;
	inset: 0;
	// Nothing in it draws over the page
	isolation: isolate;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #111;

	// The handler's own layers, the viewer's z-index of its players included,
	// stay under the strip and the cover
	&__handler {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		isolation: isolate;
	}

	&__cover,
	&__bar {
		z-index: 1;
	}

	&__loading,
	&__placeholder {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	&__loading {
		position: absolute;
		inset: 0;

		.loading-icon {
			position: absolute;
		}
	}

	&__placeholder canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	// The name and the menu, out of the way of a player's controls at the
	// bottom, and out of sight until wanted
	&__bar {
		position: absolute;
		inset: 0 0 auto 0;
		display: flex;
		align-items: center;
		gap: var(--default-grid-baseline);
		padding-block: var(--default-grid-baseline);
		padding-inline: calc(3 * var(--default-grid-baseline)) var(--default-grid-baseline);
		background: linear-gradient(rgba(0, 0, 0, .65), rgba(0, 0, 0, 0));
		color: #ffffff;
		font-weight: bold;
		opacity: 0;
		transition: opacity var(--animation-quick, 100ms);

		// On the dark strip whatever the theme
		--color-main-text: #ffffff;
	}

	&--active &__bar,
	&:focus-within &__bar {
		opacity: 1;
	}

	@media (hover: hover) {
		&:hover &__bar {
			opacity: 1;
		}
	}

	// Over the player, the size of the box, until the video is played
	&__cover {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: #111 center / contain no-repeat;
		cursor: pointer;
	}

	&__play {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background-color: rgba(0, 0, 0, .55);
		color: #ffffff;
	}

	&__cover:hover &__play,
	&__cover:focus-visible &__play {
		background-color: rgba(0, 0, 0, .75);
	}

	&__name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	// Nothing to show: no dark box, what the page put inside the element or
	// what the file is and the download, in a line
	&--said {
		background-color: transparent;
	}

	&__fallback {
		position: absolute;
		inset: 0;
	}

	&__card {
		box-sizing: border-box;
		width: 100%;
		background-color: var(--color-main-background);
		color: var(--color-main-text);
		display: flex;
		align-items: center;
		gap: calc(3 * var(--default-grid-baseline));
		padding: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-container, var(--border-radius-large));
	}

	&__type {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--border-radius-element, var(--border-radius));
		background-color: var(--color-primary-element-light);
		color: var(--color-primary-element-light-text);
		font-size: 11px;
		font-weight: bold;
	}

	&__about {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	&__card-name {
		color: var(--color-primary-element);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__card-name {
		font-weight: bold;
	}

	&__download {
		flex: none;
		border-radius: 50% !important;
	}

	&__card-meta {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small, 13px);
	}
}
</style>
