import { JSONStructure, Screen } from "../../types/json-processor.types.js";

export class ScreenGraphBuilder {
  build(json: JSONStructure) {
    const screens: Record<string, Screen> = {};
    (json.screens || []).forEach((s: Screen) => {
      screens[s.id] = s;
    });

    const edges: Record<string, (string | null)[]> = {};

    const collectEdges = (rulesBlock: Record<string, any> | undefined) => {
      if (!rulesBlock) return;
      for (const [screenId, rules] of Object.entries(rulesBlock)) {
        edges[screenId] = edges[screenId] || [];
        if (!Array.isArray(rules)) continue;
        for (const rule of rules) {
          let nexts: string[] = [];
          if (Array.isArray(rule.nextDisplay)) {
            nexts = rule.nextDisplay;
          } else if (typeof rule.nextDisplay === "string") {
            nexts = [rule.nextDisplay];
          }
          if (nexts.length === 0) {
            edges[screenId].push(null);
          } else {
            edges[screenId].push(...nexts);
          }
        }
      }
    };

    collectEdges(json.screenRules);
    collectEdges(json.cycledScreenRules);

    return { screens, edges };
  }

  findStart(json: JSONStructure, screens: Record<string, Screen>, edges: Record<string, (string | null)[]>) {
    if (json.init && screens[json.init]) return json.init;

    const explicit = Object.entries(screens).find(([_, scr]) => scr.isFirstScreen);
    if (explicit) return explicit[0];

    const jsonExplicit = (json.screens || []).find((s) => s.isFirstScreen);
    if (jsonExplicit) return jsonExplicit.id;

    const allScreens = new Set(Object.keys(screens));
    const hasIncoming = new Set<string>();
    Object.values(edges).forEach((targets) =>
      targets.forEach((t) => t && hasIncoming.add(t))
    );
    const potentialStarts = [...allScreens].filter((s) => !hasIncoming.has(s));
    return potentialStarts[0] || null;
  }
}
