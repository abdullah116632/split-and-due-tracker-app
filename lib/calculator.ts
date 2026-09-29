// A small, safe calculator (no eval). Expressions use the characters
// 0-9 . + - * / %  where '-' is also unary minus (e.g. "12*-3").

import { groupDigits } from './money';

export const OPERATORS = ['+', '-', '*', '/'] as const;
export type Operator = (typeof OPERATORS)[number];

const isOperator = (c: string | undefined): c is Operator =>
  c != null && (OPERATORS as readonly string[]).includes(c);

export class CalcError extends Error {}

/**
 * Evaluates an expression.
 *   expr   = term (('+' | '-') term)*
 *   term   = factor (('*' | '/') factor)*
 *   factor = '-'? number '%'?
 * "a + b%" and "a - b%" mean b percent of a (like a pocket calculator); elsewhere b% = b/100.
 */
export function evaluate(input: string): number {
  let pos = 0;
  const peek = () => input[pos];

  const number = (): number => {
    const start = pos;
    while (pos < input.length && /[\d.]/.test(input[pos])) pos++;
    const text = input.slice(start, pos);
    if (!text || text === '.' || text.split('.').length > 2) throw new CalcError('Invalid number');
    return Number(text);
  };

  const factor = (): { value: number; percent: boolean } => {
    let sign = 1;
    while (peek() === '-') {
      sign = -sign;
      pos++;
    }
    const value = sign * number();
    if (peek() === '%') {
      pos++;
      return { value, percent: true };
    }
    return { value, percent: false };
  };

  const term = (): { value: number; percent: boolean } => {
    let first = factor();
    let value = first.percent ? first.value / 100 : first.value;
    let onlyPercent = first.percent;
    while (peek() === '*' || peek() === '/') {
      const op = input[pos++];
      const next = factor();
      const right = next.percent ? next.value / 100 : next.value;
      if (op === '/') {
        if (right === 0) throw new CalcError('Can’t divide by 0');
        value /= right;
      } else {
        value *= right;
      }
      onlyPercent = false;
      first = next;
    }
    // Keep the raw percent so "+ b%" can use it relative to the left side.
    return onlyPercent ? { value: first.value, percent: true } : { value, percent: false };
  };

  const expr = (): number => {
    const firstTerm = term();
    let value = firstTerm.percent ? firstTerm.value / 100 : firstTerm.value;
    while (peek() === '+' || peek() === '-') {
      const op = input[pos++];
      const next = term();
      const right = next.percent ? (value * next.value) / 100 : next.value;
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  if (!input) throw new CalcError('Empty');
  const result = expr();
  if (pos !== input.length) throw new CalcError('Invalid expression');
  if (!Number.isFinite(result)) throw new CalcError('Number too large');
  // Hide floating point noise like 0.1 + 0.2 = 0.30000000000000004
  return Number(result.toPrecision(12));
}

/** Result for a live preview, or null if the expression isn't complete/valid yet. */
export function tryEvaluate(input: string): number | null {
  try {
    return evaluate(input);
  } catch {
    return null;
  }
}

/** The number currently being typed at the end of the expression (with any unary minus). */
function lastNumberStart(expr: string): number {
  let i = expr.length;
  while (i > 0 && /[\d.]/.test(expr[i - 1])) i--;
  return i;
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-9)) {
    return value.toExponential(6);
  }
  const [whole, frac] = String(Math.abs(value)).split('.');
  return `${value < 0 ? '−' : ''}${groupDigits(Number(whole))}${frac ? '.' + frac : ''}`;
}

/** Pretty-prints an expression: grouped digits and real math symbols. */
export function formatExpression(expr: string): string {
  return expr
    .replace(/\d+/g, (d, offset: number) =>
      // Don't group digits after a decimal point.
      expr[offset - 1] === '.' ? d : groupDigits(Number(d))
    )
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/(\d|%)-/g, '$1 − ') // binary minus follows a number
    .replace(/-/g, '−'); // anything left is a unary minus, kept attached
}

export type Key =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '%' | Operator | 'negate' | 'back' | 'clear';

/** Applies a key press to the expression and returns the new expression. */
export function pressKey(expr: string, key: Key): string {
  const last = expr[expr.length - 1];
  switch (key) {
    case 'clear':
      return '';
    case 'back':
      return expr.slice(0, -1);
    case '.': {
      const current = expr.slice(lastNumberStart(expr));
      if (current.includes('.') || last === '%') return expr;
      return current === '' ? `${expr}0.` : `${expr}.`;
    }
    case '%':
      return last != null && /\d/.test(last) ? `${expr}%` : expr;
    case 'negate': {
      const start = lastNumberStart(expr);
      if (start === expr.length) return expr;
      const before = expr.slice(0, start);
      const num = expr.slice(start);
      // A '-' directly before the number is unary if it's at the start or follows an operator.
      const hasUnary =
        before.endsWith('-') && (before.length === 1 || isOperator(before[before.length - 2]));
      return hasUnary ? before.slice(0, -1) + num : `${before}-${num}`;
    }
    default:
      if (isOperator(key)) {
        if (expr === '') return key === '-' ? '-' : expr;
        if (last === '-' && (expr.length === 1 || isOperator(expr[expr.length - 2]))) {
          // Replace "a*-" style dangling unary minus together with the operator before it.
          return expr.length === 1 ? expr : `${expr.slice(0, -2)}${key}`;
        }
        if (isOperator(last)) {
          // "5*" then "-" starts a negative number; other operators replace the last one.
          if (key === '-' && (last === '*' || last === '/')) return `${expr}-`;
          return `${expr.slice(0, -1)}${key}`;
        }
        if (last === '.') return `${expr}0${key}`;
        return `${expr}${key}`;
      }
      // digit
      if (last === '%') return `${expr}*${key}`;
      // Avoid leading zeros like "007".
      if (expr.slice(lastNumberStart(expr)) === '0') return `${expr.slice(0, -1)}${key}`;
      return `${expr}${key}`;
  }
}
