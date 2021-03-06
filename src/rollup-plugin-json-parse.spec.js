const rollup = require('rollup');
const RollupPluginJsonParse = require('./rollup-plugin-json-parse');

const entryFile = 'entry.js';

function buildJsonString(length) {
  const prefix = `{"a":"`;
  const suffix = `"}`;
  let remaining = length - prefix.length - suffix.length;
  let middle = '';
  for (let i = 0; i < remaining; i++) {
    middle += 'a';
  }
  return prefix + middle + suffix;
}

function buildFakeFile(id, contents) {
  return {
    resolveId(_id) {
      if (_id === id) {
        return { id };
      }
      return null;
    },
    load(_id) {
      if (_id === id) {
        return contents;
      }
      return null;
    },
  };
}

async function doBuild({ code, config = { minJSONStringSize: 0 } }) {
  const bundle = await rollup.rollup({
    input: entryFile,
    onwarn: (e) => {
      throw new Error(e);
    },
    plugins: [
      RollupPluginJsonParse(config || undefined),
      buildFakeFile(entryFile, code),
    ],
  });
  const { output } = await bundle.generate({ format: 'cjs' });
  if (output.length !== 1) {
    throw new Error('Unexpected output.');
  }
  return output[0].code;
}

describe('RollupPluginJsonParse', () => {
  it('case 1', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: 1,
            prop2: 1.1,
            prop3: "something",
            prop4: null,
            prop5: false,
            prop6: {
              nested1: 123
            }
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: 1,
            prop2: 1.1,
            prop3: 'something',
            prop4: null,
            prop5: false,
            prop6: {
              nested1: 123,
            },
          })
        )});`
      )
    );
  });

  it('case 2', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: undefined
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 3', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: () => {}
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 4', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: /a/
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 5', async () => {
    await expect(
      await doBuild({
        code: `
          const b = 1;
          export const a = {
            prop1: b
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 6', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: "a" + "b"
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 7', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: {}
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: {},
          })
        )});`
      )
    );
  });

  it('case 8', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: {}
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: {},
          })
        )});`
      )
    );
  });

  it('case 9', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: false,
            prop2: {
              nested: () => {}
            }
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 10', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: () => {},
            prop2: {
              nested1: true,
              nested2: { a: 1 }
            }
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(`const a = {
            prop1: () => {},
            prop2: /*@__PURE__*/JSON.parse("{\\"nested1\\":true,\\"nested2\\":{\\"a\\":1}}")
          };`)
    );
  });

  it('case 11', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            ['prop 1']: true
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            ['prop 1']: true,
          })
        )});`
      )
    );
  });

  it('case 12', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: () => {}, // can't be optimized
            prop2: {
              prop3: 2,
              prop4: 'something',
              ['prop 5']: null
            }
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(`const a = {
            prop1: () => {}, // can't be optimized
            prop2: /*@__PURE__*/JSON.parse("{\\"prop3\\":2,\\"prop4\\":\\"something\\",\\"prop 5\\":null}")
          };`)
    );
  });

  it('case 13', async () => {
    const res = await doBuild({
      code: `
          export const a = {
            a: true
          };
          export const b = {
            b: false
          };
        `,
    });
    expect(res).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            a: true,
          })
        )});`
      )
    );
    expect(res).toEqual(
      expect.stringContaining(
        `const b = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            b: false,
          })
        )});`
      )
    );
  });

  it('case 14', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: '<script></script>'
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse("{\\"prop1\\":\\"<script><\\/script>\\"}");`
      )
    );
  });

  it('case 15', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: \`\`
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 16', async () => {
    await expect(
      await doBuild({
        config: undefined,
        code: `
          export const a = ${buildJsonString(1024)};
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          buildJsonString(1024)
        )});`
      )
    );
  });

  it('case 17', async () => {
    await expect(
      await doBuild({
        config: null,
        code: `
          export const a = ${buildJsonString(1023)};
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 18', async () => {
    await expect(
      await doBuild({
        config: { minJSONStringSize: 20 },
        code: `
          export const a = ${buildJsonString(20)};
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          buildJsonString(20)
        )});`
      )
    );
  });

  it('case 19', async () => {
    await expect(
      await doBuild({
        code: `
          export const a = {
            prop1: "\\u2028\\u2029"
          };
        `,
      })
    ).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse("{\\"prop1\\":\\"\\u2028\\u2029\\"}");`
      )
    );
  });

  it('case 20', async () => {
    const res = await doBuild({
      code: `
          export const a = {
            a: [1, '2', false, null, {}]
          };
        `,
    });
    expect(res).toEqual(
      expect.stringContaining(
        `const a = /*@__PURE__*/JSON.parse(${JSON.stringify(
          JSON.stringify({
            a: [1, '2', false, null, {}],
          })
        )});`
      )
    );
  });

  it('case 21', async () => {
    await expect(
      await doBuild({
        config: null,
        code: `
          export const a = {
            a: [() => {}]
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });

  it('case 22', async () => {
    await expect(
      await doBuild({
        config: null,
        code: `
          export const a = {
            a: ['a',,'b',]
          };
        `,
      })
    ).toEqual(expect.not.stringContaining(`JSON.parse(`));
  });
});
