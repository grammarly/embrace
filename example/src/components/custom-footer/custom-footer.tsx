import * as React from 'react'
import { UI } from '@grammarly/embrace'

export const CustomFooter = UI.Node.make<never, never>(() => (
  <footer className="footer">Grammarly © 2021</footer>
))
