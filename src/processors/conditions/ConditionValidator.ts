import { JSONStructure } from "../../types/json-processor.types";

export class ConditionValidator {
    checkDuplicateConditions(json: JSONStructure) {
        const problems: Array<{
            screenId: string;
            condition: string;
            nextDisplays: string[];
        }> = [];

        const checkRulesBlock = (rulesBlock: Record<string, any> | undefined) => {
            if (!rulesBlock) return;

            for (const [screenId, rules] of Object.entries(rulesBlock)) {
                if (!Array.isArray(rules)) continue;

                const conditionMap: Record<string, Set<string>> = {};

                for (const rule of rules) {
                    const conds = JSON.stringify(rule.conditions ?? []);
                    const nexts = Array.isArray(rule.nextDisplay)
                        ? rule.nextDisplay
                        : rule.nextDisplay
                            ? [rule.nextDisplay]
                            : [];

                    if (!conditionMap[conds]) {
                        conditionMap[conds] = new Set();
                    }

                    nexts.forEach((n: string) => conditionMap[conds].add(n || "null"));
                }

                for (const [conds, nextSet] of Object.entries(conditionMap)) {
                    if (nextSet.size > 1) {
                        problems.push({
                            screenId,
                            condition: conds,
                            nextDisplays: Array.from(nextSet)
                        });
                    }
                }
            }
        };

        checkRulesBlock(json.screenRules);
        checkRulesBlock(json.cycledScreenRules);

        return problems;
    }

    checkContradictoryConditions(json: JSONStructure) {
        const problems: Array<{
            screenId: string;
            condsA: any[];
            nextA: any;
            condsB: any[];
            nextB: any;
            reason: string;
        }> = [];

        const checkRulesBlock = (rulesBlock: Record<string, any> | undefined) => {
            if (!rulesBlock) return;

            for (const [screenId, rules] of Object.entries(rulesBlock)) {
                if (!Array.isArray(rules)) continue;

                for (let i = 0; i < rules.length; i++) {
                    for (let j = i + 1; j < rules.length; j++) {
                        const r1 = rules[i];
                        const r2 = rules[j];

                        const conds1 = r1.conditions ?? [];
                        const conds2 = r2.conditions ?? [];

                        // Проверяем, могут ли условия выполняться одновременно
                        if (this.conditionsCanOverlap(conds1, conds2)) {
                            if (JSON.stringify(r1.nextDisplay) !== JSON.stringify(r2.nextDisplay)) {
                                problems.push({
                                    screenId,
                                    condsA: conds1,
                                    nextA: r1.nextDisplay,
                                    condsB: conds2,
                                    nextB: r2.nextDisplay,
                                    reason: "Разные переходы при одновременном выполнении условий"
                                });
                            }
                        }
                    }
                }
            }
        };

        checkRulesBlock(json.screenRules);
        checkRulesBlock(json.cycledScreenRules);

        return problems;
    }

    private conditionsCanOverlap(condsA: any[], condsB: any[]): boolean {
        // Пустые условия игнорируем
        if (!condsA.length || !condsB.length) return false;

        for (const a of condsA) {
            for (const b of condsB) {
                // Если оба условия касаются одного и того же поля
                const fieldA = a.field || a.protectedField;
                const fieldB = b.field || b.protectedField;

                if (fieldA && fieldB && fieldA === fieldB) {
                    // Простое сравнение значений
                    if (a.predicate === null && b.predicate === null) {
                        if (a.value !== b.value) {
                            // значения разные → условия взаимоисключающие
                            return false;
                        }
                    }
                    // Для предикатов типа notEquals / greaterThan и т.д.
                    // считаем, что потенциально могут пересекаться
                }
            }
        }

        // Если разные поля → могут выполняться одновременно
        return true;
    }
}