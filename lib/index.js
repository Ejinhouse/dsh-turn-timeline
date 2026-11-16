/**
 * dsh-turn-timeline — host half.
 *
 * Reads every session of a workspace through `ctx.sessionQuery` (the raw log,
 * not the compacted surface), folds it into turns, groups the turns into task
 * stretches, and serves the whole thing as JSON for the left-sidebar panel.
 *
 * Why the host half exists at all: the browser cannot read `~/.dsh/sessions/`
 * directly, and `readSession` is the only reader that survives compaction.
 *
 * Routes (prefix `/turn-timeline`):
 *   GET  /turn-timeline/index                  → workspaces + one row per session
 *   GET  /turn-timeline/session/<sessionId>    → turns + task segments
 *   GET  /turn-timeline/file?session=&path=    → one produced file, for the inline preview
 *   GET  /turn-timeline/layout                 → folders + per-session arrangement
 *   POST /turn-timeline/layout                 → create/rename/delete folders, file/rename/remove/restore sessions
 *   GET  /turn-timeline/ledger                 → 未关闭事项台账 (read-only, per workspace)
 *   GET  /turn-timeline/ledger/file?cwd=&path= → the ledger source file itself (restricted paths only)
 *
 * The ledger half is deliberately read-only: "what happened" can be rebuilt
 * from the session log, but "what is still owed" cannot, so its truth stays in
 * the workspace markdown and this plugin never writes it.
 *
 * @module dsh-turn-timeline
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { collectLedger, summarize } from './ledger.js'

const PATH = '/turn-timeline'

/** Text kept per turn — long enough to recognise the task, short enough to ship. */
const TEXT = 400
/** Extensions the panel renders as pictures instead of text. */
const IMAGE_MIME = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.bmp': 'image/bmp'
}
const MARKDOWN_EXT = new Set(['.md', '.mdx', '.markdown'])
const CODE_EXT = new Set([
	'.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.jsonc', '.yml', '.yaml', '.toml',
	'.css', '.scss', '.less', '.html', '.htm', '.vue', '.svelte', '.py', '.pyw', '.ps1', '.psm1',
	'.sh', '.bash', '.zsh', '.bat', '.cmd', '.sql', '.rs', '.go', '.java', '.kt', '.kts', '.c',
	'.h', '.cpp', '.hpp', '.cc', '.cs', '.fs', '.rb', '.php', '.xml', '.ini', '.cfg', '.conf',
	'.env', '.lua', '.pl', '.r', '.swift', '.dart', '.scala', '.gradle', '.dockerfile', '.makefile'
])

const BARE_CODE = new Set(['dockerfile', 'makefile', 'gemfile', 'rakefile', 'procfile', 'brewfile'])
const MAX_SESSIONS = 200
const TOOL_TEXT = 160

/** Tools whose arguments name an output file. */
const FILE_TOOLS = new Set([
	'write', 'edit', 'multi_edit', 'str_replace_editor', 'apply_patch',
	'notebook_edit', 'create_file', 'edit_file', 'write_file', 'patch'
])
const FILE_KEYS = ['file_path', 'path', 'filePath', 'notebook_path', 'target_file']

const NAME = 'dsh-turn-timeline'
export const name = NAME
/**
 * No required services: `apply` waits for `webServer` + `sessionQuery` itself.
 * Declaring them here would make a missing one a hard activation failure.
 */
export const inject = []

/**
 * Mount the read-only JSON surface.
 * @param ctx - host root context.
 */
