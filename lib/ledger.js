/**
 * Ledger reader for dsh-turn-timeline.
 *
 * Why this file exists: the timeline answers "what happened" — it can be
 * rebuilt from session logs at any time. The ledger answers "what is still
 * owed" — once lost, it is lost. So the ledger truth lives in the workspace
 * (`50-knowledge/OPEN-ITEMS.md` plus each session's `NOTES.md`), stays in the
 * sync folder, and this plugin only READS it. Nothing here writes.
 *
 * The contract is deliberately strict: only fenced ```ledger blocks are
 * parsed. Everything else in a note file is ignored, so prose can never be
 * mistaken for a task.
 *
 *   - [ ] L-0007 | 待核实 | 良品率98.2%无来源 | owner=你补 | 2026-11-12 | 会话=20261112_1504 轮=12
 *   - [x] L-0006 | 待办 | 建会话目录模板 | owner=AI | 2026-11-12 | 关闭=2026-11-12 已交付
 *
 * Zero dependencies and no DSH runtime imports, so this module is unit
 * testable with plain node.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Allowed kinds. Anything else is a parse error, not a silent guess. */
export const KINDS = ['待核实', '待办', '复盘']

const ID_RE = /^L-\d{1,6}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CHECKBOX_RE = /^[-*]\s*\[( |x|X)\]\s+(.*)$/
const BLOCK_RE = /^```ledger[ \t]*\r?\n([\s\S]*?)^```/gm

export const GLOBAL_LEDGER = '50-knowledge/OPEN-ITEMS.md'
export const SESSIONS_DIR = '10-sessions'

/** 1-based line number of a character offset. */
function lineAt(text, index) {
	let line = 1
	for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
	return line
}

/**
 * Parse one checkbox line.
 * @returns {{item?: object, error?: {reason: string, raw: string}} | null}
 */
export function parseLedgerLine(raw, meta = {}) {
	const line = String(raw ?? '').trim()
	if (line === '') return null
	const match = CHECKBOX_RE.exec(line)
	if (match === null) return { error: { reason: 'no-checkbox', raw: line } }
	const closed = match[1] !== ' '
	const segments = match[2].split('|').map((segment) => segment.trim())
	if (segments.length < 2) return { error: { reason: 'too-few-fields', raw: line } }
	const id = segments[0]
	if (!ID_RE.test(id)) return { error: { reason: 'bad-id', raw: line } }
	const kind = segments[1]
	if (!KINDS.includes(kind)) return { error: { reason: 'bad-kind', raw: line } }
	const text = segments[2] ?? ''
	if (text === '') return { error: { reason: 'no-text', raw: line } }

	let owner = ''
	let session = ''
	let turn = ''
	let closedAt = ''
	let source = ''
	let createdAt = ''
	let note = ''
	for (const token of segments.slice(3).join(' ').split(/\s+/)) {
		if (token === '') continue
		if (token.startsWith('owner=')) owner = token.slice(6)
		else if (token.startsWith('会话=')) session = token.slice(3)
		else if (token.startsWith('session=')) session = token.slice(8)
		else if (token.startsWith('轮=')) turn = token.slice(2)
		else if (token.startsWith('turn=')) turn = token.slice(5)
		else if (token.startsWith('关闭=')) closedAt = token.slice(3)
		else if (token.startsWith('来源=')) source = token.slice(3)
		else if (token.startsWith('source=')) source = token.slice(7)
		else if (DATE_RE.test(token) && createdAt === '') createdAt = token
		else note = note === '' ? token : `${note} ${token}`
	}

	return {
		item: {
			id: id.toUpperCase(),
			kind,
			text,
			status: closed || closedAt !== '' ? 'closed' : 'open',
			owner,
			session,
			turn,
			createdAt,
			closedAt,
			source,
			note,
			...meta
		}
	}
}

/**
 * Parse every ```ledger block in one markdown document.
 * @returns {{items: object[], errors: object[]}}
 */
