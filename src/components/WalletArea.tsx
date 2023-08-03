import { type Nft } from 'alchemy-sdk';
import { useMetaMask } from 'metamask-react';
import { useEffect, useMemo, useState } from 'react';
import { FaEthereum, FaSignOutAlt } from 'react-icons/fa';
import { styled } from 'styled-components';
import tw from 'twin.macro';
import { useSessionStorage } from '../hooks/utils/useLocalStorage';
import { useAddressVerified } from '../services/addressService';
import { getAlchemy } from '../services/alchemyService';
import { getBackend } from '../services/backendService';
import useIdentity, { logout } from '../services/userService';
import { handleError, handlePromise } from '../utils/handlers';
import { LoginAreaButton } from './LoginArea';

const FormContainer = styled.form`
  input[type='text'],
  input[type='number'],
  textarea {
    ${tw`w-full border-2 p-2 rounded-lg`}
  }
`;

export const WalletAreaButton = tw.div`flex items-center gap-2 px-4 py-2 border-2 text-lg rounded-full cursor-pointer select-none bg-[#fff8] hover:bg-gray-100`;

export default function WalletArea() {
  const user = useIdentity();
  const { status, connect, account, ethereum } = useMetaMask();
  const [nftUrl, setNftUrl] = useSessionStorage('ic-eth.nft-url', '');
  const [nftResult, setNftResult] = useState<{ nft: Nft } | { err: string }>();
  const [nftValid, setNftValid] = useState<boolean>();

  const address = (ethereum.selectedAddress as string) || '';
  const [isAddressVerified, verifyAddress] = useAddressVerified(
    address,
    ethereum,
  );

  const parseNft = (nftUrl: string) => {
    const groups =
      /https:\/\/(testnets\.)?opensea.io\/assets\/(\w+)\/(\w+)\/(\d+)/.exec(
        nftUrl,
      );
    if (!groups) {
      return;
    }
    const [, , network, address, tokenId] = groups;
    return {
      network,
      address,
      tokenId: Number(tokenId),
    };
  };

  const nftInfo = useMemo(() => parseNft(nftUrl), [nftUrl]);

  useEffect(() => {
    if (nftInfo) {
      setNftValid(undefined);
      handlePromise(
        (async () => {
          try {
            const nft = await getAlchemy(
              `eth-${nftInfo.network}` as any,
            ).nft.getNftMetadata(nftInfo.address, nftInfo.tokenId, {});
            setNftResult({ nft });

            try {
              setNftValid(
                await getBackend().setNfts([
                  {
                    contract: nftInfo.address,
                    network: nftInfo.network,
                    tokenId: BigInt(nftInfo.tokenId),
                    owner: address,
                  },
                ]),
              );
            } catch (err) {
              handleError(err, 'Error while verifying NFT ownership!');
              setNftValid(false);
            }
          } catch (err) {
            console.warn(err);
            setNftResult({ err: String(err) });
          }
        })(),
      );
    }
  }, [address, ethereum, nftInfo]);

  const getMetaMaskButton = () => {
    if (status === 'notConnected') {
      return (
        <WalletAreaButton onClick={connect}>
          <FaEthereum />
          Connect to MetaMask
        </WalletAreaButton>
      );
    }
    if (status === 'initializing') {
      return <div tw="opacity-60">Initializing...</div>;
    }
    if (status === 'connecting') {
      return <div tw="opacity-60">Connecting...</div>;
    }
    if (status === 'connected') {
      return (
        <div tw="flex flex-col md:flex-row items-start md:items-center gap-2">
          <div tw="flex-1 text-xl text-gray-600">
            <div tw="flex items-center gap-2">
              {/* <FaEthereum tw="hidden sm:block text-3xl" /> */}
              <div>
                Ethereum address:
                <div tw="text-xs sm:text-sm font-bold mt-1">{account}</div>
              </div>
            </div>
          </div>
          {isAddressVerified === false && (
            <div tw="flex flex-col items-center mt-3 sm:mt-0">
              <LoginAreaButton
                tw="flex gap-1 items-center text-base px-4"
                onClick={() => verifyAddress()}
              >
                <FaEthereum />
                <span tw="font-semibold select-none ml-1">Verify wallet</span>
              </LoginAreaButton>
            </div>
          )}
        </div>
      );
    }
    return (
      <div>
        <a
          tw="text-blue-500"
          href="https://metamask.io/"
          target="_blank"
          rel="noreferrer"
        >
          MetaMask is required for this Dapp
        </a>
      </div>
    );
  };

  return (
    <>
      {!!user && (
        <>
          <div tw="flex flex-col md:flex-row items-start md:items-center gap-2">
            <div tw="flex-1 text-xl text-gray-600">
              Internet Computer principal:
              <div tw="text-xs sm:text-sm font-bold mt-1">
                {user.client.getIdentity().getPrincipal().toString()}
              </div>
            </div>
            <div tw="flex flex-col items-center mt-3 sm:mt-0">
              <LoginAreaButton
                tw="flex gap-1 items-center text-base px-4"
                onClick={() =>
                  handlePromise(logout(), undefined, 'Error while signing out!')
                }
              >
                <FaSignOutAlt />
                <span tw="font-semibold select-none ml-1">Sign out</span>
              </LoginAreaButton>
            </div>
          </div>
          <hr tw="my-5" />
        </>
      )}
      <div tw="mx-auto">{getMetaMaskButton()}</div>
      <hr tw="my-5" />
      <FormContainer>
        <label>
          <div tw="text-xl text-gray-600 mb-1">OpenSea NFT:</div>
          <input
            css={
              nftInfo && [
                nftValid === true
                  ? tw`border-green-500`
                  : nftValid === false
                  ? tw`border-red-500`
                  : tw`border-yellow-500`,
              ]
            }
            type="text"
            placeholder="Paste URL here"
            value={nftUrl}
            onChange={(e) => setNftUrl(e.target.value)}
          />
        </label>
        {nftInfo && nftResult ? (
          <>
            {'nft' in nftResult && (
              <div tw="mt-3 max-w-[500px] mx-auto">
                <NftView nft={nftResult.nft} />
              </div>
            )}
            {'err' in nftResult && <div tw="text-red-600">{nftResult.err}</div>}
          </>
        ) : (
          <a
            tw="text-blue-500"
            href="https://opensea.io/account"
            target="_blank"
            rel="noreferrer"
          >
            Account page
          </a>
        )}
      </FormContainer>
    </>
  );
}

function NftView({ nft }: { nft: Nft }) {
  return (
    <div tw="p-5 sm:p-6 bg-white rounded-xl space-y-3 drop-shadow-2xl">
      {!!nft.title && (
        <div tw="text-2xl sm:text-3xl font-bold">{nft.title}</div>
      )}
      {!!nft.media.length && (
        <img
          tw="w-full rounded-xl"
          alt="NFT preview"
          src={nft.media[0].gateway}
        />
      )}
      {!!nft.description && <div tw="sm:text-xl">{nft.description}</div>}
    </div>
  );
}