export function apply(ctx) {
	let log
	try {
		log = ctx.get('logger')
	} catch {
		log = undefined
	}
	/** sessionId → { throughSeq, value } — a session log only grows, so a seq hit is a cache hit. */
	const cache = new Map()
	let webServer
	let sessionQuery

	ctx.inject(['webServer', 'sessionQuery'], (services) => {
		webServer = services.webServer
		sessionQuery = services.sessionQuery
		services.effect(() => register(), 'dsh-turn-timeline: routes')
	})

	function aggregate(id, events) {
		const turns = []
		let cur
		let title = ''
		for (const event of events) {
			const data = event?.data
			if (event?.type === 'session/title') {
				const text = typeof data?.title === 'string' ? data.title.trim() : ''
				if (text !== '') title = text
			}
			if (event?.type === 'turn/start') {
				cur = {
					turn: typeof data?.turn === 'number' ? data.turn : turns.length + 1,
					t0: event.time,
					t1: undefined,
					user: '',
					final: '',
					tools: Object.create(null),
					files: [],
					deliverables: [],
					status: 'running'
				}
				turns.push(cur)
			} else if (cur === undefined) {
				continue
			} else if (event.type === 'user/message') {
				if (data?.source?.kind === 'tool') continue
				const text = pickText(data?.content)
				if (text !== '') cur.user = cur.user === '' ? text : cur.user
			} else if (event.type === 'assistant/message') {
				const text = pickText(data?.message?.content)
				if (text !== '') cur.final = text
			} else if (event.type === 'tool/call') {
				const key = String(data?.name ?? '?')
				cur.tools[key] = (cur.tools[key] ?? 0) + 1
				const file = fileOfCall(key, data?.arguments)
				if (file !== undefined) pushUnique(cur.files, file)
			} else if (event.type === 'deliverables/presented') {
				for (const file of data?.files ?? []) {
					const path = String(file?.path ?? '').trim()
					if (path !== '') pushUnique(cur.deliverables, path)
				}
			} else if (event.type === 'turn/end') {
				cur.t1 = event.time
				cur.status = String(data?.reason?.kind ?? 'completed')
				cur = undefined
			}
		}
		for (const turn of turns) {
			turn.user = clip(stripInjected(turn.user), TEXT)
			turn.final = clip(stripInjected(turn.final), TEXT)
			turn.files = turn.files.map((path) => path)
		}
		return { turns: turns.map(shapeTurn), segments: group(turns), title }
	}

	function shapeTurn(turn) {
		return {
			turn: turn.turn,
			t0: turn.t0 ?? null,
			t1: turn.t1 ?? null,
			status: turn.status,
			user: turn.user,
			final: turn.final,
			tools: turn.tools,
			files: turn.files,
			deliverables: turn.deliverables,
			label: labelOf(turn)
		}
	}

	async function detail(sessionId) {
		const { events, session } = await sessionQuery.readSession(sessionId)
		const through = events.at(-1)?.seq ?? -1
		const hit = cache.get(sessionId)
		if (hit !== undefined && hit.throughSeq >= through) return hit.value
		const aggregated = aggregate(sessionId, events)
		const cwd = typeof session?.cwd === 'string' ? session.cwd : undefined
		const value = {
			id: sessionId,
			cwd,
			agentPreset: typeof session?.agentPreset === 'string' ? session.agentPreset : undefined,
			...aggregated
		}
		// `aggregated.title` is the last folded `session/title` — the workspace's own
		// summary name. The session header's title is only a fallback.
		const workspaceTitle = aggregated.title !== ''
			? aggregated.title
			: (typeof session?.title === 'string' ? session.title.trim() : '')
		value.title = workspaceTitle === '' ? undefined : workspaceTitle
		await mergeLedger(value, cwd, sessionId)
		cache.set(sessionId, { throughSeq: through, value })
		if (cache.size > 48) cache.delete(cache.keys().next().value)
		return value
	}

	/**
	 * Fill in the files each turn touched from the change ledger, then regroup.
	 *
	 * Why: the ledger sees shell-created files, the session log only sees the
	 * file tools. When turn-rewind is not installed the ledger is simply absent.
	 */
	async function mergeLedger(value, cwd, sessionId) {
		if (typeof cwd !== 'string' || cwd === '') return
		try {
			const files = await turnFilesFromLedger(cwd, sessionId)
			if (files === undefined || files.size === 0) return
			let changed = false
			for (const turn of value.turns) {
				const paths = files.get(turn.turn)
				if (paths === undefined || paths.length === 0) continue
				const merged = [...paths]
				for (const file of turn.files) if (!merged.includes(file)) merged.push(file)
				turn.files = merged
				changed = true
			}
			if (changed) value.segments = group(value.turns)
		} catch (error) {
			log?.warn?.(`[turn-timeline] ledger: ${String(error?.message ?? error)}`)
		}
	}

	/** sessionId → title derived from the log. Invalidated when a newer `session/title` arrives. */
	const titles = new Map()
	const titlePending = new Set()
	let fillingTitles = false

	/** sessionId → number of `session/title` writes seen; guards a resolve racing with one. */
	const titleEpoch = new Map()

	/**
	 * Drop cached titles whenever the Harness writes a new one. The title service
	 * writes a fallback title right after the first user message and the LLM
	 * provider rewrites it a moment later, so a cache built at open time would
	 * otherwise stay on the short head-of-message fallback forever — exactly the
	 * behaviour this plugin used to have on the panel.
	 */
	ctx.on('session/event', (session, event) => {
		if (event?.type !== 'session/title') return
		const id = session?.id
		if (typeof id !== 'string') return
		titleEpoch.set(id, (titleEpoch.get(id) ?? 0) + 1)
		titles.delete(id)
	})

	/**
	 * Derive a session title from its log. The workspace's own summary lives in
	 * the LAST `session/title` event (the provider appends it after the fallback),
	 * so keep scanning to the end of the log; if the Harness never wrote one, fall
	 * back to the first thing the user said.
	 */
	async function resolveTitle(id) {
		if (titles.has(id)) return titles.get(id)
		if (titlePending.has(id)) return undefined
		titlePending.add(id)
		const epoch = titleEpoch.get(id) ?? 0
		try {
			const body = await sessionQuery.readSession(id)
			const events = body?.events ?? []
			let titled = ''
			let spoken = ''
			for (const event of events) {
				const data = event?.data
				if (event?.type === 'session/title') {
					if (typeof data?.title === 'string' && data.title.trim() !== '') titled = data.title.trim()
				} else if (spoken === '' && event?.type === 'user/message' && data?.source?.kind !== 'tool') {
					const text = stripInjected(pickText(data?.content))
					if (text !== '') spoken = text
				}
			}
			const source = titled !== '' ? titled : spoken
			const line = source.split('\n').map((part) => part.trim()).find((part) => part !== '') ?? ''
			const title = clip(line.replace(/^[#>*\-\s]+/, ''), 60)
			// A `session/title` written while we were reading makes this stale; skip
			// caching so the next call folds the newer log.
			if ((titleEpoch.get(id) ?? 0) === epoch) titles.set(id, title)
			return title
		} catch (error) {
			log?.warn?.(`[turn-timeline] title ${id}: ${String(error?.message ?? error)}`)
			return undefined
		} finally {
			titlePending.delete(id)
		}
	}

	/** Keep filling titles after the response, so the next open shows names, not serials. */
	async function fillTitles(ids) {
		if (fillingTitles) return
		fillingTitles = true
		try {
			for (const id of ids) {
				if (titles.has(id)) continue
				await resolveTitle(id)
				await new Promise((resolve) => setTimeout(resolve, 20))
			}
		} catch (error) {
			log?.warn?.(`[turn-timeline] title fill: ${String(error?.message ?? error)}`)
		} finally {
			fillingTitles = false
		}
	}

	async function index() {
		const records = await sessionQuery.listSessions()
		const sessions = []
		for (const record of records) {
			const header = record?.header ?? {}
			const cwd = typeof header.cwd === 'string' ? header.cwd : undefined
			sessions.push({
				id: String(header.id),
				cwd,
				createdAt: typeof header.createdAt === 'number' ? header.createdAt : null,
				// Deliberately not `header.title`: when that exists it is the short
				// deterministic fallback, not the workspace's summary name. Every row
				// is resolved from the session log below instead.
				title: undefined,
				live: record?.live === true,
				persisted: record?.persisted === true,
				parentSession: typeof header.parentSession === 'string' ? header.parentSession : undefined
			})
		}
		// Resolve every title from the log, not from the list header: the header
		// carries the fallback head-of-message title (or nothing), while the log's
		// last `session/title` is the same summary the workspace itself shows.
		// Cached per session for the life of the Host; invalidated on new titles.
		const missing = sessions.filter((session) => session.title === undefined)
		const deadline = Date.now() + 2500
		const queue = missing.map((session) => session.id)
		const worker = async () => {
			while (queue.length > 0 && Date.now() < deadline) {
				const id = queue.shift()
				if (id === undefined) return
				await resolveTitle(id)
			}
		}
		await Promise.all([worker(), worker(), worker(), worker()])
		for (const session of missing) {
			const title = titles.get(session.id)
			if (title !== undefined && title !== '') session.title = title
		}
		const rest = [...queue, ...missing.filter((session) => titles.get(session.id) === undefined).map((session) => session.id)]
		if (rest.length > 0) fillTitles(rest)
		sessions.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
		const byCwd = new Map()
		for (const session of sessions) {
			const key = session.cwd === undefined ? '' : normalize(session.cwd)
			const bucket = byCwd.get(key) ?? { key, cwd: session.cwd ?? '', sessions: 0, latest: 0 }
			bucket.sessions += 1
			bucket.latest = Math.max(bucket.latest, session.createdAt ?? 0)
			byCwd.set(key, bucket)
		}
		const workspaces = [...byCwd.values()].sort((a, b) => b.latest - a.latest)
		return { sessions: sessions.slice(0, MAX_SESSIONS), workspaces }
	}

	/**
	 * Serve one file body, but only when that path really is an output of the
	 * named session: the panel must never become a generic file reader.
	 */
	async function preview(sessionId, target) {
		if (typeof target !== 'string' || target === '') return { ok: false, error: 'missing-path' }
		const body = await detail(sessionId)
		const wanted = normalize(target)
		let allowed = false
		for (const turn of body.turns) {
			for (const path of [...(turn.files ?? []), ...(turn.deliverables ?? [])]) {
				if (normalize(path) === wanted) {
					allowed = true
					break
				}
			}
			if (allowed) break
		}
		if (!allowed) return { ok: false, error: 'not-in-session' }
		const info = await stat(target).catch(() => undefined)
		if (info === undefined || !info.isFile()) return { ok: false, error: 'not-a-file' }
		const ext = extname(target).toLowerCase()
		const mime = IMAGE_MIME[ext]
		if (mime !== undefined) {
			if (info.size > 8 * 1024 * 1024) return { ok: false, error: 'too-large', size: info.size }
			const buffer = await readFile(target)
			return { ok: true, path: target, size: info.size, kind: 'image', mime, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
		}
		if (info.size > 1024 * 1024) return { ok: false, error: 'too-large', size: info.size }
		const buffer = await readFile(target)
		if (buffer.subarray(0, 8192).includes(0)) return { ok: false, error: 'binary', size: info.size }
		const text = buffer.toString('utf8')
		return {
			ok: true,
			path: target,
			size: info.size,
			kind: MARKDOWN_EXT.has(ext)
				? 'markdown'
				: CODE_EXT.has(ext) || BARE_CODE.has(basename(target).toLowerCase())
					? 'code'
					: 'text',
			text: text.length > 400000 ? `${text.slice(0, 400000)}
…（已截断，仅显示前 400 000 字符）` : text
		}
	}

	/** Serialise one JSON reply. */
	function send(response, status, body) {
		const text = JSON.stringify(body)
		response.writeHead(status, {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'content-length': Buffer.byteLength(text)
		})
		response.end(text)
	}

	/** The panel's arrangement, persisted next to the other DSH storages. */
	let arrangement
	function layoutFile() {
		return join(dshHome(), 'storages', 'turn-timeline-v1.json')
	}
	async function readLayout() {
		if (arrangement !== undefined) return arrangement
		const raw = await readFile(layoutFile(), 'utf8').catch(() => undefined)
		let parsed
		try {
			parsed = raw === undefined ? undefined : JSON.parse(raw)
		} catch {
			parsed = undefined
		}
		arrangement = normalizeLayout(parsed)
		return arrangement
	}
	async function writeLayout() {
		const file = layoutFile()
		await mkdir(dirname(file), { recursive: true })
		const temporary = `${file}.${process.pid}.tmp`
		await writeFile(temporary, JSON.stringify(arrangement, null, 2), 'utf8')
		await rename(temporary, file)
	}

	/**
	 * The 未关闭事项台账, read from the workspace markdown. Cached for 30 s: the
	 * files only change when a human (or the agent) edits them, and a panel
	 * refresh must not re-walk every session folder.
	 */
	let ledgerCache = { at: 0, key: '', value: undefined }
	/** Relative paths the panel may open as ledger sources — nothing else. */
	const LEDGER_SOURCES = [/^50-knowledge\/OPEN-ITEMS\.md$/i, /^10-sessions\/[^/\\]+\/NOTES\.md$/i]

	async function ledgerIndex() {
		const now = Date.now()
		const records = await sessionQuery.listSessions()
		const cwds = []
		const seen = new Set()
		for (const record of records) {
			const cwd = record?.header?.cwd
			if (typeof cwd !== 'string' || cwd === '') continue
			const key = normalize(cwd)
			if (seen.has(key)) continue
			seen.add(key)
			cwds.push(cwd)
		}
		const cacheKey = cwds.join('|')
		if (ledgerCache.value !== undefined && ledgerCache.key === cacheKey && now - ledgerCache.at < 30000) {
			return ledgerCache.value
		}
		const workspaces = []
		for (const cwd of cwds.slice(0, 12)) {
			const collected = await collectLedger(cwd)
			workspaces.push({
				cwd,
				summary: summarize(collected.items),
				items: collected.items,
				errors: collected.errors,
				files: collected.files,
				duplicates: collected.duplicates
			})
		}
		const totals = { open: 0, closed: 0, stale: 0, errors: 0, workspaces: workspaces.length }
		for (const workspace of workspaces) {
			totals.open += workspace.summary.open
			totals.closed += workspace.summary.closed
			totals.stale += workspace.summary.stale
			totals.errors += workspace.errors.length
		}
		const value = { workspaces, totals }
		ledgerCache = { at: now, key: cacheKey, value }
		return value
	}

	/**
	 * Serve one ledger source file, but only at the two fixed ledger paths: the
	 * panel must never turn into a generic workspace file reader.
	 */
	async function ledgerFile(cwd, target) {
		const root = resolve(String(cwd ?? ''))
		const rel = String(target ?? '').replace(/\\/g, '/')
		if (!LEDGER_SOURCES.some((pattern) => pattern.test(rel))) return { ok: false, error: 'not-allowed' }
		const file = resolve(root, rel)
		const inside = relative(root, file)
		if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return { ok: false, error: 'not-allowed' }
		const info = await stat(file).catch(() => undefined)
		if (info === undefined || !info.isFile()) return { ok: false, error: 'not-a-file' }
		if (info.size > 512 * 1024) return { ok: false, error: 'too-large', size: info.size }
		const text = await readFile(file, 'utf8')
		return { ok: true, path: rel, size: info.size, text }
	}

	/** Collect at most `limit` bytes of JSON request body. */
	function readJsonBody(request) {
		return new Promise((resolve, reject) => {
			const chunks = []
			let size = 0
			request.on('data', (chunk) => {
				size += chunk.length
				if (size > 64 * 1024) {
					reject(new Error('payload-too-large'))
					request.destroy()
					return
				}
				chunks.push(chunk)
			})
			request.on('end', () => {
				if (chunks.length === 0) return resolve({})
				try {
					resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
				} catch (error) {
					reject(error)
				}
			})
			request.on('error', reject)
		})
	}

	/**
	 * One mutation of the arrangement: folders, per-session name/folder, and the
	 * removed flag that moves a session to the "not in timeline" pool.
	 */
	async function applyLayout(body) {
		const data = await readLayout()
		const op = String(body?.op ?? '')
		const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
		const folderId = typeof body?.folderId === 'string' && body.folderId !== '' ? body.folderId : null
		if (op === 'folder.create') {
			const name = clip(String(body?.name ?? '').trim(), 40) || '新文件夹'
			data.folders.push({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name })
		} else if (op === 'folder.rename') {
			const folder = data.folders.find((item) => item.id === folderId)
			if (folder === undefined) return { ok: false, error: 'no-folder' }
			folder.name = clip(String(body?.name ?? '').trim(), 40) || folder.name
		} else if (op === 'folder.delete') {
			data.folders = data.folders.filter((item) => item.id !== folderId)
			for (const item of Object.values(data.items)) if (item.folderId === folderId) item.folderId = null
		} else if (op === 'item.assign') {
			if (sessionId === '') return { ok: false, error: 'no-session' }
			const item = entryOf(data, sessionId)
			item.folderId = folderId === null || data.folders.some((folder) => folder.id === folderId) ? folderId : null
		} else if (op === 'item.rename') {
			if (sessionId === '') return { ok: false, error: 'no-session' }
			const name = clip(String(body?.name ?? '').trim(), 80)
			const item = entryOf(data, sessionId)
			item.name = name === '' ? null : name
		} else if (op === 'item.remove') {
			if (sessionId === '') return { ok: false, error: 'no-session' }
			entryOf(data, sessionId).removed = true
		} else if (op === 'item.restore') {
			if (sessionId === '') return { ok: false, error: 'no-session' }
			const item = entryOf(data, sessionId)
			item.removed = false
			item.folderId = null
		} else {
			return { ok: false, error: 'unknown-op' }
		}
		await writeLayout()
		return { ok: true, folders: data.folders, items: data.items }
	}

	function register() {
		return webServer.register({
		kind: 'prefix',
		path: PATH,
		handler: async (request, response) => {
			try {
				const url = new URL(String(request.url ?? PATH), 'http://localhost')
				const route = url.pathname.slice(PATH.length).replace(/\/+$/, '')
				if (route === '/layout') {
					if (request.method === 'GET') {
						const data = await readLayout()
						return send(response, 200, { ok: true, folders: data.folders, items: data.items })
					}
					if (request.method === 'POST') {
						const body = await readJsonBody(request)
						const result = await applyLayout(body)
						return send(response, result.ok === true ? 200 : 400, result)
					}
					return send(response, 405, { ok: false, error: 'method-not-allowed' })
				}
				if (request.method !== 'GET') return send(response, 405, { ok: false, error: 'method-not-allowed' })
				if (route === '' || route === '/ping') return send(response, 200, { ok: true, name: NAME })
				if (route === '/index') return send(response, 200, { ok: true, ...(await index()) })
				if (route.startsWith('/session/')) {
					const id = decodeURIComponent(route.slice('/session/'.length))
					if (id === '') return send(response, 400, { ok: false, error: 'missing-session' })
					return send(response, 200, { ok: true, ...(await detail(id)) })
				}
				if (route === '/file') {
					const id = url.searchParams.get('session') ?? ''
					const target = url.searchParams.get('path') ?? ''
					if (id === '') return send(response, 400, { ok: false, error: 'missing-session' })
					const body = await preview(id, target)
					return send(response, body.ok === true ? 200 : 404, body)
				}
				if (route === '/ledger') return send(response, 200, { ok: true, ...(await ledgerIndex()) })
				if (route === '/ledger/file') {
					const cwd = url.searchParams.get('cwd') ?? ''
					const target = url.searchParams.get('path') ?? ''
					if (cwd === '') return send(response, 400, { ok: false, error: 'missing-cwd' })
					const body = await ledgerFile(cwd, target)
					return send(response, body.ok === true ? 200 : 404, body)
				}
				return send(response, 404, { ok: false, error: 'unknown-route' })
			} catch (error) {
					log?.warn?.(`[turn-timeline] ${String(error?.stack ?? error)}`)
					send(response, 500, { ok: false, error: String(error?.message ?? error) })
				}
			}
		})
	}
}

/** `$DSH_HOME`, falling back to the desktop app's default home. */
function dshHome() {
	return typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
}

/** Ledger reads are cheap but not free: a 30 s window is plenty for a panel. */
const LEDGER_TTL = 30_000
const ledgerCache = new Map()

/**
 * Files per turn, from turn-rewind's change ledger.
 *
 * A checkpoint is labelled "Before turn N checkpoint", so the files a turn
 * touched are the difference between checkpoint N and checkpoint N+1. The last
 * turn has no successor yet and is therefore always partial.
 * @param cwd - the session workspace.
 * @param sessionId - its session id.
 * @returns turn number → changed paths, or undefined when no ledger exists.
 */
async function turnFilesFromLedger(cwd, sessionId) {
	const key = `${cwd}\u0000${sessionId}`
	const hit = ledgerCache.get(key)
	if (hit !== undefined && Date.now() - hit.at < LEDGER_TTL) return hit.map
	const workspace = createHash('sha256').update(cwd).digest('hex')
	const dir = join(dshHome(), 'change-ledger', 'v1', 'workspaces', workspace, 'manifests')
	const names = await readdir(dir).catch(() => undefined)
	if (names === undefined) return undefined
	const manifests = []
	for (const name of names.slice(0, 400)) {
		if (!name.endsWith('.json')) continue
		const raw = await readFile(join(dir, name), 'utf8').catch(() => undefined)
		if (raw === undefined) continue
		let manifest
		try {
			manifest = JSON.parse(raw)
		} catch {
			continue
		}
		if (manifest?.kind !== undefined && manifest.kind !== 'turn') continue
		if (manifest?.sessionId !== sessionId) continue
		const turn = typeof manifest.turn === 'number' ? manifest.turn : Number((/turn (\d+)/.exec(String(manifest.label ?? '')) ?? [])[1])
		if (!Number.isFinite(turn)) continue
		if (manifest.entries === null || typeof manifest.entries !== 'object') continue
		manifests.push({ turn, entries: manifest.entries })
	}
	manifests.sort((a, b) => a.turn - b.turn)
	const files = new Map()
	for (let index = 0; index < manifests.length - 1; index += 1) {
		const before = manifests[index]
		const after = manifests[index + 1]
		const changed = []
		for (const path of Object.keys(after.entries)) {
			const previous = before.entries[path]
			if (previous === undefined || previous.blob !== after.entries[path]?.blob) changed.push(path)
		}
		if (changed.length > 0) files.set(before.turn, changed)
	}
	ledgerCache.set(key, { at: Date.now(), map: files })
	if (ledgerCache.size > 64) ledgerCache.delete(ledgerCache.keys().next().value)
	return files
}

/** Concatenate the text blocks of a message content array. */
function pickText(content) {
	if (typeof content === 'string') return content
	if (!Array.isArray(content)) return ''
	const parts = []
	for (const block of content) if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
	return parts.join('\n').trim()
}

/**
 * Drop the harness blocks the client injects into a user turn (runtime context,
 * hindsight reminders): they are noise in a task label.
 */
function stripInjected(text) {
	let value = String(text ?? '')
	const cut = value.search(/\n\s*(?:Current runtime context|<hindsight_knowledge|<available_skills)/i)
	if (cut > 0) value = value.slice(0, cut)
	value = value.replace(/<hindsight_knowledge[\s\S]*$/i, '')
	value = value.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
	return value.trim()
}

/** First non-empty line of a turn, clipped — the zero-cost local label. */
function labelOf(turn) {
	const source = turn.user !== '' ? turn.user : turn.final
	const line = String(source).split('\n').map((part) => part.trim()).find((part) => part !== '') ?? ''
	return clip(line.replace(/^[#>*\-\s]+/, ''), 60)
}

/** Group consecutive turns into task stretches: a new stretch starts when the turn touches new files. */
function group(turns) {
	const segments = []
	for (const turn of turns) {
		const previous = segments.at(-1)
		const shared = previous !== undefined && turn.files.some((file) => previous.files.includes(file))
		const startsNew = previous === undefined || (turn.files.length > 0 && !shared)
		if (startsNew) {
			segments.push({
				from: turn.turn,
				to: turn.turn,
				label: labelOf(turn),
				files: [...turn.files, ...turn.deliverables],
				turns: [turn.turn],
				t0: turn.t0,
				t1: turn.t1
			})
		} else {
			previous.to = turn.turn
			previous.turns.push(turn.turn)
			previous.t1 = turn.t1 ?? previous.t1
			for (const file of [...turn.files, ...turn.deliverables]) pushUnique(previous.files, file)
		}
	}
	return segments
}

/** The file a tool call wrote to, when the tool and arguments say so. */
function fileOfCall(name, rawArguments) {
	if (!FILE_TOOLS.has(name)) return undefined
	let args = rawArguments
	if (typeof args === 'string') {
		try {
			args = JSON.parse(args)
		} catch {
			return undefined
		}
	}
	if (args === null || typeof args !== 'object') return undefined
	for (const key of FILE_KEYS) {
		const value = args[key]
		if (typeof value === 'string' && value.trim() !== '') return value.trim()
	}
	return undefined
}

function pushUnique(list, value) {
	if (!list.includes(value)) list.push(value)
}

function clip(text, max) {
	const value = String(text ?? '').trim()
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function normalize(path) {
	return String(path).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/** A tolerant shape for the arrangement file: anything unreadable becomes empty. */
function normalizeLayout(raw) {
	const folders = []
	if (raw !== null && typeof raw === 'object' && Array.isArray(raw.folders)) {
		for (const folder of raw.folders) {
			if (typeof folder?.id !== 'string' || folder.id === '') continue
			const name = clip(typeof folder.name === 'string' ? folder.name : '', 40)
			folders.push({ id: folder.id, name: name === '' ? '未命名' : name })
		}
	}
	const items = {}
	if (raw !== null && typeof raw === 'object' && raw.items !== null && typeof raw.items === 'object') {
		for (const [id, value] of Object.entries(raw.items)) {
			if (id === '' || value === null || typeof value !== 'object') continue
			items[id] = {
				folderId: typeof value.folderId === 'string' && folders.some((folder) => folder.id === value.folderId) ? value.folderId : null,
				name: typeof value.name === 'string' && value.name.trim() !== '' ? clip(value.name.trim(), 80) : null,
				removed: value.removed === true
			}
		}
	}
	return { version: 1, folders, items }
}

/** The per-session record, created on first touch. */
function entryOf(data, sessionId) {
	const existing = data.items[sessionId]
	if (existing !== undefined) return existing
	const created = { folderId: null, name: null, removed: false }
	data.items[sessionId] = created
	return created
}
