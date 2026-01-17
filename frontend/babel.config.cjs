module.exports = {
  presets: [
    [
      '@babel/preset-env',
      { targets: { node: 'current' } }
    ],
    [
      '@babel/preset-react',
      { runtime: 'automatic' }
    ]
  ],
  plugins: [
    // Transform import.meta for Jest compatibility
    'babel-plugin-transform-import-meta'
  ]
};