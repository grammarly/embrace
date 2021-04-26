import * as React from 'react'
import { UI } from '@grammarly/embrace'
import { Body } from '../body'
import { Footer } from '../footer'
import { Header } from '../header'

import './main.css'

const mainGrid = UI.Grid.make<'header' | 'body' | 'footer', never, never>(({ slots }) => (
  <div className="main">
    {slots.header}
    {slots.body}
    {slots.footer}
  </div>
))

export const Main = UI.Knot.make(mainGrid, { header: Header, body: Body, footer: Footer })
