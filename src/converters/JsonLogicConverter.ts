import { ConditionExpression, ConditionGroup, ConditionResult, Operator } from "../types/json-logic.types";


class JsonLogicConverter {
  private readonly OPERATORS: Operator[] = ["==", ">", "<", "!=", ">=", "<="];

  public toJsonLogic(text: string): string {
    if (!text || typeof text !== "string") {
      throw new Error("Некорректный входной текст для парсинга");
    }

    const textUnspace = text.replace(/\s+/g, "");
    if (!textUnspace) {
      throw new Error("Текст пуст после удаления пробелов");
    }

    const conditionResultArr = textUnspace.split(";").filter((r) => r !== "");
    if (conditionResultArr.length === 0) {
      throw new Error("Нет ни одного условия для обработки");
    }

    const resObj: ConditionResult[] = conditionResultArr.map((r) => {
      const arr = r.split("=>");
      return this.toConditionResultObj(arr);
    });

    return this.toJsonLogicText(resObj);
  }

  private toConditionResultObj(arr: string[]): ConditionResult {
    if (arr.length < 2) {
      throw new Error(`Неверный формат строки: ${arr.join("=>")}`);
    }

    const condition = this.toOperatorAndConditionsObj(arr[0]);
    const result = arr[1];

    if (!condition || !condition.conditions.length) {
      throw new Error(`Нет корректного условия в строке: ${arr[0]}`);
    }

    if (!result) {
      throw new Error(`Нет результата для условия: ${JSON.stringify(condition)}`);
    }

    return { condition, result };
  }

  private toOperatorAndConditionsObj(str: string): ConditionGroup {
    if (!str) {
      throw new Error("Пустое условие");
    }

    const res = str.split("and");
    const obj: ConditionGroup = {
      operator: res.length > 1 ? "and" : null,
      conditions: res.map((r) => this.toOperatorAttributeValueObj(r)),
    };

    if (obj.conditions.length === 0) {
      throw new Error(`Не удалось распарсить условия из строки: ${str}`);
    }

    return obj;
  }

  private toOperatorAttributeValueObj(str: string): ConditionExpression {
    if (!str) {
      throw new Error("Пустое выражение условия");
    }
  
    let res = str.replace(/[()]/g, "");
  
    const operatorRegex = /(>=|<=|==|!=|>|<)/;
    const match = res.match(operatorRegex);
    if (!match) {
      throw new Error(`Не найден оператор в выражении: ${str}`);
    }
  
    const curOperator = (match[0] ?? null) as Operator;
    const parts = res.split(curOperator as string);
  
    if (parts.length < 2) {
      throw new Error(`Неверный формат выражения: ${str}`);
    }
  
    const attribute = parts[0]?.trim();
    const value = parts[1]?.trim();
  
    if (!attribute || !value) {
      throw new Error(`Атрибут или значение пусты: ${str}`);
    }
  
    return {
      operator: curOperator,
      attribute,
      value,
    };
  }

  private toJsonLogicText(arr: ConditionResult[]): string {
    const resultArr: any[] = [];

    for (const { condition, result } of arr) {
      const condJson = this.conditionToJson(condition);
      resultArr.push(condJson, result);
    }

    return JSON.stringify({ if: resultArr }, null, 2);
  }

  private conditionToJson(condition: ConditionGroup): any {
    if (!condition.operator) {
      return this.conditionToExpression(condition.conditions[0]);
    }

    return {
      [condition.operator]: condition.conditions.map((c) =>
        this.conditionToExpression(c)
      ),
    };
  }

  private conditionToExpression(cond: ConditionExpression): any {
    if (!cond.operator) {
      throw new Error(`Условие без оператора: ${JSON.stringify(cond)}`);
    }

    return {
      [cond.operator]: [cond.attribute, cond.value],
    };
  }
}

export const JsonLogicConverterObj = new JsonLogicConverter();