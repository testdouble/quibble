/// <reference types="node" />

import { MessagePort } from 'node:worker_threads';
import quibble from './quibble.js';

export default quibble;

export declare const reset: any;

export declare const ignoreCallsFromThisFile: any;

export declare const config: any;

export declare const isLoaderLoaded: any;

export type ModuleLoaderMockInfo = {
  hasDefaultExportStub: boolean;
  namedExports: string[];
};

export type ResolveContext = {
  parentURL?: string;
};

export type ResolveFunction = (
  specifier: string,
  context: ResolveContext,
  nextResolve: (
    specifier: string,
    context: ResolveContext
  ) => Promise<{
    url: string;
  }>
) => Promise<{
  url: string;
}>;

export type LoadContext = {
  format: string;
};

export type LoadFunction = (
  url: string,
  context: LoadContext,
  nextLoad: (
    url: string,
    context: LoadContext
  ) => Promise<{
    source: string | SharedArrayBuffer | Uint8Array;
    format: string;
  }>
) => Promise<{
  source: string | SharedArrayBuffer | Uint8Array;
  format: string;
  shortCircuit?: boolean;
}>;

export type GlobalPreloadOptions = {
  port: MessagePort;
};

export declare const resolve: ResolveFunction;

export declare const load: LoadFunction;

export declare const globalPreload: ({ port }: GlobalPreloadOptions) => string;
