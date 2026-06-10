// `@/` alias resolve 훅을 등록한다. (node --import ./scripts/_sample-register.mjs ...) — OMO-2841
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./scripts/_sample-loader.mjs', pathToFileURL('./'))
