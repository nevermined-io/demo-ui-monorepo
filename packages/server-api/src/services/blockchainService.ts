import { ethers, Contract } from "ethers";

/** Returns an ethers JSON-RPC provider instance. */
export const getProvider = () =>
  new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

/** Returns the current block number. */
export async function getCurrentBlockNumber(): Promise<number> {
  const provider = getProvider();
  return provider.getBlockNumber();
}

/** Checks if the given wallet has enough balance of the given ERC20 token. */
export async function hasSufficientERC20Balance(
  tokenAddress: string,
  walletAddress: string,
  requiredAmount: string
): Promise<boolean> {
  const provider = getProvider();
  const tokenContract = new Contract(
    tokenAddress,
    [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    provider
  );
  const balance = await tokenContract.balanceOf(walletAddress);
  return balance.gte(requiredAmount);
}

/** Finds the mint event for credits (ERC1155 TransferSingle with from=0x0). */
export async function findMintEvent(
  contractAddress: string,
  toWallet: string,
  tokenId: string,
  fromBlock: number | string = 0
): Promise<{ txHash: string; value: string } | null> {
  const provider = getProvider();
  const ERC1155_ABI = [
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  ];
  const contract = new Contract(contractAddress, ERC1155_ABI, provider);
  const mintAddress = "0x0000000000000000000000000000000000000000";
  const filter = (contract as any).filters.TransferSingle(
    null,
    mintAddress,
    toWallet
  );
  const events = await contract.queryFilter(filter, fromBlock, "latest");
  const filtered = events.find(
    (ev: any) => ev.args && ev.args.id.toString() === tokenId
  );
  if (filtered && filtered.args) {
    return {
      txHash: filtered.transactionHash,
      value: filtered.args.value.toString(),
    };
  }
  return null;
}

/** Finds the burn event for credits (ERC1155 TransferSingle with to=0x0). */
export async function findBurnEvent(
  contractAddress: string,
  fromWallet: string,
  tokenId: string,
  fromBlock: number | string = 0
): Promise<{ txHash: string; value: string } | null> {
  const provider = getProvider();
  const ERC1155_ABI = [
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  ];
  const contract = new Contract(contractAddress, ERC1155_ABI, provider);
  const burnAddress = "0x0000000000000000000000000000000000000000";
  const filter = (contract as any).filters.TransferSingle(
    null,
    fromWallet,
    burnAddress
  );
  const events = await contract.queryFilter(filter, fromBlock, "latest");
  const filtered = events.find(
    (ev: any) => ev.args && ev.args.id.toString() === tokenId
  );
  if (filtered && filtered.args) {
    return {
      txHash: filtered.transactionHash,
      value: filtered.args.value.toString(),
    };
  }
  return null;
}
