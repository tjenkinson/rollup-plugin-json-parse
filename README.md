[![npm version](https://badge.fury.io/js/rollup-plugin-json-parse.svg)](https://badge.fury.io/js/rollup-plugin-json-parse) [![Greenkeeper badge](https://badges.greenkeeper.io/tjenkinson/rollup-plugin-json-parse.svg)](https://greenkeeper.io/)

# rollup-plugin-json-parse

A rollup plugin that wraps compatible objects with `JSON.parse()`.

Anything that is not compatible or would be less than 1024 characters, is left unchanged.

## Why?

It improves performance!

> Because the JSON grammar is much simpler than JavaScript’s grammar, JSON can be parsed more efficiently than JavaScript. This knowledge can be applied to improve start-up performance for web apps that ship large JSON-like configuration object literals (such as inline Redux stores).

See [this video on the chrome dev channel](https://youtu.be/ff4fgQxPaO0) for more info.

[![Chrome dev YouTube video](https://img.youtube.com/vi/ff4fgQxPaO0/0.jpg)](https://youtu.be/ff4fgQxPaO0)

## Installation

```
npm install --save-dev rollup-plugin-json-parse
```

## Usage

```js
import { rollup } from 'rollup';
import rollupPluginJsonParse from 'rollup-plugin-json-parse';

export default {
  input: 'main.js',
  plugins: [
    rollupPluginJsonParse({
      minJSONStringSize: 1024 // default
    })
  ]
});
```

## Example

The following assumes `minJSONStringSize` of `0` for demonstration purposes.

Input

```js
const a = {
  prop1: () => {}, // can't be optimized
  prop2: {
    prop3: 2,
    prop4: 'something',
    ['prop 5']: null
  }
};
```

Output

```js
const a = {
  prop1: () => {}, // can't be optimized
  prop2: /*@__PURE__*/JSON.parse({\"prop3\":2,\"prop4\":\"something\",\"prop 5\":null})
};
```
