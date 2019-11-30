const rollup = require('rollup');
const RollupPluginJsonParse = require('./rollup-plugin-json-parse');

const entryFile = 'entry.js';

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
    }
  };
}

async function doBuild({ code }) {
  const bundle = await rollup.rollup({
    input: entryFile,
    onwarn: e => {
      throw new Error(e);
    },
    plugins: [RollupPluginJsonParse(), buildFakeFile(entryFile, code)]
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
        `
      })
    ).toEqual(
      expect.stringContaining(
        `const a = JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: 1,
            prop2: 1.1,
            prop3: 'something',
            prop4: null,
            prop5: false,
            prop6: {
              nested1: 123
            }
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
        `
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
        `
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
        `
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
        `
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
        `
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
        `
      })
    ).toEqual(
      expect.stringContaining(
        `const a = JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: {}
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
        `
      })
    ).toEqual(
      expect.stringContaining(
        `const a = JSON.parse(${JSON.stringify(
          JSON.stringify({
            prop1: {}
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
        `
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
        `
      })
    ).toEqual(
      expect.stringContaining(`const a = {
            prop1: () => {},
            prop2: JSON.parse(\"{\\\"nested1\\\":true,\\\"nested2\\\":{\\\"a\\\":1}}\")
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
        `
      })
    ).toEqual(
      expect.stringContaining(
        `const a = JSON.parse(${JSON.stringify(
          JSON.stringify({
            ['prop 1']: true
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
        `
      })
    ).toEqual(
      expect.stringContaining(`const a = {
            prop1: () => {}, // can't be optimized
            prop2: JSON.parse(\"{\\\"prop3\\\":2,\\\"prop4\\\":\\\"something\\\",\\\"prop 5\\\":null}\")
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
        `
    });
    expect(res).toEqual(
      expect.stringContaining(
        `const a = JSON.parse(${JSON.stringify(
          JSON.stringify({
            a: true
          })
        )});`
      )
    );
    expect(res).toEqual(
      expect.stringContaining(
        `const b = JSON.parse(${JSON.stringify(
          JSON.stringify({
            b: false
          })
        )});`
      )
    );
  });
});
