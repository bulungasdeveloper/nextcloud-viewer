/*!
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// A page someone is logged in to, as the server renders it. Set before any
// module reads it: @nextcloud/auth keeps the first answer. A test about a
// guest mocks getCurrentUser() instead.
document.head.setAttribute('data-user', 'admin')
