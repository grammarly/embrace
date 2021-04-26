import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { App } from './components/app'

ReactDOM.render(
  // TODO: wrap into React.StrictMode
  <App />,
  document.getElementById('root')
)

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://snowpack.dev/concepts/hot-module-replacement
if (import.meta.hot) {
  import.meta.hot.accept()
}