export function parseLedgerMarkdown(markdown, meta = {}) {
	const text = String(markdown ?? '')
	const items = []
	const errors = []
	BLOCK_RE.lastIndex = 0
	let match
	while ((match = BLOCK_RE.exec(text)) !== null) {
		const body = match[1]
		const first = lineAt(text, match.index) + 1
		body.split(/\r?\n/).forEach((line, offset) => {
			const parsed = parseLedgerLine(line, { ...meta, line: first + offset })
			if (parsed === null) return
			if (parsed.error !== undefined) {
				errors.push({ ...parsed.error, file: meta.file ?? '', line: first + offset })
				return
			}
			items.push(parsed.item)
		})
	}
	return { items, errors }
}

/** Days between `YYYY-MM-DD` and now; `undefined` when unparseable. */
export function ageInDays(date, now = Date.now()) {
	if (!DATE_RE.test(String(date ?? ''))) return undefined
	const stamp = Date.parse(`${date}T00:00:00+08:00`)
	if (Number.isNaN(stamp)) return undefined
	return Math.floor((now - stamp) / 86400000)
}

/** Aggregate counts for one workspace. */
export function summarize(items, now = Date.now()) {
	const byKind = Object.fromEntries(KINDS.map((kind) => [kind, 0]))
	const byOwner = {}
	let open = 0
	let closed = 0
	let stale = 0
	const openItems = []
	for (const item of items) {
		if (item.status === 'closed') {
			closed += 1
			continue
		}
		open += 1
		byKind[item.kind] += 1
		const owner = item.owner === '' ? '未指派' : item.owner
		byOwner[owner] = (byOwner[owner] ?? 0) + 1
		const age = ageInDays(item.createdAt, now)
		if (age !== undefined && age > 14) stale += 1
		openItems.push({ ...item, ageDays: age })
	}
	openItems.sort((a, b) => {
		const order = KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)
		if (order !== 0) return order
		return String(a.id).localeCompare(String(b.id))
	})
	return { open, closed, stale, byKind, byOwner, openItems }
}

async function readIfSmall(file, limit = 1024 * 1024) {
	try {
		const text = await readFile(file, 'utf8')
		return text.length > limit ? undefined : text
	} catch {
		return undefined
	}
}

/**
 * Read the ledger of one workspace. Never throws: a missing or unreadable
 * file degrades to fewer items, and parse failures degrade to `errors`.
 */
export async function collectLedger(cwd, options = {}) {
	const root = String(cwd ?? '')
	const limit = Number.isInteger(options.sessionLimit) ? options.sessionLimit : 400
	const files = []
	const items = []
	const errors = []
	if (root === '') return { cwd: root, items, errors, files, duplicates: 0 }

	const global = await readIfSmall(join(root, GLOBAL_LEDGER))
	if (global !== undefined && global.includes('```ledger')) {
		const parsed = parseLedgerMarkdown(global, { file: GLOBAL_LEDGER, origin: 'global' })
		items.push(...parsed.items)
		errors.push(...parsed.errors)
		files.push({ file: GLOBAL_LEDGER, items: parsed.items.length, errors: parsed.errors.length })
	}

	let entries = []
	try {
		entries = await readdir(join(root, SESSIONS_DIR), { withFileTypes: true })
	} catch {
		entries = []
	}
	const sessions = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()
		.reverse()
		.slice(0, limit)
	for (const name of sessions) {
		const file = `${SESSIONS_DIR}/${name}/NOTES.md`
		const text = await readIfSmall(join(root, SESSIONS_DIR, name, 'NOTES.md'))
		if (text === undefined || !text.includes('```ledger')) continue
		const parsed = parseLedgerMarkdown(text, { file, origin: 'session', sessionDir: name })
		if (parsed.items.length === 0 && parsed.errors.length === 0) continue
		items.push(...parsed.items)
		errors.push(...parsed.errors)
		files.push({ file, items: parsed.items.length, errors: parsed.errors.length })
	}

	// A session note may repeat an item that was later promoted to the global
	// pool. The global pool wins; the duplicate is counted, not shown twice.
	const seen = new Set()
	const unique = []
	let duplicates = 0
	const ordered = [...items].sort((a, b) => (a.origin === 'global' ? -1 : 1) - (b.origin === 'global' ? -1 : 1))
	for (const item of ordered) {
		if (seen.has(item.id)) {
			duplicates += 1
			continue
		}
		seen.add(item.id)
		unique.push(item)
	}

	return { cwd: root, items: unique, errors, files, duplicates }
}
