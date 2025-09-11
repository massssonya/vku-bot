export type Operator = "==" | ">" | "<" | "!=" | ">=" | "<=" | null;
export type LogicOperator = "and" | "or" | null;

export interface ConditionExpression {
  operator: Operator;
  attribute: string;
  value: string;
}

export interface ConditionGroup {
  operator: LogicOperator;
  conditions: ConditionExpression[];
}

export interface ConditionResult {
  condition: ConditionGroup;
  result: string;
}