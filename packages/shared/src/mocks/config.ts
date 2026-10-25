import type { AssetInfo, KeystoneConfig } from "../types.ts";
import { mockAddress } from "./helpers.ts";

export const mockAssets: AssetInfo[] = [
  {
    id: "KMMF",
    code: "KMMF",
    issuer: mockAddress("G", "ISSUER"),
    sac: mockAddress("C", "SACKMMF"),
    decimals: 7,
    label: "Keystone Money Market Fund (fictitious)",
    unitPriceEur: "1000.00",
    haircutPct: "2.00",
  },
  {
    id: "KBOND",
    code: "KBOND",
    issuer: mockAddress("G", "ISSUER"),
    sac: mockAddress("C", "SACKBOND"),
    decimals: 7,
    label: "Keystone Sovereign Bond (fictitious)",
    unitPriceEur: "1000.00",
    haircutPct: "2.00",
  },
];

export const mockConfig: KeystoneConfig = {
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  explorerTxBase: "https://stellar.expert/explorer/testnet/tx/",
  accounts: {
    fund: mockAddress("G", "FUND"),
    bank: mockAddress("G", "BANK"),
    keeper: mockAddress("G", "KEEPER"),
  },
  assets: mockAssets,
  signerMode: "freighter",
};

/** Same configuration in SIGNER=keeper mode (public demo URL). */
export const mockConfigKeeperSigner: KeystoneConfig = { ...mockConfig, signerMode: "keeper" };
