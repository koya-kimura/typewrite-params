// auth.js
// Minimal auth + submission client for the Flow Vol8 backend described in README_server.md
// - login(id, password) -> { token, csrf, expiresAt, user }
// - postArt(payload, session?) -> upsert parameters + optional thumbnail

/**
 * @typedef {Object} Session
 * @property {string} token        // Bearer token for Authorization header
 * @property {string} csrf         // CSRF token to include in 'x-csrf-token' for POST/DELETE
 * @property {string} [expiresAt]  // ISO string when session expires (informational)
 * @property {{ id: string, admin?: boolean }} [user]
 */

/**
 * @typedef {Object} ArtParameters
 * @property {number} [floatA]
 * @property {number} [floatB]
 * @property {[number, number]} [vector2]
 * @property {[number, number, number]} [vector3]
 * @property {[number, number, number, number]} [vector4]
 * @property {[number, number, number, number]} [color] // RGBA each 0..1
 * // or a versioned wrapper: { version: 1, data: ArtParameters }
 */

/**
 * @typedef {Object} PostArtBody
 * @property {string} user_id
 * @property {string} name
 * @property {Record<string, unknown> | { version: number, data: Record<string, unknown> }} parameters
 * @property {string | undefined} [thumbnail_base64] // base64 PNG or WebP (optional)
 */

const DEFAULT_STORAGE_KEY = 'auth.session';
// Resolve API base URL with flexible overrides:
// 1) window.__API_BASE
// 2) <meta name="api-base" content="https://api.example.com">
// 3) localStorage.getItem('API_BASE')
// 4) fallback: window.location.origin (same-origin)
const API_BASE = (() => {
	let base = '';
	try {
		if (typeof window !== 'undefined' && window.__API_BASE) {
			base = String(window.__API_BASE);
		}
		if (!base && typeof document !== 'undefined') {
			const meta = document.querySelector('meta[name="api-base"]');
			const content = meta && meta.getAttribute('content');
			if (content) base = content;
		}
		if (!base && typeof localStorage !== 'undefined') {
			const stored = localStorage.getItem('API_BASE');
			if (stored) base = stored;
		}
		if (!base && typeof window !== 'undefined' && window.location) {
			base = window.location.origin;
		}
	} catch {
		// ignore and fall back
		if (typeof window !== 'undefined' && window.location) {
			base = window.location.origin;
		}
	}
	return base || '';
})();

/**
 * Simple session store backed by localStorage with in-memory cache.
 */
const sessionStore = (() => {
	let cache = /** @type {Session | null} */ (null);
	return {
		load() {
			if (cache) return cache;
			try {
				const raw = localStorage.getItem(DEFAULT_STORAGE_KEY);
				if (!raw) return null;
				cache = JSON.parse(raw);
				return cache;
			} catch {
				return null;
			}
		},
		save(session) {
			cache = session;
			try {
				localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(session));
			} catch {
				// ignore storage quota failures
			}
		},
		clear() {
			cache = null;
			try { localStorage.removeItem(DEFAULT_STORAGE_KEY); } catch { /* noop */ }
		}
	};
})();

/**
 * Perform login and persist the session.
 * @param {string} id - User ID
 * @param {string} password - Password
 * @returns {Promise<Session>} resolves with { token, csrf, expiresAt, user }
 */
export async function login(id, password) {
	const res = await fetch(`${API_BASE}/api/login`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({ id, password })
	});

	// Try to parse body even on error for a better message
	let json;
	try {
		json = await res.json();
	} catch {
		json = null;
	}

	if (!res.ok || !json || json.success === false) {
		const msg = (json && (json.message || json.error)) || `Login failed (${res.status})`;
		throw new Error(msg);
	}

	/** @type {Session} */
	const session = {
		token: json.token,
		csrf: json.csrf,
		expiresAt: json.expiresAt,
		user: json.user
	};

	sessionStore.save(session);
	// Also expose to window for imperative consumers
	if (typeof window !== 'undefined') {
		window.__authSession = session;
	}
	return session;
}

/**
 * Get the current session from cache/localStorage.
 * @returns {Session | null}
 */
export function getSession() {
	return sessionStore.load();
}

/**
 * Clear session from storage.
 */
export function logout() {
	sessionStore.clear();
	if (typeof window !== 'undefined') {
		delete window.__authSession;
	}
}

/**
 * Compose Authorization and CSRF headers for protected routes.
 * @param {Session} session
 */
function authHeaders(session) {
	return {
		'authorization': `Bearer ${session.token}`,
		'x-csrf-token': session.csrf
	};
}

/**
 * Submit or update art preset and optional thumbnail.
 * See README_server.md for schema and rules (size limit ~512KB for raw image before base64).
 * @param {PostArtBody} body
 * @param {Session=} session - optional; if omitted, uses stored session
 * @returns {Promise<any>} server response JSON
 */
export async function postArt(body, session = undefined) {
	const active = session || getSession();
	if (!active) throw new Error('Not authenticated. Call login(id, password) first.');

	// Optional client-side size check to avoid 413 from server.
	if (body.thumbnail_base64) {
		try {
			// Rough check: base64 expands ~4/3; server raw limit is 512KB -> ~682KB base64
			const approxBytes = Math.ceil((body.thumbnail_base64.length * 3) / 4);
			if (approxBytes > 512 * 1024) {
				throw new Error('Thumbnail exceeds 512KB limit before base64.');
			}
		} catch (e) {
			// Surface size error clearly
			throw e;
		}
	}

	const res = await fetch(`${API_BASE}/api/art`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...authHeaders(active)
		},
		body: JSON.stringify(body)
	});

	const json = await res.json().catch(() => null);
	if (!res.ok || !json || json.success === false) {
		const msg = (json && (json.message || json.error)) || `Submission failed (${res.status})`;
		throw new Error(msg);
	}
	return json;
}

// Attach a convenient global for non-module scripts (e.g., main.js)
// index.html loads this file as a module, but main.js is a classic script tag.
if (typeof window !== 'undefined') {
	window.Auth = {
		login,
		getSession,
		logout,
		postArt
	};
}

// Lightweight helper to encode a canvas to PNG base64 (optional usage)
// Example: const b64 = toBase64FromCanvas(document.querySelector('canvas'))
export function toBase64FromCanvas(canvas) {
	if (!canvas || typeof canvas.toDataURL !== 'function') throw new Error('Canvas element required');
	// Prefer PNG so backend can convert to WebP
	return canvas.toDataURL('image/png').split(',')[1];
}

