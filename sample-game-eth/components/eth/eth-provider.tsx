"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  formatEther,
  getAddress,
  http,
  isAddress,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { foundry, sepolia } from "viem/chains";
import { getClientEnv } from "@/config/env";
import { GAME_FACTORY_ABI } from "@/lib/eth-factory";

type EthProviderValue = {
  address: Address | null;
  chainId: number;
  targetChainId: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (nextChainId: number) => Promise<void>;
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  gameItemsAddress: Address | null;
};

type BrowserProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

const EthContext = createContext<EthProviderValue | undefined>(undefined);

const CHAIN_OPTIONS = [
  { id: sepolia.id, label: "Sepolia" },
  { id: foundry.id, label: "Localhost" },
];

function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

function getInjectedProvider(): BrowserProvider | null {
  if (typeof window === "undefined") return null;
  const maybeProvider = (window as Window & { ethereum?: BrowserProvider }).ethereum;
  return maybeProvider ?? null;
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toAddressOrNull(value: string | Address | null | undefined): Address | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  try {
    return getAddress(raw.toLowerCase() as Address);
  } catch {
    return null;
  }
}

export const WalletButton: FC = () => {
  const { address, connect, disconnect } = useEthWallet();
  return address ? (
    <button
      onClick={disconnect}
      className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer"
      title="Disconnect wallet"
    >
      {shortAddress(address)}
    </button>
  ) : (
    <button
      onClick={connect}
      className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer"
    >
      Connect Wallet
    </button>
  );
};

export const ChainButton: FC = () => {
  const { chainId, switchChain } = useEthWallet();
  return (
    <select
      value={chainId}
      onChange={(e) => switchChain(Number(e.target.value))}
      className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer"
    >
      {CHAIN_OPTIONS.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.label}
        </option>
      ))}
    </select>
  );
};

export const BalanceHint: FC = () => {
  const { address, publicClient } = useEthWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchBalance() {
      if (!address) {
        setBalance(null);
        return;
      }
      const raw = await publicClient.getBalance({ address });
      if (mounted) setBalance(formatEther(raw));
    }
    void fetchBalance();
    return () => {
      mounted = false;
    };
  }, [address, publicClient]);

  if (!address || !balance) return null;
  return <span className="text-xs text-gray-400">{Number(balance).toFixed(4)} ETH</span>;
};

export function useEthWallet() {
  const context = useContext(EthContext);
  if (!context) {
    throw new Error("useEthWallet must be used within EthProvider");
  }
  return context;
}

export function EthProvider({ children }: { children: ReactNode }) {
  const { rpcUrls, chainId: envChainId, gameFactoryAddress } = getClientEnv();
  const [chainId, setChainId] = useState<number>(envChainId);
  const [address, setAddress] = useState<Address | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [resolvedGameItemsAddress, setResolvedGameItemsAddress] = useState<Address | null>(null);

  useEffect(() => {
    setProvider(getInjectedProvider());
  }, []);

  const walletClient = useMemo(() => {
    if (!provider) return null;
    return createWalletClient({
      transport: custom(provider as never),
      chain: chainId === foundry.id ? foundry : sepolia,
    });
  }, [provider, chainId]);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: chainId === foundry.id ? foundry : sepolia,
        transport:
          rpcUrls.length > 1
            ? fallback(rpcUrls.map((url) => http(url)))
            : http(rpcUrls[0]),
      }),
    [chainId, rpcUrls]
  );

  const connect = async () => {
    const injected = getInjectedProvider();
    if (!injected) throw new Error("No injected Ethereum provider found.");
    setProvider(injected);

    const accounts = (await injected.request({
      method: "eth_requestAccounts",
    })) as string[];
    const selected = accounts[0];
    if (!selected || !isAddress(selected)) throw new Error("No wallet account returned.");
    setAddress(selected);
  };

  const disconnect = () => {
    setAddress(null);
  };

  const switchChain = async (nextChainId: number) => {
    const provider = getInjectedProvider();
    if (!provider) return;
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(nextChainId) }],
    });
    const currentHex = (await provider.request({ method: "eth_chainId" })) as string;
    if (typeof currentHex === "string") {
      setChainId(parseInt(currentHex, 16));
    }
  };

  useEffect(() => {
    if (!provider?.on || !provider.removeListener) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) ? accounts[0] : null;
      if (typeof next === "string" && isAddress(next)) {
        setAddress(next);
      } else {
        disconnect();
      }
    };

    const handleChainChanged = (nextChainHex: unknown) => {
      if (typeof nextChainHex !== "string") return;
      setChainId(parseInt(nextChainHex, 16));
    };

    const hydrateConnectedAccount = async () => {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const selected = accounts[0];
      if (selected && isAddress(selected)) {
        setAddress(selected);
      }
      const currentHex = (await provider.request({ method: "eth_chainId" })) as string;
      if (typeof currentHex === "string") {
        setChainId(parseInt(currentHex, 16));
      }
    };
    void hydrateConnectedAccount();

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  useEffect(() => {
    let mounted = true;
    const factory = toAddressOrNull(gameFactoryAddress);
    if (!factory) {
      setResolvedGameItemsAddress(null);
      return () => {
        mounted = false;
      };
    }

    const resolveFromFactory = async () => {
      try {
        const onChainAddress = await publicClient.readContract({
          address: factory,
          abi: GAME_FACTORY_ABI,
          functionName: "gameItems",
        });
        if (mounted) {
          setResolvedGameItemsAddress(toAddressOrNull(onChainAddress));
        }
      } catch {
        if (mounted) setResolvedGameItemsAddress(null);
      }
    };
    void resolveFromFactory();
    return () => {
      mounted = false;
    };
  }, [gameFactoryAddress, publicClient]);

  const value: EthProviderValue = {
    address,
    chainId,
    targetChainId: envChainId,
    connect,
    disconnect,
    switchChain,
    walletClient,
    publicClient,
    gameItemsAddress: resolvedGameItemsAddress,
  };

  return <EthContext.Provider value={value}>{children}</EthContext.Provider>;
}
