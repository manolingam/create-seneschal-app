import { ethers } from 'ethers';
import { File } from 'nft.storage';
import { parseEther } from 'viem';
import axios from 'axios';

import { SENESCHAL_CONTRACT_ADDRESS, NFT_STORAGE } from '@/config';

// const digestMessage = async (proposalDigest) => {
//   const msgUint8 = new TextEncoder().encode(proposalDigest);
//   const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
//   const hashArray = Array.from(new Uint8Array(hashBuffer));
//   return hashArray;
// };

export const getAccountString = (account) => {
  const len = account.length;
  return `0x${account.substr(2, 3).toUpperCase()}...${account
    .substr(len - 3, len - 1)
    .toUpperCase()}`;
};

export const formatCommitment = (values) => {
  const CLAIM_DELAY = 270;

  const SHARES = 0;
  const ELIGIBLE_HAT = 0;
  const EXTRA_REWARD_AMOUNT = 0;
  const EXTRA_REWARD_TOKEN_ADDRESS = ethers.constants.AddressZero;
  const SPONSORED_TIME = 0;

  // const TIME_FACTOR =
  //   Math.round(Date.now() / 1000) + 24 * 60 * 60 + CLAIM_DELAY;

  let loot = parseEther(values.loot);

  let expirationTime = Math.round(
    new Date(values.expirationDate).getTime() / 1000
  );
  let timeFactor = Math.round(new Date(values.timeFactor).getTime() / 1000);
  let contextURL = values.proposalUrl;
  let metadata = values.ipfsHash;
  let recipient = values.recipientWallet;

  let commitment = [
    ELIGIBLE_HAT,
    SHARES,
    loot,
    EXTRA_REWARD_AMOUNT,
    timeFactor,
    SPONSORED_TIME,
    expirationTime,
    contextURL,
    metadata,
    recipient,
    EXTRA_REWARD_TOKEN_ADDRESS
  ];

  return commitment;
};

export const pinToIpfs = async (
  proposalImgData,
  contextURL,
  arweaveTx,
  proposalTitle,
  summary
) => {
  let metadata = {
    proposalImage: '',
    contextURL: contextURL,
    arweaveTx: arweaveTx,
    proposalTitle: proposalTitle,
    proposalSummary: summary
  };

  const response = await fetch(proposalImgData);
  const blob = await response.blob();

  let imgBlob = new File([blob], 'file.png', { type: 'image/png' });

  let ipfsImgHash = await NFT_STORAGE.storeBlob(imgBlob);

  const proposalImageHash = `${ipfsImgHash}`;
  metadata['proposalImage'] = proposalImageHash;

  const objectString = JSON.stringify(metadata);
  const metadataBlob = new Blob([objectString], { type: 'application/json' });

  let result = await NFT_STORAGE.storeBlob(metadataBlob);

  return result;
};

export const getTypes = async (commitment) => {
  try {
    const domain = {
      name: 'Seneschal',
      version: '1.0',
      chainId: 100,
      verifyingContract: SENESCHAL_CONTRACT_ADDRESS
    };

    const types = {
      Commitment: [
        { name: 'eligibleHat', type: 'uint256' },
        { name: 'shares', type: 'uint256' },
        { name: 'loot', type: 'uint256' },
        { name: 'extraRewardAmount', type: 'uint256' },
        { name: 'timeFactor', type: 'uint256' },
        { name: 'sponsoredTime', type: 'uint256' },
        { name: 'expirationTime', type: 'uint256' },
        { name: 'contextURL', type: 'string' },
        { name: 'metadata', type: 'string' },
        { name: 'recipient', type: 'address' },
        { name: 'extraRewardToken', type: 'address' }
      ]
    };

    return {
      domain,
      types,
      values: {
        eligibleHat: commitment[0],
        shares: commitment[1],
        loot: commitment[2],
        extraRewardAmount: commitment[3],
        timeFactor: commitment[4],
        sponsoredTime: commitment[5],
        expirationTime: commitment[6],
        contextURL: commitment[7],
        metadata: commitment[8],
        recipient: commitment[9],
        extraRewardToken: commitment[10]
      }
    };
  } catch (err) {
    console.log(err);
  }
};

export const getArweaveTxId = async (_digest) => {
  const GetMirrorTransactions = `
    query fetchMirrorTransactions($digest: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["MirrorXYZ"] }
          { name: "Original-Content-Digest", values: [$digest] }
        ]
        sort: HEIGHT_DESC
        first: 1
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const endpoint = 'https://arweave.net/graphql';

  const graphqlQuery = {
    operationName: 'fetchMirrorTransactions',
    query: GetMirrorTransactions,
    variables: {
      digest: _digest
    }
  };

  try {
    const { data } = await axios.post(endpoint, graphqlQuery, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = data.data;
    return result;
  } catch (err) {
    console.log(err);
  }
};
