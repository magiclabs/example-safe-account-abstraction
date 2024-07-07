import { useEffect, useCallback, useState } from "react";
import { useMagic } from "../magic/MagicProvider";
import { SmartAccountClient } from "permissionless";
import { providerToSmartAccountSigner } from "permissionless";
import {
  ENTRYPOINT_ADDRESS_V07,
  createSmartAccountClient,
} from "permissionless";
import { signerToSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { http } from "viem";
import { sepolia } from "viem/chains";
import { ENTRYPOINT_ADDRESS_V07_TYPE } from "permissionless/_types/types";

export const useSafeProvider = () => {
  const { magic, publicClient } = useMagic();
  const [smartClient, setSmartClient] =
    useState<SmartAccountClient<ENTRYPOINT_ADDRESS_V07_TYPE>>();
  const connectToSmartContractAccount = useCallback(async () => {
    if (!magic || !publicClient) return;

    const magicProvider = await magic.wallet.getProvider();
    const smartAccountSigner =
      await providerToSmartAccountSigner(magicProvider);

    const smartAccount = await signerToSafeSmartAccount(publicClient, {
      signer: smartAccountSigner,
      safeVersion: "1.4.1",
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    });

    const pimlicoBundlerClient = createPimlicoBundlerClient({
      transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    });

    const paymasterClient = createPimlicoPaymasterClient({
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`),
    })
    
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: sepolia,
      bundlerTransport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`, {
        timeout: 30_000,
      }),
      middleware: {
        sponsorUserOperation: paymasterClient.sponsorUserOperation, // optional
        gasPrice: async () =>
          (await pimlicoBundlerClient.getUserOperationGasPrice()).standard, // if using pimlico bundler
      },
    });

    setSmartClient(smartAccountClient);
  }, [magic, publicClient]);

  useEffect(() => {
    if (magic?.user.isLoggedIn) {
      connectToSmartContractAccount();
    }
  }, [magic?.user.isLoggedIn, connectToSmartContractAccount]);

  return {
    smartClient,
  };
};