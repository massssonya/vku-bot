import { PathResult, Screen } from "../../types/json-processor.types";

export class PathFinder {
    private readonly MAX_PATHS = 10000;

    findPaths(
        start: string, 
        edges: Record<string, (string | null)[]>, 
        screens: Record<string, Screen>
    ): PathResult[] {
        const paths: PathResult[] = [];
		const dfs = (cur: string, path: string[]): void => {
			if (paths.length >= this.MAX_PATHS) return;

			if (path.includes(cur)) {
				paths.push({
					path: [...path, cur],
					status: "CYCLE"
				});
				return;
			}

			const nexts = edges[cur] || [];

			if (!nexts.length) {
				const term = screens[cur]?.isTerminal;
				paths.push({
					path: [...path, cur],
					status: term ? "TERMINAL" : "DEAD_END"
				});
				return;
			}

			for (const n of nexts) {
				if (!n) continue;
				dfs(n, [...path, cur]);
			}
		};

		dfs(start, []);
        return paths;
	}
}