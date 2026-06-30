// Jest transpiles to CommonJS, où `import.meta` (utilisé par Vite pour
// `import.meta.env`) n'est pas valide. On le remplace par `process` en
// environnement de test uniquement, pour que `import.meta.env.X` devienne
// `process.env.X` (undefined en l'absence de variable, comme en prod sans build Vite).
function stripImportMetaForJest() {
  return {
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          path.replaceWithSourceString('process');
        }
      },
    },
  };
}

export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  env: {
    test: {
      plugins: [stripImportMetaForJest],
    },
  },
};
