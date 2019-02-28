import { NodePath } from '@babel/traverse';
import State from './state';
import evaluateJSON from './evaluate-json';
import { callExpression } from '@babel/types';

export default function macroIf(path: NodePath, state: State) {
  let parentPath = path.parentPath;
  if (!parentPath.isCallExpression()) {
    throw new Error(`You can only use macroIf as a function call`);
  }
  let args = parentPath.get('arguments');
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`macroIf takes two or three arguments, you passed ${args.length}`);
  }

  let [predicatePath, consequent, alternate] = args;
  let predicate = evaluate(predicatePath);
  if (!predicate.confident) {
    throw new Error(`the first argument to macroIf must be statically known`);
  }
  if (typeof predicate.value !== 'boolean') {
    throw new Error(`The first argument to macroIf must have a boolean value, you passed ${predicate.value}`);
  }

  if (!consequent.isArrowFunctionExpression()) {
    throw new Error(`The second argument to macroIf must be an arrow function expression.`);
  }

  if (alternate && !alternate.isArrowFunctionExpression()) {
    throw new Error(`The third argument to macroIf must be an arrow function expression.`);
  }

  let [kept, dropped] = predicate.value ? [consequent, alternate] : [ alternate, consequent];
  if (kept) {
    let body = kept.get('body');
    if (body.type === 'BlockStatement') {
      parentPath.replaceWith(callExpression(kept.node, []));
    } else {
      parentPath.replaceWith(body);
    }
  } else {
    parentPath.remove();
  }
  state.removed.push(path);
  if (dropped) {
    state.removed.push(dropped);
  }
}

function evaluate(path: NodePath): { confident: boolean, value: any } {
  let builtIn = path.evaluate();
  if (builtIn.confident) {
    return builtIn;
  }

  // we can go further than babel's evaluate() because we know that we're
  // typically used on JSON, not full Javascript.
  return evaluateJSON(path);
}
