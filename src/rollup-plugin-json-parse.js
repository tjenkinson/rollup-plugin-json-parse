const MagicString = require('magic-string');
const jsesc = require('jsesc');

const forEachObjectExpression = (node, callback) => {
  const Node = Object.getPrototypeOf(node).constructor;

  if (node.type === 'ObjectExpression') {
    callback(node);
  }

  Object.keys(node).forEach(key => {
    const maybeChildren = Array.isArray(node[key]) ? node[key] : [node[key]];
    maybeChildren.forEach(maybeChild => {
      if (maybeChild instanceof Node) {
        forEachObjectExpression(maybeChild, callback);
      }
    });
  });
};

module.exports = ({ minJSONStringSize = 1024 } = {}) => {
  return {
    name: 'rollup-plugin-json-parse',
    transform(code) {
      const parseExpression = expression => {
        switch (expression.type) {
          case 'Literal':
            if (
              expression.value === null ||
              ['string', 'boolean', 'number'].includes(typeof expression.value)
            ) {
              return { parsed: expression.value };
            }
            return null;
          case 'ArrayExpression':
            return parseArray(expression);
          case 'ObjectExpression':
            return parseObject(expression);
        }
        return null;
      };

      const parseArray = ({ elements }) => {
        const parsed = [];
        const complete = elements.every(element => {
          const parsedExpression = parseExpression(element);
          if (!parsedExpression) {
            return false;
          }
          parsed.push(parsedExpression.parsed);
          return true;
        });
        if (!complete) {
          return null;
        }
        return { parsed };
      };

      const parseObject = objectExpression => {
        if (visitedObjects.has(objectExpression)) {
          return visitedObjects.get(objectExpression);
        }
        const { properties } = objectExpression;
        const parsed = Object.create(null);
        const complete = properties.every(({ key, value, kind }) => {
          if (
            kind === 'init' &&
            (key.type === 'Identifier' ||
              (key.type === 'Literal' && typeof key.value === 'string'))
          ) {
            const parsedExpression = parseExpression(value);
            if (!parsedExpression) {
              return false;
            }
            parsed[key.type === 'Identifier' ? key.name : key.value] =
              parsedExpression.parsed;
            return true;
          }
          return false;
        });
        const result = complete ? { parsed } : null;
        visitedObjects.set(objectExpression, result);
        return result;
      };

      const visitedObjects = new Map();

      const ast = this.parse(code);
      forEachObjectExpression(ast, objectExpression =>
        parseObject(objectExpression)
      );

      const ms = new MagicString(code);
      [...visitedObjects.keys()].forEach(objectExpression => {
        const parsed = visitedObjects.get(objectExpression);
        if (parsed) {
          const stringified = JSON.stringify(parsed.parsed);
          if (stringified.length >= minJSONStringSize) {
            const { start, end } = objectExpression;
            ms.prependLeft(start, '/*@__PURE__*/JSON.parse(');
            ms.overwrite(
              start,
              end,
              jsesc(stringified, {
                json: true,
                isScriptContext: true
              })
            );
            ms.appendRight(end, ')');
          }
        }
      });

      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true })
      };
    }
  };
};
