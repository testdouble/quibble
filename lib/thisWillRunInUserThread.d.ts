/// <reference types="node" />

import { MessagePort } from 'node:worker_threads';

export type ResetFunction = () => void;

export type AddMockedModuleFunction = (
  moduleUrl: string,
  options: {
    namedExportStubs: Record<string, any>;
    defaultExportStub: any;
  }
) => void;

export type ListMockedModulesFunction = () => string[];

export type UserToLoaderCommunication = {
  reset: ResetFunction;
  addMockedModule: AddMockedModuleFunction;
  listMockedModules: ListMockedModulesFunction;
};

export type QuibbleUserState = {
  quibbledModules: Map<any, any>;
};

export type QuibbleLoaderState = {
  quibbledModules: Map<any, any>;
  stubModuleGeneration: number;
};

export type GlobalThis = typeof globalThis & {
  [key: symbol]:
    | QuibbleUserState
    | UserToLoaderCommunication
    | QuibbleLoaderState;
};

export declare const thisWillRunInUserThread: (
  globalThis: GlobalThis,
  port: MessagePort
) => void;
