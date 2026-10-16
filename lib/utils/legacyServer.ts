/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** The first Nextcloud whose server is made for this library */
const FIRST_SUPPORTED_MAJOR = 36

/**
 * Whether the page comes from a Nextcloud older than this library is made
 * for: one still shipping the viewer app, whose `OCA.Viewer` has a
 * `registerHandler()` that the compatibility layer of 36 does not, or one
 * that says it is older.
 */
export function isLegacyServer(): boolean {
	if (typeof window.OCA?.Viewer?.registerHandler === 'function') {
		return true
	}
	const major = Number.parseInt(window.OC?.config?.version ?? '', 10)
	return major > 0 && major < FIRST_SUPPORTED_MAJOR
}
