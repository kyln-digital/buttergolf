// Compatibility shim for @tamagui/react-native-web-lite + React 19
//
// React 19 removed several APIs that react-native-web-lite still uses:
//   - unmountComponentAtNode (used in AppRegistry/index.mjs)
//
// This shim is injected ONLY for imports of 'react-dom' from within
// @tamagui/react-native-web-lite via webpack NormalModuleReplacementPlugin.
// Imports of 'react-dom' elsewhere in the codebase resolve to the real module.

// Re-export all named exports from the real react-dom
export * from "react-dom";

// Re-export default (needed by Modal/ModalPortal.mjs: import ReactDOM from 'react-dom')
export { default } from "react-dom";

// Polyfill: unmountComponentAtNode was removed in React 19.
// react-native-web-lite's AppRegistry uses this to tear down app instances.
// In a Next.js context AppRegistry is never actually invoked, so a no-op is safe.
export function unmountComponentAtNode(container) {
  if (container && container._reactRoot) {
    container._reactRoot.unmount();
    return true;
  }
  return false;
}
