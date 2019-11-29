const walk = require('acorn-walk');
const MagicString = require('magic-string');

module.exports = () => {
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
      if (element === null) {
        parsed.push(null);
      }
      const parsedExpression = parseExpression(element);
      if (!parsedExpression) {
        return false;
      }
      parsed.push(parsedExpression.parsed);
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
      if (kind !== 'init') {
        return false;
      }
      if (
        key.type === 'Identifier' ||
        (key.type === 'Literal' && typeof key.value === 'string')
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
    visitedObjects.set(objectExpression, complete ? { parsed } : null);
    if (!complete) {
      return null;
    }
    return { parsed };
  };

  const visitedObjects = new Map();

  return {
    name: 'rollup-plugin-json-parse',
    transform(code, id) {
      const ast = this.parse(code);

      walk.simple(ast, {
        ObjectExpression(objectExpression) {
          parseObject(objectExpression);
        }
      });

      const ms = new MagicString(code);
      [...visitedObjects.keys()].forEach(objectExpression => {
        const parsed = visitedObjects.get(objectExpression);
        if (parsed) {
          const { start, end } = objectExpression;
          ms.prependLeft(start, 'JSON.parse(');
          ms.overwrite(start, end, JSON.stringify(parsed.parsed));
          ms.appendRight(end, ')');
        }
      });

      return {
        code: ms.toString(),
        map: ms.generateMap({ hires: true })
      };
    }
  };
};
