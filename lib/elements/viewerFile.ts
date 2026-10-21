/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { IFile } from '@nextcloud/files'

import { defineCustomElementOnce } from '../utils/customElements.ts'

/** The element that shows a file where it is mentioned, outside the viewer */
export const VIEWER_FILE_TAG = 'nc-viewer-file'

/** What the view of the element is driven by, once it is loaded */
export interface ViewerFileView {
	/** Show another file */
	update(file: IFile | undefined): void
	/** Take the view down */
	unmount(): void
}

/**
 * `<nc-viewer-file>`: shows a file, as the viewer would, wherever it is put.
 *
 * Set its `file` property and size it with CSS. It finds the handler that
 * shows the file and renders its element inside, sized to its own box, with a
 * strip naming the file and offering to open it in the viewer or download it.
 * When nothing can show the file, or it fails to, it says so with a card
 * offering the download, or shows what the page put inside it instead. It
 * dispatches `loaded` and `errored` as handlers do.
 *
 * A plain element rather than a Vue one: it is defined on every page the
 * library is on, and only fetches its view once one is actually connected.
 */
export class ViewerFileElement extends HTMLElement {
	#file: IFile | undefined
	#fallback: Node[] | undefined
	#view: ViewerFileView | undefined
	#mounting = false

	/** The file shown */
	get file(): IFile | undefined {
		return this.#file
	}

	set file(file: IFile | undefined) {
		this.#file = file
		this.#view?.update(file)
	}

	connectedCallback(): void {
		// What the page put inside: shown when nothing can show the file
		if (this.#fallback === undefined) {
			// Copied first: removing them empties the live list as it is read
			this.#fallback = Array.from(this.childNodes)
			for (const node of this.#fallback) {
				this.removeChild(node)
			}
		}
		void this.#mount()
	}

	disconnectedCallback(): void {
		this.#view?.unmount()
		this.#view = undefined
	}

	async #mount(): Promise<void> {
		if (this.#view !== undefined || this.#mounting) {
			return
		}
		this.#mounting = true
		try {
			const { mountViewerFile } = await import('./mountViewerFile.ts')
			const view = await mountViewerFile(this, this.#file, this.#fallback ?? [])
			// Taken off the page meanwhile
			if (!this.isConnected) {
				view.unmount()
				return
			}
			// The file it was given meanwhile
			view.update(this.#file)
			this.#view = view
		} finally {
			this.#mounting = false
		}
	}
}

/**
 * Define `<nc-viewer-file>`, once for every copy of the library on the page.
 */
export function defineViewerFileElement(): void {
	defineCustomElementOnce(VIEWER_FILE_TAG, ViewerFileElement)
}

declare global {
	interface HTMLElementTagNameMap {
		'nc-viewer-file': ViewerFileElement
	}
}
