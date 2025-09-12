import { Diagnostic, Screen } from "../../types/json-processor.types";

export class Analyzer {
    generateDiagnostics(
        screens: Record<string, Screen>,
        edges: Record<string, (string | null)[]>
    ): Diagnostic[] {
        return Object.entries(screens).map(([id, scr]) => {
            const rules = edges[id] || [];
            const terminal = !!scr.isTerminal;

            return {
                screen: id,
                name: scr.name,
                terminal,
                has_rules: rules.length > 0,
                out_degree: rules.filter(Boolean).length
            };
        });
    }

    findUnreachableScreens(
        screens: Record<string, Screen>,
        edges: Record<string, (string | null)[]>,
        start: string | null
    ): Array<{ screen: string; name?: string }> {
        const reachable = new Set<string>();

        // Если есть стартовый экран — обходим граф от него
        if (start) {
            const dfs = (cur: string) => {
                if (reachable.has(cur)) return;
                reachable.add(cur);

                const nexts = edges[cur] || [];
                nexts.forEach((n) => {
                    if (n) dfs(n);
                });
            };
            dfs(start);
        } else {
            console.warn("⚠️ Стартовый экран не найден. Все экраны считаются недостижимыми.");
        }

        // Всё, что не попало в reachable → недостижимое
        return Object.keys(screens)
            .filter((id) => !reachable.has(id))
            .map((id) => ({
                screen: id,
                name: screens[id]?.name
            }));
    }
}