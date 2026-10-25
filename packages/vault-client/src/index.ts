import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidAmount"},
  2: {message:"InsufficientAvailable"},
  3: {message:"StaleEpoch"},
  4: {message:"AboveCap"},
  5: {message:"NotInMarginCall"},
  6: {message:"GracePeriodRunning"},
  7: {message:"NoShortfall"},
  8: {message:"Defaulted"}
}


export type Status = {tag: "Active", values: void} | {tag: "MarginCall", values: void} | {tag: "Defaulted", values: void};





export interface VaultState {
  asset: string;
  available: i128;
  bank: string;
  call_deadline: u64;
  epoch: u64;
  fund: string;
  grace_period_secs: u64;
  keeper: string;
  locked: i128;
  max_required: i128;
  required: i128;
  shortfall: i128;
  status: Status;
}


export interface Client {
  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<VaultState>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<VaultState>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: (options?: MethodOptions) => Promise<AssembledTransaction<VaultState>>

  /**
   * Construct and simulate a post_margin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  post_margin: ({epoch, required}: {epoch: u64, required: i128}, options?: MethodOptions) => Promise<AssembledTransaction<VaultState>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {fund, bank, keeper, asset, max_required, grace_period_secs}: {fund: string, bank: string, keeper: string, asset: string, max_required: i128, grace_period_secs: u64},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({fund, bank, keeper, asset, max_required, grace_period_secs}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAAFUluc3VmZmljaWVudEF2YWlsYWJsZQAAAAAAAAIAAAAAAAAAClN0YWxlRXBvY2gAAAAAAAMAAAAAAAAACEFib3ZlQ2FwAAAABAAAAAAAAAAPTm90SW5NYXJnaW5DYWxsAAAAAAUAAAAAAAAAEkdyYWNlUGVyaW9kUnVubmluZwAAAAAABgAAAAAAAAALTm9TaG9ydGZhbGwAAAAABwAAAAAAAAAJRGVmYXVsdGVkAAAAAAAACA==",
        "AAAABQAAAAAAAAAAAAAABUN1cmVkAAAAAAAAAQAAAAVjdXJlZAAAAAAAAAAAAAAC",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABkFjdGl2ZQAAAAAAAAAAAAAAAAAKTWFyZ2luQ2FsbAAAAAAAAAAAAAAAAAAJRGVmYXVsdGVkAAAA",
        "AAAABQAAAAAAAAAAAAAACURlcG9zaXRlZAAAAAAAAAEAAAAJZGVwb3NpdGVkAAAAAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAACU1hcmdpblNldAAAAAAAAAEAAAAKbWFyZ2luX3NldAAAAAAABAAAAAAAAAAFZXBvY2gAAAAAAAAGAAAAAAAAAAAAAAAIcmVxdWlyZWQAAAALAAAAAAAAAAAAAAAGbG9ja2VkAAAAAAALAAAAAAAAAAAAAAAJc2hvcnRmYWxsAAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAACVdpdGhkcmF3bgAAAAAAAAEAAAAJd2l0aGRyYXduAAAAAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAAAQAAAAAAAAAAAAAAClZhdWx0U3RhdGUAAAAAAA0AAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAJYXZhaWxhYmxlAAAAAAAACwAAAAAAAAAEYmFuawAAABMAAAAAAAAADWNhbGxfZGVhZGxpbmUAAAAAAAAGAAAAAAAAAAVlcG9jaAAAAAAAAAYAAAAAAAAABGZ1bmQAAAATAAAAAAAAABFncmFjZV9wZXJpb2Rfc2VjcwAAAAAAAAYAAAAAAAAABmtlZXBlcgAAAAAAEwAAAAAAAAAGbG9ja2VkAAAAAAALAAAAAAAAAAxtYXhfcmVxdWlyZWQAAAALAAAAAAAAAAhyZXF1aXJlZAAAAAsAAAAAAAAACXNob3J0ZmFsbAAAAAAAAAsAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAA==",
        "AAAABQAAAAAAAAAAAAAACk1hcmdpbkNhbGwAAAAAAAEAAAALbWFyZ2luX2NhbGwAAAAAAQAAAAAAAAANY2FsbF9kZWFkbGluZQAAAAAAAAYAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAH0AAAAApWYXVsdFN0YXRlAAA=",
        "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAH0AAAAApWYXVsdFN0YXRlAAA=",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAfQAAAAClZhdWx0U3RhdGUAAA==",
        "AAAAAAAAAAAAAAALcG9zdF9tYXJnaW4AAAAAAgAAAAAAAAAFZXBvY2gAAAAAAAAGAAAAAAAAAAhyZXF1aXJlZAAAAAsAAAABAAAH0AAAAApWYXVsdFN0YXRlAAA=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAABGZ1bmQAAAATAAAAAAAAAARiYW5rAAAAEwAAAAAAAAAGa2VlcGVyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAADG1heF9yZXF1aXJlZAAAAAsAAAAAAAAAEWdyYWNlX3BlcmlvZF9zZWNzAAAAAAAABgAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    deposit: this.txFromJSON<VaultState>,
        withdraw: this.txFromJSON<VaultState>,
        get_state: this.txFromJSON<VaultState>,
        post_margin: this.txFromJSON<VaultState>
  }
}