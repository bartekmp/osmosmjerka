import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        // Browser APIs
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        HTMLAnchorElement: 'readonly',
        File: 'readonly',
        URLSearchParams: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        __VITE_BASE_PATH__: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off', // Disable prop-types warnings for now
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off', // Disable for now
      
      // General JavaScript rules
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': 'off', // Allow console logs in this project
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // MUI v9 silently drops system/style props passed directly to layout
      // components (e.g. <Box display="flex" mb={2}>); they must live in `sx`.
      // This guards against that class of regression at author time.
      // Container is handled separately because `maxWidth` is one of its real props.
      'no-restricted-syntax': ['error',
        {
          selector: "JSXOpeningElement[name.name=/^(Box|Grid|Stack|Typography|Paper|Card)$/] > JSXAttribute[name.name=/^(display|flexDirection|flexWrap|alignItems|alignContent|justifyContent|justifyItems|gap|rowGap|columnGap|flex|flexGrow|flexShrink|flexBasis|order|p|px|py|pt|pb|pl|pr|padding|m|mx|my|mt|mb|ml|mr|margin|width|height|minWidth|maxWidth|minHeight|maxHeight|boxShadow|bgcolor|borderRadius|borderColor|position|top|right|bottom|left|zIndex|overflow|fontWeight|fontSize|textAlign|lineHeight|letterSpacing|paragraph)$/]",
          message: 'MUI v9 ignores system props passed directly to layout components — move this into the `sx` prop (e.g. sx={{ display: "flex" }}).',
        },
        {
          selector: "JSXOpeningElement[name.name='Container'] > JSXAttribute[name.name=/^(display|flexDirection|flexWrap|alignItems|alignContent|justifyContent|justifyItems|gap|rowGap|columnGap|flex|flexGrow|flexShrink|flexBasis|order|p|px|py|pt|pb|pl|pr|padding|m|mx|my|mt|mb|ml|mr|margin|width|height|minWidth|minHeight|maxHeight|boxShadow|bgcolor|borderRadius|borderColor|position|top|right|bottom|left|zIndex|overflow|fontWeight|fontSize|textAlign|lineHeight|letterSpacing|paragraph)$/]",
          message: 'MUI v9 ignores system props passed directly to Container — move this into the `sx` prop (e.g. sx={{ display: "flex" }}).',
        },
      ],
      
      // Accessibility rules
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        // Browser APIs for tests
        fetch: 'readonly',
        localStorage: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];