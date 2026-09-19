import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMockPi } from "@juicesharp/rpiv-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAskUserQuestionTool } from "./ask-user-question.js";
import type { AskUserQuestionConfig } from "./config.js";

const keybindings = { matches: (_data: string, _name: string) => false };

const identityTheme = {
	fg: (_c: string, s: string) => s,
	bg: (_c: string, s: string) => s,
	bold: (s: string) => s,
	strikethrough: (s: string) => s,
};

const CTRL_RBRACKET = "\x1d";
const ALT_O = "\x1bo";

const params = {
	questions: [
		{
			question: "Pick one",
			header: "Choice",
			options: [{ label: "Alpha" }, { label: "Beta" }],
		},
	],
};

type SessionComponent = { render(width: number): string[]; handleInput(data: string): void };

function register() {
	const { pi, captured } = createMockPi();
	registerAskUserQuestionTool(pi);
	return captured.tools.get("ask_user_question")!;
}

function drive(script: (component: SessionComponent, options: unknown) => void) {
	const onTerminalInput = vi.fn();
	const custom = vi.fn(
		(
			factory: (
				tui: { requestRender: () => void; terminal: { columns: number; rows: number } },
				theme: typeof identityTheme,
				kb: typeof keybindings,
				done: (value: unknown) => void,
			) => unknown,
			options?: unknown,
		) =>
			new Promise((resolve) => {
				const component = factory(
					{ requestRender: vi.fn(), terminal: { columns: 120, rows: 24 } },
					identityTheme,
					keybindings,
					resolve,
				) as SessionComponent;
				script(component, options);
				resolve({ answers: [], cancelled: true });
			}),
	);
	return { ctx: { hasUI: true, ui: { custom, onTerminalInput, notify: vi.fn() } } as never, onTerminalInput };
}

const home = process.env.HOME ?? "";
const configDir = join(home, ".config", "rpiv-ask-user-question");
const configPath = join(configDir, "config.json");

function writeCollapseKeyConfig(collapseKey: string): void {
	mkdirSync(configDir, { recursive: true });
	writeFileSync(configPath, JSON.stringify({ collapseKey } satisfies AskUserQuestionConfig));
}

afterEach(() => {
	if (existsSync(configPath)) rmSync(configPath);
});

describe("ask_user_question — bottom pane", () => {
	it("opens without overlay options and collapses to a visible row", async () => {
		const tool = register();
		const { ctx, onTerminalInput } = drive((component, options) => {
			expect(options).toBeUndefined();
			expect(component.render(120).length).toBeGreaterThan(1);
			component.handleInput(CTRL_RBRACKET);
			expect(component.render(120)).toEqual([expect.stringContaining("Ctrl+] to expand")]);
			component.handleInput(CTRL_RBRACKET);
			expect(component.render(120).length).toBeGreaterThan(1);
		});

		await tool.execute?.("tc", params as never, undefined as never, undefined as never, ctx);
		expect(onTerminalInput).not.toHaveBeenCalled();
	});

	it("honours a configured collapse key through the focused pane", async () => {
		writeCollapseKeyConfig("alt+o");
		const tool = register();
		const { ctx } = drive((component) => {
			component.handleInput(CTRL_RBRACKET);
			expect(component.render(120).length).toBeGreaterThan(1);
			component.handleInput(ALT_O);
			expect(component.render(120)).toEqual([expect.stringContaining("Alt+O to expand")]);
		});

		await tool.execute?.("tc", params as never, undefined as never, undefined as never, ctx);
	});

	it("drops the collapse hint when collapseKey is off", async () => {
		writeCollapseKeyConfig("off");
		const tool = register();
		const { ctx } = drive((component) => {
			const rendered = component.render(120).join("\n");
			expect(rendered).not.toContain("to collapse");
			expect(rendered).toContain("Esc to cancel");
		});

		await tool.execute?.("tc", params as never, undefined as never, undefined as never, ctx);
	});
});
