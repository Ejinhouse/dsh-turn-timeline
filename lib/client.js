/**
 * dsh-turn-timeline — client bundle (hand-written, no build step).
 *
 * A left-sidebar panel that answers "what did this session actually do?":
 * one row per task stretch, the turns behind that row, and the files of each
 * turn — a file chip opens the right sidebar on that file.
 *
 * Host half (`lib/index.js`) serves two JSON routes; this half only renders.
 *
 * @module dsh-turn-timeline/client
 */
window.__ModuleLoader__.load({
	id: "dsh-turn-timeline",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const NS = "turn-timeline";
		const PANEL_ID = "turn-timeline";
		const API = "/turn-timeline";
		/** Shown in the header so a stale bundle is obvious at a glance. */
		const VERSION = "1.0.0";
		const ZOOM_KEY = "dsh-turn-timeline:zoom";

		//#region styles
		const css = [
			".ttl-root{display:flex;flex-direction:column;height:100%;min-height:0;font-size:12px;color:var(--dsw-alias-label-primary,inherit);font-family:inherit}",
			".ttl-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));flex:none}",
			".ttl-title{font-weight:600;font-size:12px;margin-right:auto;white-space:nowrap}",
			".ttl-sel,.ttl-btn{height:24px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:transparent;color:inherit;border-radius:6px;font-size:12px;font-family:inherit;cursor:pointer}",
			".ttl-sel{max-width:190px}",
			".ttl-btn{padding:0 7px}",
			".ttl-btn:hover,.ttl-sel:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}",
			".ttl-filter{margin:6px 10px 0;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));border-radius:6px;background:transparent;color:inherit;font-size:12px;font-family:inherit;flex:none}",
			".ttl-body{flex:1;min-height:0;overflow:auto;padding:6px 8px 16px}",
			".ttl-empty{padding:24px 14px;text-align:center;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.85))}",
			".ttl-session{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:8px;margin:6px 2px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.04))}",
			".ttl-session.open{border-color:var(--dsw-alias-border-l1,rgba(128,128,128,.4))}",
			".ttl-srow{display:flex;align-items:baseline;gap:6px;padding:7px 9px;cursor:pointer;user-select:none}",
			".ttl-srow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1))}",
			".ttl-caret{width:10px;flex:none;opacity:.65;font-size:9px}",
			".ttl-sname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}",
			".ttl-meta{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.85));white-space:nowrap}",
			".ttl-tag{flex:none;font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.85))}",
			".ttl-childtoggle{align-self:flex-start;margin:4px 0 8px}",
			".ttl-tools{display:flex;gap:6px;align-items:center;margin:0 0 6px}",
			".ttl-tool{flex:none}",
			".ttl-tool.on{border-color:var(--dsw-alias-border-l1,rgba(128,128,128,.6));color:var(--dsw-alias-label-primary,inherit)}",
			".ttl-newfolder{flex:1;min-width:0;font-size:12px;padding:3px 6px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.5));background:var(--dsw-alias-bg-l2,transparent);color:inherit}",
			".ttl-group{display:flex;flex-direction:column}",
			".ttl-folder{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:5px;border:1px dashed transparent;cursor:pointer;user-select:none}",
			".ttl-folder:hover{background:var(--dsw-alias-bg-l2,rgba(128,128,128,.08))}",
			".ttl-folder.over{border-color:var(--dsw-alias-brand-primary,#4c8dff);background:var(--dsw-alias-bg-l2,rgba(128,128,128,.12))}",
			".ttl-folder.plain{opacity:.85}",
			".ttl-foldername{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}",
			".ttl-count{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.85))}",
			".ttl-rowbtn{opacity:0;flex:none;font-size:11px;padding:0 4px;line-height:16px}",
			".ttl-srow:hover .ttl-rowbtn,.ttl-srow:focus-within .ttl-rowbtn,.ttl-folder:hover .ttl-rowbtn{opacity:1}",
			".ttl-session.dragging{opacity:.45}",
			".ttl-session[draggable=true] .ttl-srow{cursor:grab}",
			".ttl-rename{flex:1;min-width:0;font-size:12px;padding:1px 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.5));background:var(--dsw-alias-bg-l2,transparent);color:inherit}",
			".ttl-seg{margin:2px 6px 8px;border-left:2px solid var(--dsw-alias-border-l1,rgba(128,128,128,.4));padding:4px 0 4px 8px}",
			".ttl-seghead{display:flex;align-items:baseline;gap:6px;cursor:pointer}",
			".ttl-badge{flex:none;font-size:12px;padding:1px 5px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.18));color:var(--dsw-alias-label-secondary,inherit)}",
			".ttl-seglabel{flex:1;min-width:0;font-size:12.5px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
			".ttl-turns{margin:3px 0 0}",
			".ttl-turn{padding:3px 0 4px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(128,128,128,.18))}",
			".ttl-turntop{display:flex;gap:6px;align-items:baseline}",
			".ttl-n{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.9));min-width:32px}",
			".ttl-ttext{flex:1;min-width:0;font-size:12px;line-height:1.45;opacity:.92;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
			".ttl-chiprow{display:flex;flex-wrap:wrap;gap:4px;margin:3px 0 0 32px}",
			".ttl-chip{max-width:100%;font-size:12px;padding:1px 6px;border-radius:5px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".ttl-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,inherit)}",
			".ttl-tool{font-size:9.5px;padding:0 5px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.95));white-space:nowrap}",
			".ttl-err{margin:6px 8px;padding:6px 8px;border-radius:6px;background:rgba(200,60,60,.12);color:#e07070;font-size:12.5px;line-height:1.5;word-break:break-word}",
			".ttl-loading{padding:10px;text-align:center;font-size:12.5px;opacity:.7}",
			".ttl-note{margin:4px 9px;padding:3px 6px;border-radius:5px;background:rgba(80,160,90,.14);color:#7fc48a;font-size:12px}",
			".ttl-preview{display:flex;flex-direction:column;height:100%;min-height:0}",
			".ttl-pvhead{display:flex;align-items:center;gap:6px;padding:7px 9px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.25))}",
			".ttl-pvname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".ttl-pvpath{padding:3px 9px;font-size:9.5px;opacity:.6;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".ttl-pre{flex:1;min-height:0;overflow:auto;margin:0;padding:8px 10px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}",
			".ttl-md{flex:1;min-height:0;overflow:auto;padding:10px 12px;line-height:1.65;word-break:break-word}",
			".ttl-md h1,.ttl-md h2,.ttl-md h3,.ttl-md h4{margin:14px 0 6px;line-height:1.35;font-weight:650}",
			".ttl-md h1{font-size:19px}.ttl-md h2{font-size:17px}.ttl-md h3{font-size:15px}.ttl-md h4{font-size:14px}",
			".ttl-md p{margin:7px 0}",
			".ttl-md ul,.ttl-md ol{margin:6px 0;padding-left:20px}",
			".ttl-md li{margin:3px 0}",
			".ttl-md code{padding:1px 4px;border-radius:4px;background:rgba(128,128,128,.18);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}",
			".ttl-md pre.ttl-mdcode{margin:8px 0;padding:8px 10px;border-radius:6px;background:rgba(128,128,128,.12);overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".ttl-md blockquote{margin:8px 0;padding:2px 10px;border-left:3px solid rgba(128,128,128,.4);opacity:.9}",
			".ttl-md hr{border:0;border-top:1px solid rgba(128,128,128,.28);margin:12px 0}",
			".ttl-md a{color:inherit;text-decoration:underline;text-underline-offset:2px}",
			".ttl-md table{border-collapse:collapse;margin:8px 0;font-size:12.5px}",
			".ttl-md th,.ttl-md td{border:1px solid rgba(128,128,128,.28);padding:3px 7px;text-align:left}",
			".ttl-code{flex:1;min-height:0;overflow:auto;padding:6px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.55}",
			".ttl-line{display:flex;gap:8px;white-space:pre-wrap;word-break:break-word;padding:0 10px}",
			".ttl-line:hover{background:rgba(128,128,128,.08)}",
			".ttl-ln{flex:none;min-width:34px;text-align:right;opacity:.45;user-select:none}",
			".ttl-lc{flex:1;min-width:0;white-space:pre-wrap}",
			".ttl-imgwrap{flex:1;min-height:0;overflow:auto;padding:10px;display:flex;align-items:flex-start;justify-content:center;background:rgba(128,128,128,.06)}",
			".ttl-tk-key{color:#82aaff}",
			".ttl-tk-str{color:#c3e88d}",
			".ttl-tk-num{color:#f78c6c}",
			".ttl-tk-com{color:#7b8497;font-style:italic}",
			"[data-chat-anchor-key].ttl-flash{animation:ttl-flash 2s ease-out 1;border-radius:8px}",
			"@keyframes ttl-flash{0%{box-shadow:0 0 0 2px rgba(120,160,255,.95),0 0 24px rgba(120,160,255,.45)}70%{box-shadow:0 0 0 2px rgba(120,160,255,.5)}100%{box-shadow:0 0 0 0 rgba(120,160,255,0)}}",
			".ttl-ledger{flex:none;margin:6px 8px 0;border:1px solid rgba(128,128,128,.28);border-radius:8px;overflow:hidden;background:rgba(128,128,128,.04)}",
			".ttl-lghead{display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:12px;cursor:pointer;background:rgba(128,128,128,.09);user-select:none}",
			".ttl-lghead:hover{background:rgba(128,128,128,.15)}",
			".ttl-lgtot{font-weight:600}",
			".ttl-lgchip{flex:none;border-radius:5px;padding:0 5px;font-size:11px;background:rgba(128,128,128,.2)}",
			".ttl-lgwarn{color:#c97a1e;font-weight:600}",
			".ttl-lgerr{color:#d05a5a}",
			".ttl-lgspacer{flex:1}",
			".ttl-lgbody{max-height:190px;overflow:auto;border-top:1px solid rgba(128,128,128,.2)}",
			".ttl-lgrow{display:flex;gap:6px;align-items:baseline;padding:4px 8px;font-size:12px;line-height:1.45;cursor:pointer}",
			".ttl-lgrow:hover{background:rgba(120,160,255,.12)}",
			".ttl-lgid{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.6}",
			".ttl-lgtext{flex:1;min-width:0;word-break:break-word}",
			".ttl-lgowner,.ttl-lgage{flex:none;font-size:11px;opacity:.6}",
			".ttl-lgkind{flex:none;font-size:11px;padding:0 4px;border-radius:5px;background:rgba(128,128,128,.2)}",
			".ttl-lgkind.k0{background:rgba(230,120,120,.25)}",
			".ttl-lgkind.k1{background:rgba(110,160,240,.25)}",
			".ttl-lgkind.k2{background:rgba(150,200,120,.25)}",
			".ttl-lgempty{padding:6px 8px;font-size:12px;opacity:.6}"
		].join("");
		const tagId = "dsh-turn-timeline/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-turn-timeline";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region helpers
		const DICT = {
			zh: {
				nav: "任务时间线",
				title: "任务时间线",
				refresh: "刷新",
				filter: "筛选会话…",
				loading: "读取会话…",
				empty: "这个工作区还没有会话。",
				jumpHint: "点击：跳到该轮并在右侧栏打开；右键：在本面板内预览",
				fail: "读取失败：",
				turns: "轮",
			children: "子代理会话",
				uncategorized: "未分类",
				newFolder: "新建文件夹",
				folderName: "文件夹名称",
				rename: "重命名",
				remove: "从时间线移除",
				restore: "加回时间线",
				pool: "未进入时间线",
				poolEmpty: "没有被移除的会话。",
				poolHint: "移除的会话会落到这里，随时可以加回。",
				dropHere: "拖到这里归入该文件夹",
				folderDelete: "删除文件夹（里面的会话回到未分类）",
				save: "保存",
				cancel: "取消",
				dragHint: "按住拖到文件夹名上即可归类",
				noFiles: "（无文件产出）",
				all: "全部工作区",
				back: "返回",
				zoomIn: "放大",
				zoomOut: "缩小",
				openSide: "在右侧栏打开并切回会话",
				sentSide: "已发送到右侧栏，正在切回会话…",
				sideFail: "右侧栏拒绝：",
				ledger: "未关闭项",
				ledgerEmpty: "没有未关闭项。",
				ledgerHint: "来自工作区台账文件，只读；点条目打开原文",
				ledgerOpen: "打开台账原文",
				ledgerErrors: "条台账解析错误",
				ledgerStale: "陈",
				ledgerClosed: "已关闭"
			},
			en: {
				nav: "Task timeline",
				title: "Task timeline",
				refresh: "Refresh",
				filter: "Filter sessions…",
				loading: "Reading sessions…",
				empty: "No sessions in this workspace yet.",
				jumpHint: "Click: jump to the turn and open in the right sidebar. Right click: preview here.",
				fail: "Failed: ",
				turns: "turn",
			children: "Subagent sessions",
				uncategorized: "Unfiled",
				newFolder: "New folder",
				folderName: "Folder name",
				rename: "Rename",
				remove: "Remove from timeline",
				restore: "Add back to timeline",
				pool: "Not in timeline",
				poolEmpty: "Nothing was removed.",
				poolHint: "Removed sessions land here and can be added back.",
				dropHere: "Drop here to file into this folder",
				folderDelete: "Delete folder (its sessions go back to Unfiled)",
				save: "Save",
				cancel: "Cancel",
				dragHint: "Drag a session onto a folder name to file it",
				noFiles: "(no files)",
				all: "All workspaces",
				back: "Back",
				zoomIn: "Larger",
				zoomOut: "Smaller",
				openSide: "Open in right sidebar",
				sentSide: "Sent to the right sidebar",
				sideFail: "Right sidebar refused: ",
				ledger: "Unclosed items",
				ledgerEmpty: "Nothing is left open.",
				ledgerHint: "Read-only view of the workspace ledger; click a row to open its source",
				ledgerOpen: "Open ledger file",
				ledgerErrors: " ledger parse errors",
				ledgerStale: "stale",
				ledgerClosed: "closed"
			}
		};
		function makeT() {
			const lang = (typeof document !== "undefined" && document.documentElement?.getAttribute("lang")) || "zh";
			const dict = DICT[lang.startsWith("zh") ? "zh" : "en"];
			return (key) => dict[key] ?? DICT.zh[key] ?? key;
		}
		const t0 = makeT();

		/**
		 * Services resolved through `ctx.inject` — a client plugin reaches other
		 * packages' services through its own context, not through `ctx.get`.
		 * @type {{ betterSidebar?: any, sidebarRight?: any }}
		 */
		const services = {};

		function tryGet(ctx, name) {
			try {
				return ctx.get?.(name);
			} catch {
				return undefined;
			}
		}

		function isInside(cwd, path) {
			if (typeof cwd !== "string" || cwd === "") return false;
			const root = cwd.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
			const target = String(path ?? "").replace(/\\/g, "/").toLowerCase();
			return target === root || target.startsWith(root + "/");
		}

		/** A collapsed right pane renders nothing: unfold it after the tab is opened. */
		function unfoldRight() {
			const right = services.sidebarRight;
			try {
				const collapsed = right !== undefined && typeof right.isExpanded === "function" && right.isExpanded() === false;
				if (collapsed && typeof right.toggleExpanded === "function") right.toggleExpanded();
			} catch (error) {
				console.warn("[turn-timeline] unfold right sidebar failed:", error);
			}
		}

		/**
		 * Zoom for the right sidebar. Its content belongs to other packages (the
		 * better-sidebar editor, the built-in viewers, the office renderer), so no
		 * font-size knob reaches all of them — CSS `zoom` on the dock pane scales the
		 * whole surface, images and tables included.
		 */
		const RIGHT_ZOOM_KEY = "dsh-turn-timeline:rightZoom";
		const RIGHT_ZOOM_PANES = '[data-sidebar-right-session] [data-dockkit-pane], [data-sidebar-right-session] [data-dockkit-float]';

		function readRightZoom() {
			try {
				const raw = Number(window.localStorage.getItem(RIGHT_ZOOM_KEY));
				return Number.isFinite(raw) && raw >= 0.6 && raw <= 2.4 ? raw : 1;
			} catch {
				return 1;
			}
		}

		function applyRightZoom(value, quiet) {
			const zoom = Math.round(Math.min(2.4, Math.max(0.6, value)) * 10) / 10;
			try {
				window.localStorage.setItem(RIGHT_ZOOM_KEY, String(zoom));
			} catch {
				/* private mode: the zoom still applies for this page */
			}
			let applied = 0;
			for (const pane of document.querySelectorAll(RIGHT_ZOOM_PANES)) {
				pane.style.zoom = zoom === 1 ? "" : String(zoom);
				applied += 1;
			}
			if (applied === 0 && quiet !== true) console.warn("[turn-timeline] right sidebar pane not found; zoom kept for the next one");
			return zoom;
		}

		/**
		 * Ctrl+Alt+= / Ctrl+Alt+- / Ctrl+Alt+0 zoom whichever right pane is open.
		 * The keyboard route beats a button here: the pane has no room of ours, and the
		 * shortcut also works while the caret sits inside its editor.
		 */
		function installRightZoom() {
			applyRightZoom(readRightZoom(), true);
			// Ctrl+wheel is the habit; it only ever touches the right pane, so the page
			// keeps its own Ctrl+wheel zoom everywhere else.
			const onWheel = (event) => {
				if (!event.ctrlKey || event.metaKey) return;
				if (event.deltaY === 0) return;
				const target = event.target instanceof Element ? event.target.closest("[data-sidebar-right-session]") : null;
				if (target === null) return;
				event.preventDefault();
				event.stopPropagation();
				applyRightZoom(readRightZoom() + (event.deltaY < 0 ? 0.1 : -0.1));
			};
			window.addEventListener("wheel", onWheel, { passive: false, capture: true });
			const onKey = (event) => {
				if (!event.ctrlKey || !event.altKey || event.metaKey) return;
				const key = event.key;
				const step = key === "=" || key === "+" || key === "ArrowUp" ? 0.1 : key === "-" || key === "_" || key === "ArrowDown" ? -0.1 : key === "0" ? 0 : null;
				if (step === null) return;
				event.preventDefault();
				const next = step === 0 ? 1 : readRightZoom() + step;
				const zoom = applyRightZoom(next);
				console.info(`[turn-timeline] right sidebar zoom ${Math.round(zoom * 100)}%`);
			};
			window.addEventListener("keydown", onKey, true);
			// Panes mount and unmount with every session switch: re-apply when they appear.
			let queued = 0;
			const observer = new MutationObserver(() => {
				if (queued !== 0) return;
				queued = window.setTimeout(() => {
					queued = 0;
					const zoom = readRightZoom();
					if (zoom === 1) return;
					for (const pane of document.querySelectorAll(RIGHT_ZOOM_PANES)) pane.style.zoom = String(zoom);
				}, 200);
			});
			observer.observe(document.body, { childList: true, subtree: true });
			return () => {
				window.removeEventListener("wheel", onWheel, true);
				window.removeEventListener("keydown", onKey, true);
				observer.disconnect();
				if (queued !== 0) window.clearTimeout(queued);
			};
		}

		/** Hand the main slot back to the conversation so its right sidebar can draw. */
		function revealConversation() {
			const layout = services.layout;
			try {
				layout?.selectPanel?.(null);
			} catch (error) {
				console.warn("[turn-timeline] selectPanel(null) failed:", error);
			}
		}

		/** Collapse whitespace so DOM text and log text can be compared. */
		function flatten(text) {
			return String(text ?? "").replace(/\s+/g, " ").trim();
		}

		/** Find the chat row that carries a turn's opening message. */
		function findTurnRow(userText) {
			if (typeof document === "undefined") return null;
			const needle = flatten(userText).slice(0, 40);
			if (needle.length < 6) return null;
			const rows = document.querySelectorAll("[data-chat-anchor-key]");
			let partial = null;
			for (const row of rows) {
				const text = flatten(row.textContent);
				if (text.includes(needle)) return row;
				if (partial === null && needle.length >= 12 && text.includes(needle.slice(0, 12))) partial = row;
			}
			return partial;
		}

		/** Scroll to the row and flash it, so "this turn" is unmistakable. */
		function focusTurn(userText) {
			const row = findTurnRow(userText);
			if (row === null) {
				return false;
				return false;
			}
			try {
				row.scrollIntoView({ block: "center", behavior: "smooth" });
			} catch {
				row.scrollIntoView();
			}
			row.classList.remove("ttl-flash");
			// Force a reflow so the animation restarts when the same row is re-picked.
			void row.offsetWidth;
			row.classList.add("ttl-flash");
			setTimeout(() => row.classList.remove("ttl-flash"), 2200);
			return true;
		}

		/**
		 * The flow the user asked for: jump to the conversation that produced the
		 * file, park the view on that turn, then open the file in that
		 * conversation's right sidebar — which only exists once it is on screen.
		 */
		function jumpToTurn(ctx, session, turn, path) {
			const needle = turn?.user ?? turn?.label ?? "";
			// Already on screen: do not touch the session view at all. Re-opening a session
			// reloads its history, and a transcript with a stale subagent descriptor fails
			// that reload — the row we can see is worth more than a fresh mount.
			if (needle && focusTurn(needle)) {
				openFile(ctx, session, path);
				unfoldRight();
				return true;
			}
			const workspace = services.uiWorkspace;
			if (workspace === undefined || typeof workspace.openSession !== "function") {
				services.reason = "uiWorkspace missing";
				return false;
			}
			try {
				workspace.openSession(session.id);
			} catch (error) {
				services.reason = `openSession: ${String(error?.message ?? error)}`;
				return false;
			}
			let tries = 0;
			const step = () => {
				revealConversation();
				tries += 1;
				const hit = focusTurn(needle);
				// A session that is not on screen yet has no rows: retry briefly.
				if (!hit && tries < 8) {
					setTimeout(step, 250);
					return;
				}
				if (!hit) console.warn("[turn-timeline] no chat row matched:", flatten(needle).slice(0, 40));
				openFile(ctx, session, path);
				unfoldRight();
			};
			setTimeout(step, 200);
			return true;
		}

		/**
		 * Ask the right sidebar to open one file. Returns true when some service
		 * accepted the request; a service may throw (no session on screen), so every
		 * attempt is isolated and the next one runs instead. The last refusal is kept
		 * on `services.reason` so the UI can say why instead of doing nothing.
		 */
		function openFile(ctx, session, path) {
			const better = services.betterSidebar;
			const right = services.sidebarRight;
			const cwd = session.cwd;
			const scope = { sessionId: session.id, ...(typeof cwd === "string" && cwd !== "" ? { cwd } : {}) };
			const name = baseName(path);
			services.reason = "";
			let address;
			try {
				address = fileAddress(session.id, cwd, path);
			} catch {
				address = undefined;
			}
			/** One isolated attempt; false means "not handled, try the next". */
			const attempt = (what, run) => {
				try {
					run();
					return true;
				} catch (error) {
					services.reason = `${what}: ${String(error?.message ?? error)}`;
					console.warn(`[turn-timeline] ${what} threw for ${path}:`, error);
					return false;
				}
			};
			if (better === undefined) services.reason = services.reason || "betterSidebar missing";
			if (right === undefined) services.reason = services.reason || "sidebarRight missing";

			const outside = !isInside(cwd, path);
			// better-sidebar owns the right pane's tabs and renders each file with the
			// viewer it already has (markdown, code, office). It is also the only one
			// that accepts a path outside the session workspace.
			if (better !== undefined && typeof better.openFile === "function") {
				if (attempt("betterSidebar.openFile", () => better.openFile(scope, path, name))) return true;
			}
			if (right !== undefined && typeof right.openResourceIn === "function" && address !== undefined) {
				if (attempt("sidebarRight.openResourceIn", () => right.openResourceIn(session.id, address, { destination: "sidebar" }))) return true;
			}
			if (right !== undefined && typeof right.openResource === "function" && address !== undefined) {
				if (attempt("sidebarRight.openResource", () => right.openResource(address, { kind: "text" }))) return true;
			}
			console.warn("[turn-timeline] no preview service accepted", path, {
				betterSidebar: better !== undefined,
				sidebarRight: right !== undefined
			});
			return false;
		}


		function shortId(id) {
			const text = String(id ?? "");
			return text.length > 14 ? text.slice(0, 8) + "…" + text.slice(-4) : text;
		}

		function timeOf(ms) {
			if (typeof ms !== "number" || ms <= 0) return "";
			const date = new Date(ms);
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}

		function baseName(path) {
			const parts = String(path ?? "").replace(/\\/g, "/").split("/");
			return parts[parts.length - 1] || path;
		}

		/** Encode one path segment for a `dsh-resource://file/session/...` address. */
		function encodeSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}

		/** `session`-scoped file address: the only form the builtin preview accepts. */
		function fileAddress(sessionId, cwd, path) {
			const normalized = String(path ?? "").replace(/\\/g, "/");
			const root = String(cwd ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
			let relative = normalized;
			if (root !== "" && normalized.toLowerCase().startsWith(root.toLowerCase() + "/")) relative = normalized.slice(root.length + 1);
			else if (root !== "" && normalized.toLowerCase() === root.toLowerCase()) relative = "";
			relative = relative.replace(/^(?:\.\/)+/, "");
			return `dsh-resource://file/session/${encodeSegment(String(sessionId))}/${relative.split("/").map(encodeSegment).join("/")}`;
		}

		async function getJson(path) {
			const response = await fetch(path, { headers: { accept: "application/json" } });
			const body = await response.json().catch(() => undefined);
			if (!response.ok || body?.ok !== true) throw new Error(`${path} → ${response.status} ${JSON.stringify(body)}`);
			return body;
		}
		//#endregion

		//#region components
		/** Sidebar row icon. */
		function Icon({ size }) {
			return h(
				"svg",
				{ width: size ?? 16, height: size ?? 16, viewBox: "0 0 16 16", "aria-hidden": "true" },
				h("circle", { cx: 8, cy: 8, r: 6.2, fill: "none", stroke: "currentColor", strokeWidth: 1.2, opacity: 0.85 }),
				h("path", { d: "M8 4.4V8l2.6 1.7", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })
			);
		}

		/**
		 * One file chip: a click travels to the turn that produced it and opens the
		 * file there; a right click keeps the body in this panel instead.
		 */
		function Chip({ ctx, session, turn, path, deliverables, onPreview }) {
			const title = `${deliverables ? `${t0("deliverables")}: ` : ""}${path}\n${t0("jumpHint")}`;
			return h(
				"button",
				{
					type: "button",
					className: "ttl-chip",
					title,
					onClick: () => {
						if (jumpToTurn(ctx, session, turn, path)) return;
						if (typeof onPreview === "function") onPreview(session, path);
					},
					onContextMenu: (event) => {
						event.preventDefault();
						if (typeof onPreview === "function") onPreview(session, path);
					}
				},
				(deliverables ? "◈ " : "") + baseName(path)
			);
		}

		function ToolSummary({ tools }) {
			const names = Object.keys(tools ?? {}).sort((a, b) => tools[b] - tools[a]).slice(0, 3);
			if (names.length === 0) return null;
			return h(
				"span",
				{ style: { display: "inline-flex", gap: 4, flexWrap: "wrap" } },
				names.map((name) => h("span", { key: name, className: "ttl-tool" }, `${name}×${tools[name]}`))
			);
		}

		/** A single turn inside an expanded segment. */
		function TurnRow({ ctx, session, turn, onPreview }) {
			const files = Array.isArray(turn.files) ? turn.files : [];
			const deliverables = Array.isArray(turn.deliverables) ? turn.deliverables : [];
			return h(
				"div",
				{ className: "ttl-turn" },
				h(
					"div",
					{ className: "ttl-turntop" },
					h("span", { className: "ttl-n" }, `#${turn.turn}`),
					h("span", { className: "ttl-ttext", title: turn.user || turn.final }, turn.label || turn.user || turn.final || t0("empty")),
					h(ToolSummary, { tools: turn.tools })
				),
				files.length + deliverables.length === 0
					? null
					: h(
							"div",
							{ className: "ttl-chiprow" },
							deliverables.map((path) => h(Chip, { key: `d:${path}`, ctx, session, turn, path, deliverables: true, onPreview })),
							files.map((path) => h(Chip, { key: `f:${path}`, ctx, session, turn, path, onPreview }))
						)
			);
		}

		/** A task stretch: turns that belong together, with their union of files. */
		function Segment({ ctx, session, segment, turns, onPreview }) {
			const [open, setOpen] = React.useState(true);
			const range = segment.from === segment.to ? `${segment.from}` : `${segment.from}–${segment.to}`;
			const own = turns.filter((turn) => segment.turns.includes(turn.turn));
			return h(
				"div",
				{ className: "ttl-seg" },
				h(
					"div",
					{ className: "ttl-seghead", onClick: () => setOpen(!open) },
					h("span", { className: "ttl-caret" }, open ? "▾" : "▸"),
					h("span", { className: "ttl-badge" }, `${t0("turns")} ${range}`),
					h("span", { className: "ttl-seglabel", title: segment.label }, segment.label || t0("empty"))
				),
				open ? h("div", { className: "ttl-turns" }, own.map((turn) => h(TurnRow, { key: turn.turn, ctx, session, turn, onPreview }))) : null
			);
		}

		/** One session block: header row plus, when expanded, its task segments. */
		function SessionBlock(props) {
			const {
				ctx, session, child, expanded, onToggle, detail, onRetry, onPreview,
				label, draggable, dragging, onDragStart, onDragEnd,
				renaming, renameValue, onRenameStart, onRenameChange, onRenameCommit, onRenameCancel,
				onRemove, onRestore
			} = props;
			const meta = detail !== undefined && detail !== "loading" && detail !== null
				? `${detail.segments.length} · ${detail.turns.length} ${t0("turns")}`
				: timeOf(session.createdAt);
			const actions = [];
			if (onRestore !== undefined) {
				actions.push(h("button", { key: "restore", type: "button", className: "ttl-btn ttl-rowbtn", title: t0("restore"), onClick: (event) => { event.stopPropagation(); onRestore(); } }, "＋"));
			}
			if (onRenameStart !== undefined) {
				actions.push(h("button", { key: "rename", type: "button", className: "ttl-btn ttl-rowbtn", title: t0("rename"), onClick: (event) => { event.stopPropagation(); onRenameStart(); } }, "✎"));
			}
			if (onRemove !== undefined) {
				actions.push(h("button", { key: "remove", type: "button", className: "ttl-btn ttl-rowbtn", title: t0("remove"), onClick: (event) => { event.stopPropagation(); onRemove(); } }, "×"));
			}
			return h(
				"div",
				{
					className: `ttl-session${expanded ? " open" : ""}${dragging === true ? " dragging" : ""}`,
					draggable: draggable === true,
					onDragStart,
					onDragEnd
				},
				h(
					"div",
					{ className: "ttl-srow", onClick: renaming === true ? undefined : onToggle },
					h("span", { className: "ttl-caret" }, expanded ? "▾" : "▸"),
					renaming === true
						? h("input", {
								className: "ttl-rename",
								value: renameValue ?? "",
								autoFocus: true,
								onClick: (event) => event.stopPropagation(),
								onChange: (event) => onRenameChange(event.target.value),
								onBlur: onRenameCommit,
								onKeyDown: (event) => {
									if (event.key === "Enter") onRenameCommit();
									else if (event.key === "Escape") onRenameCancel();
								}
							})
						: h("span", { className: "ttl-sname", title: label || session.id }, label || shortId(session.id)),
					child === true ? h("span", { className: "ttl-tag", title: session.parentSession }, "子代理") : null,
					...actions,
					h("span", { className: "ttl-meta" }, meta)
				),
				expanded
					? detail === "loading"
						? h("div", { className: "ttl-loading" }, t0("loading"))
						: detail instanceof Error
							? h(
									"div",
									{ className: "ttl-err", onClick: onRetry },
									`${t0("fail")}${detail.message}`
								)
							: h(
									"div",
									{ style: { paddingBottom: 4 } },
									detail.segments.length === 0
										? h("div", { className: "ttl-empty" }, t0("empty"))
										: detail.segments.map((segment, index) =>
												h(Segment, { key: `${session.id}:${segment.from}:${index}`, ctx, session: { ...session, cwd: detail.cwd ?? session.cwd }, segment, turns: detail.turns, onPreview })
											)
								)
					: null
			);
		}

		/** Keeps one bad render from taking the window down with it. */
		class Boundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error !== null) {
					return h(
						"div",
						{ className: "ttl-err", style: { margin: 10 } },
						`${this.props.t("fail")}${String(this.state.error?.message ?? this.state.error)}`
					);
				}
				return this.props.children;
			}
		}

		/** Escape the five characters that can break out of text content. */
		function escapeHtml(text) {
			return String(text).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
		}

		/** Inline markdown on one already-escaped line. */
		function mdInline(text) {
			let out = escapeHtml(text);
			out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
			out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
			out = out.replace(/(^|[^\w*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
			out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
			return out;
		}

		/**
		 * A deliberately small markdown reader: headings, lists, quotes, fenced
		 * code, rules and inline marks. No dependency ships with the plugin, and a
		 * blog post is what these files actually are.
		 */
		function mdToHtml(markdown) {
			const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
			const out = [];
			let list = null;
			const closeList = () => {
				if (list !== null) {
					out.push(`</${list}>`);
					list = null;
				}
			};
			let index = 0;
			while (index < lines.length) {
				const line = lines[index];
				if (/^\s*```/.test(line)) {
					const lang = line.trim().slice(3).trim();
					const body = [];
					index += 1;
					while (index < lines.length && !/^\s*```/.test(lines[index])) {
						body.push(lines[index]);
						index += 1;
					}
					index += 1;
					closeList();
					out.push(`<pre class="ttl-mdcode"${lang === "" ? "" : ` data-lang="${escapeHtml(lang)}"`}>${escapeHtml(body.join("\n"))}</pre>`);
					continue;
				}
				if (/^\s*$/.test(line)) {
					closeList();
					index += 1;
					continue;
				}
				const heading = /^(#{1,6})\s+(.*)$/.exec(line);
				if (heading !== null) {
					closeList();
					const level = heading[1].length;
					out.push(`<h${level}>${mdInline(heading[2])}</h${level}>`);
					index += 1;
					continue;
				}
				if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
					closeList();
					out.push("<hr>");
					index += 1;
					continue;
				}
				const quote = /^\s*>\s?(.*)$/.exec(line);
				if (quote !== null) {
					closeList();
					out.push(`<blockquote>${mdInline(quote[1])}</blockquote>`);
					index += 1;
					continue;
				}
				const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
				if (bullet !== null) {
					if (list !== "ul") {
						closeList();
						out.push("<ul>");
						list = "ul";
					}
					out.push(`<li>${mdInline(bullet[1])}</li>`);
					index += 1;
					continue;
				}
				const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
				if (ordered !== null) {
					if (list !== "ol") {
						closeList();
						out.push("<ol>");
						list = "ol";
					}
					out.push(`<li>${mdInline(ordered[1])}</li>`);
					index += 1;
					continue;
				}
				closeList();
				out.push(`<p>${mdInline(line)}</p>`);
				index += 1;
			}
			closeList();
			return out.join("\n");
		}

		/** Words worth colouring when a file is shown as source. */
		const CODE_WORDS = new Set([
			"const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "class", "extends", "super",
			"import", "from", "export", "default", "async", "await", "new", "try", "catch", "finally", "throw", "typeof",
			"instanceof", "in", "of", "this", "null", "undefined", "true", "false", "switch", "case", "break", "continue",
			"yield", "delete", "void", "static", "get", "set", "def", "elif", "None", "True", "False", "self", "lambda",
			"with", "as", "pass", "raise", "except", "not", "and", "or", "global", "nonlocal", "print", "echo", "fi",
			"then", "end", "local", "type", "interface", "enum", "public", "private", "protected", "readonly", "namespace"
		]);
		const CODE_TOKEN = /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;

		/** Split one source line into coloured pieces; plain text keeps zero spans. */
		function codeTokens(line) {
			const pieces = [];
			let last = 0;
			CODE_TOKEN.lastIndex = 0;
			let match = CODE_TOKEN.exec(line);
			while (match !== null) {
				if (match.index > last) pieces.push({ text: line.slice(last, match.index), cls: "" });
				const word = match[4];
				let cls = "";
				if (match[1] !== undefined) cls = "ttl-tk-com";
				else if (match[2] !== undefined) cls = "ttl-tk-str";
				else if (match[3] !== undefined) cls = "ttl-tk-num";
				else if (word !== undefined && CODE_WORDS.has(word)) cls = "ttl-tk-key";
				pieces.push({ text: match[0], cls });
				last = match.index + match[0].length;
				match = CODE_TOKEN.exec(line);
			}
			if (last < line.length) pieces.push({ text: line.slice(last), cls: "" });
			return pieces;
		}

		/** Render whatever the host said this file is. */
		function renderBody(body) {
			if (body.kind === "image" && typeof body.dataUrl === "string") {
				return h("div", { className: "ttl-imgwrap" }, h("img", { className: "ttl-img", src: body.dataUrl, alt: "" }));
			}
			if (body.kind === "markdown") {
				return h("div", { className: "ttl-md", dangerouslySetInnerHTML: { __html: mdToHtml(body.text ?? "") } });
			}
			if (body.kind === "code") {
				const source = String(body.text ?? "");
				const lines = source.replace(/\r\n?/g, "\n").split("\n");
				const color = source.length <= 160000 && lines.length <= 6000;
				return h(
					"div",
					{ className: "ttl-code" },
					lines.map((line, number) =>
						h(
							"div",
							{ className: "ttl-line", key: number },
							h("span", { className: "ttl-ln" }, number + 1),
							color
								? h(
										"span",
										{ className: "ttl-lc" },
										codeTokens(line).map((piece, index) =>
											piece.cls === "" ? piece.text : h("span", { className: piece.cls, key: index }, piece.text)
										)
									)
								: h("span", { className: "ttl-lc" }, line === "" ? " " : line)
						)
					)
				);
			}
			return h("pre", { className: "ttl-pre" }, body.text ?? "");
		}

		/**
		 * panel shows the body itself instead of doing nothing.
		 */
		function PreviewView({ ctx, preview, onClose, t }) {
			const [state, setState] = React.useState({ status: "loading" });
			const [side, setSide] = React.useState(null);
			const path = preview.path;
			// A ledger source is a workspace file, not a session output: it has no
			// session and no "open in right sidebar" gesture, only the text.
			const isLedger = preview.ledger === true;
			const sessionId = isLedger ? "" : preview.session.id;
			const ledgerCwd = preview.cwd ?? "";
			React.useEffect(() => {
				let cancelled = false;
				setState({ status: "loading" });
				const url = isLedger
					? `${API}/ledger/file?cwd=${encodeURIComponent(ledgerCwd)}&path=${encodeURIComponent(path)}`
					: `${API}/file?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`;
				fetch(url, { headers: { accept: "application/json" } })
					.then(async (response) => ({ status: response.status, body: await response.json().catch(() => undefined) }))
					.then(({ body }) => {
						if (cancelled) return;
						if (body?.ok === true) setState({ status: "ready", body: isLedger ? { ...body, kind: "markdown" } : body });
						else setState({ status: "error", message: String(body?.error ?? "load-failed") });
					})
					.catch((error) => {
						if (!cancelled) setState({ status: "error", message: String(error?.message ?? error) });
					});
				return () => {
					cancelled = true;
				};
			}, [sessionId, path, isLedger, ledgerCwd]);
			const title = baseName(path);
			const subtitle = state.status === "ready"
				? `${Math.max(1, Math.round(state.body.size / 1024))} KB`
				: state.status === "error"
					? `${t("fail")}${state.message}`
					: t("loading");
			return h(
				"div",
				{ className: "ttl-preview" },
				h(
					"div",
					{ className: "ttl-pvhead" },
					h("button", { type: "button", className: "ttl-btn", title: t("back"), onClick: onClose }, "←"),
					h("span", { className: "ttl-pvname", title: path }, title),
					isLedger
						? null
						: h("button", {
						type: "button",
						className: "ttl-btn",
						title: t("openSide"),
						onClick: () => {
							// The right sidebar is a per-session face: it only exists once the
							// conversation owns the main slot. So give the screen back first,
							// then ask for the file again — opening it while this panel is up
							// records nothing that can be drawn later.
							const ok = openFile(ctx, preview.session, path);
							setSide(ok ? { ok: true } : { ok: false, reason: services.reason });
							if (!ok) return;
							setTimeout(() => {
								revealConversation();
								setTimeout(() => {
									const again = openFile(ctx, preview.session, path);
									if (!again) console.warn("[turn-timeline] reopen after reveal failed:", services.reason);
								}, 320);
							}, 140);
						}
					}, "⧉"),
					h("span", { className: "ttl-meta" }, subtitle)
				),
				h("div", { className: "ttl-pvpath", title: path }, path),
				side === null
					? null
					: h("div", { className: side.ok ? "ttl-note" : "ttl-err" }, side.ok ? t("sentSide") : `${t("sideFail")}${side.reason}`),
				state.status === "ready"
					? renderBody(state.body)
					: h("div", { className: state.status === "error" ? "ttl-err" : "ttl-loading" }, subtitle)
			);
		}

		/** The panel body: workspace picker, session filter, session list. */
		function Panel(props) {
			const ctx = props.ctx;
			const t = props.t ?? t0;
			const [index, setIndex] = React.useState(null);
			const [failure, setFailure] = React.useState(null);
			const [tick, setTick] = React.useState(0);
			const [cwd, setCwd] = React.useState("");
			const [query, setQuery] = React.useState("");
			const [expanded, setExpanded] = React.useState({});
			const [details, setDetails] = React.useState({});
			const [preview, setPreview] = React.useState(null);
			const [ledger, setLedger] = React.useState(null);
			const [ledgerOpen, setLedgerOpen] = React.useState(false);
			const [showChildren, setShowChildren] = React.useState(false);
			const [layout, setLayout] = React.useState({ folders: [], items: {} });
			const [pool, setPool] = React.useState(false);
			const [closedFolders, setClosedFolders] = React.useState({});
			const [addingFolder, setAddingFolder] = React.useState(false);
			const [folderDraft, setFolderDraft] = React.useState("");
			const [renaming, setRenaming] = React.useState(null);
			const [dragging, setDragging] = React.useState(null);
			const [dropFolder, setDropFolder] = React.useState(null);
			const [zoom, setZoom] = React.useState(() => {
				try {
					const saved = Number(localStorage.getItem(ZOOM_KEY));
					return Number.isFinite(saved) && saved >= 0.8 && saved <= 1.9 ? saved : 1;
				} catch {
					return 1;
				}
			});
			const applyZoom = (next) => {
				const value = Math.min(1.9, Math.max(0.8, Math.round(next * 10) / 10));
				setZoom(value);
				try {
					localStorage.setItem(ZOOM_KEY, String(value));
				} catch {
					// A locked-down profile may refuse storage; the session still zooms.
				}
			};

			React.useEffect(() => {
				let cancelled = false;
				setFailure(null);
				getJson(`${API}/index`)
					.then((body) => {
						if (cancelled) return;
						setIndex(body);
						setCwd((current) => {
							if (current !== "") return current;
							const first = body.workspaces[0];
							return first === undefined ? "" : first.key;
						});
					})
					.catch((error) => {
						if (!cancelled) setFailure(error);
					});
				return () => {
					cancelled = true;
				};
			}, [tick]);

			React.useEffect(() => {
				if (index === null) return;
				const sessions = index.sessions.filter((session) => (cwd === "" ? true : (session.cwd ?? "").replace(/\\/g, "/").toLowerCase() === cwd)).filter((session) => {
					if (query.trim() === "") return true;
					const needle = query.trim().toLowerCase();
					return (session.title ?? "").toLowerCase().includes(needle) || session.id.toLowerCase().includes(needle);
				});
				const newest = sessions[0];
				if (newest !== undefined && expanded[newest.id] === undefined && Object.keys(expanded).length === 0) {
					setExpanded({ [newest.id]: true });
					load(newest.id);
				}
			}, [index, cwd, query]);

			function load(id) {
				if (details[id] !== undefined && details[id] !== "loading") return;
				setDetails((current) => ({ ...current, [id]: "loading" }));
				getJson(`${API}/session/${encodeURIComponent(id)}`)
					.then((body) => setDetails((current) => ({ ...current, [id]: body })))
					.catch((error) => setDetails((current) => ({ ...current, [id]: error })));
			}

			function toggle(id) {
				const next = !expanded[id];
				setExpanded((current) => ({ ...current, [id]: next }));
				if (next) load(id);
			}

			React.useEffect(() => {
				getJson(`${API}/layout`)
					.then((body) => {
						if (body.ok !== false) setLayout({ folders: body.folders ?? [], items: body.items ?? {} });
					})
					.catch(() => {
						// The panel still works without the arrangement: everything is just unfiled.
					});
			}, [tick]);

			// The ledger is read-only workspace markdown: a failed read must never
			// take the timeline down with it, so errors are swallowed here and the
			// section simply stays empty.
			React.useEffect(() => {
				getJson(`${API}/ledger`)
					.then((body) => {
						if (body?.ok !== false) setLedger(body);
					})
					.catch(() => {});
			}, [tick]);

			/** Every arrangement change goes through here and replaces local state with the reply. */
			function post(body) {
				return fetch(`${API}/layout`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				})
					.then((response) => response.json())
					.then((result) => {
						if (result?.ok !== false) setLayout({ folders: result.folders ?? [], items: result.items ?? {} });
					})
					.catch(() => {});
			}

			function commitFolder() {
				const name = folderDraft.trim();
				setAddingFolder(false);
				setFolderDraft("");
				if (name !== "") post({ op: "folder.create", name });
			}

			function commitFolderRename() {
				if (renaming !== null && renaming.kind === "folder") {
					const name = renaming.value.trim();
					const id = renaming.id;
					setRenaming(null);
					if (name !== "") post({ op: "folder.rename", folderId: id, name });
					return;
				}
				setRenaming(null);
			}

			const workspaces = index?.workspaces ?? [];
			/** How the host normalised a cwd key, so ledger rows and sessions compare equal. */
			const wsKey = (value) => String(value ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
			const KIND_ORDER = ["待核实", "待办", "复盘"];
			const ageOf = (item) => {
				const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(item.createdAt ?? ""));
				if (match === null) return undefined;
				const stamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00+08:00`);
				return Number.isNaN(stamp) ? undefined : Math.floor((Date.now() - stamp) / 86400000);
			};
			const ledgerWorkspaces = (ledger?.workspaces ?? []).filter((workspace) => cwd === "" || wsKey(workspace.cwd) === cwd);
			const ledgerItems = ledgerWorkspaces.flatMap((workspace) =>
				(workspace.items ?? [])
					.filter((item) => item.status === "open")
					.map((item) => ({ ...item, cwd: workspace.cwd, age: ageOf(item) }))
			);
			const ledgerErrors = ledgerWorkspaces.reduce((sum, workspace) => sum + (workspace.errors?.length ?? 0), 0);
			const ledgerStale = ledgerItems.filter((item) => item.age !== undefined && item.age > 14).length;
			// The file the "open ledger" button shows: the selected workspace's, or the newest one.
			const ledgerCwd = cwd !== "" ? ledgerWorkspaces[0]?.cwd ?? "" : (ledger?.workspaces ?? [])[0]?.cwd ?? "";
			const openLedgerSource = (path) => {
				if (ledgerCwd !== "" && typeof path === "string" && path !== "") setPreview({ ledger: true, cwd: ledgerCwd, path });
			};
			const recorded = layout.items ?? {};
			const itemOf = (id) => recorded[id] ?? {};
			const labelOfSession = (session) => itemOf(session.id).name || session.title || shortId(session.id);
			const visible = (index?.sessions ?? [])
				.filter((session) => (cwd === "" ? true : (session.cwd ?? "").replace(/\\/g, "/").toLowerCase() === cwd))
				.filter((session) => {
					if (query.trim() === "") return true;
					const needle = query.trim().toLowerCase();
					return labelOfSession(session).toLowerCase().includes(needle) || session.id.toLowerCase().includes(needle);
				});
			// A subagent session is a detail of its parent, not a thread of its own: it is
			// read-only while the parent is offline and its transcript cannot be re-mounted.
			// Keep them out of the list unless asked for.
			const isChild = (session) => typeof session.parentSession === "string" && session.parentSession !== "";
			const removed = visible.filter((session) => !isChild(session) && itemOf(session.id).removed === true);
			const sessions = visible.filter((session) => !isChild(session) && itemOf(session.id).removed !== true);
			const childSessions = visible.filter(isChild);
			const groups = [
				{ key: "none", name: t("uncategorized"), sessions: sessions.filter((session) => !itemOf(session.id).folderId) },
				...layout.folders.map((folder) => ({
					key: folder.id,
					name: folder.name,
					sessions: sessions.filter((session) => itemOf(session.id).folderId === folder.id)
				}))
			];

			const renderSession = (session, options = {}) =>
				h(SessionBlock, {
					key: session.id,
					ctx,
					session,
					child: options.child === true,
					label: labelOfSession(session),
					draggable: options.child !== true,
					dragging: dragging === session.id,
					onDragStart: (event) => {
						setDragging(session.id);
						try {
							event.dataTransfer.setData("text/plain", session.id);
							event.dataTransfer.effectAllowed = "move";
						} catch {
							// Drag payload is a convenience; the row keeps the id in state.
						}
					},
					onDragEnd: () => {
						setDragging(null);
						setDropFolder(null);
					},
					renaming: renaming !== null && renaming.kind === "session" && renaming.id === session.id,
					renameValue: renaming?.value ?? "",
					onRenameStart: options.child === true ? undefined : () => setRenaming({ kind: "session", id: session.id, value: itemOf(session.id).name ?? "" }),
					onRenameChange: (value) => setRenaming((current) => (current === null ? current : { ...current, value })),
					onRenameCommit: () => {
						if (renaming !== null && renaming.kind === "session") post({ op: "item.rename", sessionId: renaming.id, name: renaming.value });
						setRenaming(null);
					},
					onRenameCancel: () => setRenaming(null),
					onRemove: options.child === true ? undefined : () => post({ op: "item.remove", sessionId: session.id }),
					expanded: expanded[session.id] === true,
					onToggle: () => toggle(session.id),
					detail: details[session.id],
					onPreview: (target, path) => setPreview({ session: target, path }),
					onRetry: () => {
						setDetails((current) => {
							const next = { ...current };
							delete next[session.id];
							return next;
						});
						load(session.id);
					}
				});

			const renderGroup = (group) => {
				const closed = closedFolders[group.key] === true;
				const isFolder = group.key !== "none";
				const renamingFolder = renaming !== null && renaming.kind === "folder" && renaming.id === group.key;
				return h(
					"div",
					{ key: group.key, className: "ttl-group" },
					h(
						"div",
						{
							className: `ttl-folder${isFolder ? "" : " plain"}${dropFolder === group.key ? " over" : ""}`,
							title: t("dropHere"),
							onClick: () => setClosedFolders((current) => ({ ...current, [group.key]: !closed })),
							onDragOver: (event) => {
								event.preventDefault();
								if (dropFolder !== group.key) setDropFolder(group.key);
							},
							onDragLeave: () => setDropFolder((current) => (current === group.key ? null : current)),
							onDrop: (event) => {
								event.preventDefault();
								const id = dragging ?? (event.dataTransfer.getData("text/plain") || "");
								if (id !== "") post({ op: "item.assign", sessionId: id, folderId: isFolder ? group.key : null });
								setDragging(null);
								setDropFolder(null);
							}
						},
						h("span", { className: "ttl-caret" }, closed ? "▸" : "▾"),
						renamingFolder
							? h("input", {
									className: "ttl-rename",
									value: renaming.value,
									autoFocus: true,
									onClick: (event) => event.stopPropagation(),
									onChange: (event) => setRenaming({ ...renaming, value: event.target.value }),
									onBlur: commitFolderRename,
									onKeyDown: (event) => {
										if (event.key === "Enter") commitFolderRename();
										else if (event.key === "Escape") setRenaming(null);
									}
								})
							: h(
									"span",
									{
										className: "ttl-foldername",
										onDoubleClick: isFolder
											? (event) => {
													event.stopPropagation();
													setRenaming({ kind: "folder", id: group.key, value: group.name });
												}
											: undefined
									},
									group.name
								),
						h("span", { className: "ttl-count" }, String(group.sessions.length)),
						isFolder
							? h(
									"button",
									{
										type: "button",
										className: "ttl-btn ttl-rowbtn",
										title: t("folderDelete"),
										onClick: (event) => {
											event.stopPropagation();
											post({ op: "folder.delete", folderId: group.key });
										}
									},
									"✕"
								)
							: null
					),
					closed ? null : group.sessions.map((session) => renderSession(session))
				);
			};

			if (preview !== null) {
				return h("div", { style: { zoom } }, h(PreviewView, { key: "preview", ctx, preview, onClose: () => setPreview(null), t }));
			}

			return h(
				"div",
				{ className: "ttl-root", style: { zoom } },
				h(
					"div",
					{ className: "ttl-head" },
					h("span", { className: "ttl-title" }, t("title")),
					h("span", { className: "ttl-meta", title: "sidebars resolved" }, `${VERSION} ${services.betterSidebar !== undefined ? "bs" : "--"}${services.sidebarRight !== undefined ? "sb" : "--"}`),
					h("button", { type: "button", className: "ttl-btn", title: t("zoomOut"), onClick: () => applyZoom(zoom - 0.1) }, "A−"),
					h("button", { type: "button", className: "ttl-btn", title: t("zoomIn"), onClick: () => applyZoom(zoom + 0.1) }, "A+"),
					workspaces.length > 1
						? h(
								"select",
								{
									className: "ttl-sel",
									value: cwd,
									title: t("all"),
									onChange: (event) => {
										setCwd(event.target.value);
										setExpanded({});
										setDetails({});
									}
								},
								workspaces.map((workspace) => {
									const openCount = (ledger?.workspaces ?? [])
										.filter((entry) => wsKey(entry.cwd) === workspace.key)
										.reduce((sum, entry) => sum + (entry.summary?.open ?? 0), 0);
									const label = `${baseName(workspace.cwd) || workspace.cwd} (${workspace.sessions})`;
									return h("option", { key: workspace.key, value: workspace.key }, openCount > 0 ? `${label} · ${openCount} ${t("ledger")}` : label);
								})
							)
						: null,
					h(
						"button",
						{ type: "button", className: "ttl-btn", title: t("refresh"), onClick: () => setTick(tick + 1) },
						"⟳"
					)
				),
				h("input", {
					className: "ttl-filter",
					placeholder: t("filter"),
					value: query,
					onChange: (event) => setQuery(event.target.value)
				}),
				h(
					"div",
					{ className: "ttl-tools" },
					addingFolder
						? h("input", {
								className: "ttl-newfolder",
								placeholder: t("folderName"),
								autoFocus: true,
								value: folderDraft,
								onChange: (event) => setFolderDraft(event.target.value),
								onBlur: commitFolder,
								onKeyDown: (event) => {
									if (event.key === "Enter") commitFolder();
									else if (event.key === "Escape") {
										setAddingFolder(false);
										setFolderDraft("");
									}
								}
							})
						: h(
								"button",
								{ type: "button", className: "ttl-btn ttl-tool", title: t("dragHint"), onClick: () => setAddingFolder(true) },
								`＋ ${t("newFolder")}`
							),
					h(
						"button",
						{ type: "button", className: `ttl-btn ttl-tool${pool ? " on" : ""}`, title: t("poolHint"), onClick: () => setPool(!pool) },
						`${pool ? "▾" : "▸"} ${t("pool")} (${removed.length})`
					)
				),
				ledgerItems.length === 0 && ledgerErrors === 0
					? null
					: h(
							"div",
							{ className: "ttl-ledger" },
							h(
								"div",
								{ className: "ttl-lghead", title: t("ledgerHint"), onClick: () => setLedgerOpen(!ledgerOpen) },
								h("span", null, `${ledgerOpen ? "▾" : "▸"} ${t("ledger")}`),
								h("span", { className: "ttl-lgtot" }, String(ledgerItems.length)),
								KIND_ORDER.map((kind, index) => {
									const count = ledgerItems.filter((item) => item.kind === kind).length;
									return count === 0 ? null : h("span", { key: kind, className: `ttl-lgkind k${index}` }, `${kind} ${count}`);
								}),
								ledgerStale > 0
									? h("span", { className: "ttl-lgchip ttl-lgwarn", title: t("ledgerStale") }, `${t("ledgerStale")} ${ledgerStale}`)
									: null,
								ledgerErrors > 0 ? h("span", { className: "ttl-lgchip ttl-lgerr" }, `${ledgerErrors} ${t("ledgerErrors")}`) : null,
								h("span", { className: "ttl-lgspacer" }),
								ledgerCwd === ""
									? null
									: h(
											"button",
											{
												type: "button",
												className: "ttl-btn",
												title: t("ledgerOpen"),
												onClick: (event) => {
													event.stopPropagation();
													openLedgerSource("50-knowledge/OPEN-ITEMS.md");
												}
											},
											"⧉"
										)
							),
							ledgerOpen
								? h(
										"div",
										{ className: "ttl-lgbody" },
										ledgerItems.length === 0
											? h("div", { className: "ttl-lgempty" }, t("ledgerEmpty"))
											: ledgerItems.map((item) =>
													h(
														"div",
														{
															className: "ttl-lgrow",
															key: `${item.cwd}:${item.id}`,
															title: item.file === undefined ? item.text : `${item.text}\n${item.file}`,
															onClick: () => openLedgerSource(item.file)
														},
														h("span", { className: `ttl-lgkind k${Math.max(0, KIND_ORDER.indexOf(item.kind))}` }, item.kind),
														h("span", { className: "ttl-lgid" }, item.id),
														h("span", { className: "ttl-lgtext" }, item.text),
														h("span", { className: "ttl-lgowner" }, item.owner === "" ? "—" : item.owner),
														item.age === undefined ? null : h("span", { className: "ttl-lgage" }, `${item.age}d`)
													)
												)
									)
								: null
						),
				h(
					"div",
					{ className: "ttl-body" },
					failure !== null
						? h("div", { className: "ttl-err" }, `${t("fail")}${failure.message}`)
						: index === null
							? h("div", { className: "ttl-loading" }, t("loading"))
							: pool
								? removed.length === 0
									? h("div", { className: "ttl-empty" }, t("poolEmpty"))
									: removed.map((session) =>
											h(SessionBlock, {
												key: session.id,
												ctx,
												session,
												label: labelOfSession(session),
												expanded: false,
												onToggle: () => {},
												detail: undefined,
												onPreview: (target, path) => setPreview({ session: target, path }),
												onRestore: () => post({ op: "item.restore", sessionId: session.id })
											})
										)
								: sessions.length === 0 && childSessions.length === 0
									? h("div", { className: "ttl-empty" }, t("empty"))
									: [
											...groups.map((group) => renderGroup(group)),
											childSessions.length === 0
												? null
												: h(
														"button",
														{
															key: "childtoggle",
															type: "button",
															className: "ttl-btn ttl-childtoggle",
															onClick: () => setShowChildren(!showChildren)
														},
														`${showChildren ? "▾" : "▸"} ${t("children")} (${childSessions.length})`
													),
											showChildren ? childSessions.map((session) => renderSession(session, { child: true })) : null
										]
				)
			);
		}
		//#endregion

		//#region plugin
		const inject = ["slots", "locale"];
		const zh = DICT.zh;
		const en = DICT.en;

		/**
		 * Client plugin body: register the `main` panel and its sidebar row.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			let layout;
			let t = makeT();
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-turn-timeline: dictionaries");
			if (typeof ctx.locale.bind === "function") t = ctx.locale.bind(NS);
			ctx.inject(["layout"], (scoped) => {
				layout = scoped.layout;
				services.layout = scoped.layout;
			});
			ctx.inject(["uiWorkspace"], (scoped) => {
				services.uiWorkspace = scoped.uiWorkspace;
			});
			// Optional peers: whichever of the two preview services exists wins.
			ctx.inject(["sidebarRight"], (scoped) => {
				services.sidebarRight = scoped.sidebarRight;
			});
			ctx.inject(["betterSidebar"], (scoped) => {
				services.betterSidebar = scoped.betterSidebar;
			});
			ctx.effect(() => installRightZoom(), "dsh-turn-timeline: right sidebar zoom");
			// The slots belong to other packages: register when they exist, not before.
			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
						locale: NS,
						inject: () => ({ t })
					},
					(props) => h(Boundary, { t }, h(Panel, { ...props, ctx, t }))
				)
			);
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: -1,
						label: () => t("nav"),
						locale: NS
					},
					({ size }) => h(Icon, { size })
				)
			);
			ctx.effect(() => () => {
				if (layout?.panelInfo.getSnapshot().activePanelId === PANEL_ID) layout.selectPanel(null);
			}, "dsh-turn-timeline: teardown");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
