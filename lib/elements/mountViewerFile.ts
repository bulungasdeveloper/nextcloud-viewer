/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IFile } from '@nextcloud/files'
import type { ViewerFileView } from './viewerFile.ts'

import { createApp, h, markRaw, shallowRef } from 'vue'
import ViewerFile from '../components/ViewerFile.vue'
import { loadTranslations } from '../utils/l10n.ts'

/**
 * Mount the view of a `<nc-viewer-file>` inside it, once the strings it
 * shows can be translated.
 *
 * @param host - The element
 * @param file - The file to show
 * @param fallback - What the page put inside the element, shown when nothing can show the file
 */
export async function mountViewerFile(host: HTMLElement, file: IFile | undefined, fallback: Node[]): Promise<ViewerFileView> {
	await loadTranslations()
	const shown = shallowRef(file && markRaw(file))
	const container = document.createElement('div')
	container.className = 'nc-viewer-file__root'
	host.append(container)

	const app = createApp({
		render: () => h(ViewerFile, { file: shown.value, host, fallback }),
	})
	app.mount(container)

	return {
		update(next) {
			shown.value = next && markRaw(next)
		},
		unmount() {
			app.unmount()
			container.remove()
		},
	}
}
