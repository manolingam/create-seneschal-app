'use client';

// lib imports

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import {
  useWaitForTransaction,
  useContractWrite,
  useContractRead,
  useAccount
} from 'wagmi';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  Loader2,
  ExternalLink,
  ImageOff,
  RotateCw,
  ConciergeBell
} from 'lucide-react';
import { formatEther } from 'viem';
import axios from 'axios';

// file imports

import { getAccountString, getArweaveTxId } from '@/lib/helpers';
import { useQuery, useLazyQuery } from '@apollo/client';
import { GetProposals } from '@/graphql/queries';
import { CountdownTimer } from './CountdownTimer';
import {
  EXPLORER_BASE_URL,
  IPFS_BASE_GATEWAY,
  SENESCHAL_CONTRACT_ADDRESS
} from '@/config';
import SeneschalAbi from '../abis/Seneschal.json';

export function PokingForm() {
  const { address } = useAccount();
  const [txSuccess, setTxSuccess] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const { refetch } = useQuery(GetProposals, {
    onCompleted: (data) => decodeHash(data.proposals)
  });

  const [
    getProposalRefetch,
    { data: refetchProposalData, loading: refetchLoading }
  ] = useLazyQuery(GetProposals);

  useEffect(() => {
    if (refetchProposalData) {
      decodeHash(refetchProposalData.proposals);
    }
  }, [refetchProposalData]);

  const { data: claimDelay } = useContractRead({
    address: SENESCHAL_CONTRACT_ADDRESS,
    abi: SeneschalAbi,
    functionName: 'getClaimDelay'
  });

  const {
    isLoading: writePending,
    write,
    data: writeData
  } = useContractWrite({
    address: SENESCHAL_CONTRACT_ADDRESS,
    abi: SeneschalAbi,
    functionName: 'poke',
    onSuccess(data) {
      toast({
        title: 'Mining Transaction',
        description: 'Please do not close the tab.',
        action: (
          <ToastAction
            altText='View Tx'
            onClick={() =>
              window.open(`${EXPLORER_BASE_URL}/tx/${data.hash}`, '_blank')
            }
          >
            View Tx
          </ToastAction>
        )
      });
    },
    onError(err) {
      console.log(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Function call failed.'
      });
    }
  });

  const { isLoading: txPending } = useWaitForTransaction({
    hash: writeData?.hash,
    async onSuccess() {
      toast({
        title: 'Success',
        description: 'Proposal poked.'
      });
      setTxSuccess(true);
      let data = await refetch();
      decodeHash(data.data.proposals);
    }
  });

  const decodeHash = async (_proposals) => {
    let formattedProposals = _proposals.filter(
      (p) => p.status === 'Sponsored' && p.status !== 'Poked'
    );

    for (let i = 0; i < formattedProposals.length; i++) {
      try {
        let { data } = await axios.get(
          `${IPFS_BASE_GATEWAY}/${formattedProposals[i].commitmentDetails.metadata}`
        );

        // Update the proposal object with the fetched metadata.
        formattedProposals[i].metadata = data;
      } catch (error) {
        console.log(error);
      }
    }
    setProposals(formattedProposals);
    setLoading(false);
  };

  const handlePoke = async (_commitment) => {
    let commitmentArray = [
      Number(_commitment.eligibleHat),
      Number(_commitment.shares),
      _commitment.loot,
      Number(_commitment.extraRewardAmount),
      Number(_commitment.timeFactor),
      Number(_commitment.sponsoredTime),
      Number(_commitment.expirationTime),
      _commitment.contextURL,
      _commitment.metadata,
      _commitment.recipient,
      _commitment.extraRewardToken
    ];

    let arweaveResult = await getArweaveTxId(
      _commitment.contextURL.substring(
        _commitment.contextURL.lastIndexOf('/') + 1
      )
    );

    let completionReportTxId = arweaveResult.transactions.edges[0].node.id;

    write({
      args: [commitmentArray, completionReportTxId]
    });
  };

  return (
    <div>
      <Button
        className='mt-2'
        variant='outline'
        disabled={refetchLoading || loading}
        onClick={() => getProposalRefetch()}
      >
        <RotateCw className='mr-2 h-4 w-4' /> Refresh
      </Button>

      {!loading && !refetchLoading && proposals.length > 0 && (
        <div className='grid grid-cols-3 gap-10 mt-12'>
          {proposals.map((proposal, index) => {
            let isEarly =
              Number(claimDelay) +
                Number(proposal.commitmentDetails.sponsoredTime) >
              Date.now() / 1000;

            let contextURL = proposal.commitmentDetails.contextURL;
            let proposalId = proposal.id;
            let proposalImage = proposal.metadata.proposalImage;
            let loot = formatEther(proposal.commitmentDetails.loot);
            let recipient = proposal.recipient;
            let sponsoredTime = new Date(
              Number(proposal.commitmentDetails.sponsoredTime * 1000)
            ).toLocaleString();
            let timeFactor = new Date(
              Number(proposal.commitmentDetails.timeFactor) * 1000
            ).toLocaleString();

            let proposalSummary = proposal.metadata.proposalSummary;
            let proposalTitle =
              proposal.metadata.proposalTitle ||
              `SDS #${proposalId
                .substring(proposalId.length - 4)
                .toUpperCase()}`;
            let commitmentDetails = proposal.commitmentDetails;

            return (
              <Card key={index}>
                <CardHeader>
                  <div
                    className='flex flex-row items-center justify-between mb-2'
                    onClick={() => window.open(contextURL, '_blank')}
                  >
                    <div className='flex flex-row items-center cursor-pointer underline '>
                      <CardTitle className='mr-2'>{proposalTitle}</CardTitle>
                      <ExternalLink className='w-4 h-4' />
                    </div>

                    <CountdownTimer
                      timeFactor={Number(proposal.commitmentDetails.timeFactor)}
                      delay={
                        Number(claimDelay) +
                        Number(proposal.commitmentDetails.sponsoredTime)
                      }
                    />
                  </div>

                  <CardDescription
                    onClick={() => window.open(contextURL, '_blank')}
                    className='hover:opacity-75 cursor-pointer'
                  >
                    <div className='relative'>
                      <div className='h-40 mt-4 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-lg bg-white'>
                        {proposalImage ? (
                          <img
                            id='preview_img'
                            className='h-40 w-full object-cover'
                            src={`${IPFS_BASE_GATEWAY}/${proposalImage}`}
                          />
                        ) : (
                          <ImageOff className='h-16 w-16 ' />
                        )}
                      </div>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4'>
                  <div className='grid grid-cols-2 '>
                    <div className='mb-4 grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0'>
                      <div className='space-y-1'>
                        <p className='text-xs text-muted-foreground '>
                          Loot Amount
                        </p>
                        <p className='text-sm font-medium '>{loot}</p>
                      </div>
                    </div>
                    <div className='mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0'>
                      <div className='space-y-1'>
                        <p className='text-xs text-muted-foreground '>
                          Recipient
                        </p>
                        <p
                          className='text-sm font-medium cursor-pointer underline hover:opacity-95'
                          onClick={() =>
                            window.open(
                              `${EXPLORER_BASE_URL}/address/${recipient}`,
                              '_blank'
                            )
                          }
                        >
                          {address.toLowerCase() === recipient.toLowerCase()
                            ? 'You'
                            : getAccountString(recipient)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='grid grid-cols-1 '>
                    <div>
                      <div className='space-y-1'>
                        <p className='text-xs text-muted-foreground '>
                          Sponsored Time
                        </p>
                        <p className='text-xs font-medium '>{sponsoredTime}</p>
                      </div>
                    </div>

                    <div className='mt-4'>
                      <div className='space-y-1'>
                        <p className='text-xs text-muted-foreground'>
                          Cannot be witnessed after
                        </p>
                        <p className='text-xs font-medium '>{timeFactor}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <AlertDialog
                    onOpenChange={async (e) => {
                      if (!e && txSuccess) {
                        setTxSuccess(false);
                      }
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        className='w-full'
                        variant={
                          isEarly ||
                          address.toLowerCase() !== recipient.toLowerCase()
                            ? 'outline'
                            : 'default'
                        }
                        disabled={
                          isEarly ||
                          address.toLowerCase() !== recipient.toLowerCase()
                        }
                      >
                        <ConciergeBell className='mr-2 h-4 w-4' />
                        {address.toLowerCase() !== recipient.toLowerCase()
                          ? 'Cannot Poke'
                          : 'Poke'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{proposalTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          <div>
                            <p>
                              {proposalSummary
                                ? proposalSummary
                                : 'No proposal summary found.'}
                            </p>
                            <div className='flex flex-col mt-4'>
                              <p className='mb-2 text-sm font-semibold'>
                                Completion Report
                              </p>
                              <div>
                                <Input
                                  className='mb-2'
                                  disabled
                                  value={contextURL}
                                />
                                <p className='text-xs text-muted-foreground mb-4'>
                                  Make sure to update the proposal article with
                                  updates before poking.
                                </p>
                                <Button
                                  variant='secondary'
                                  onClick={() =>
                                    window.open(contextURL, '_blank')
                                  }
                                >
                                  View proposal
                                </Button>
                              </div>
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={writePending || txPending}>
                          {!txSuccess ? 'Cancel' : 'Close'}
                        </AlertDialogCancel>
                        {!txSuccess && (
                          <Button
                            disabled={writePending || txPending}
                            onClick={() => {
                              handlePoke(commitmentDetails);
                            }}
                          >
                            {(writePending || txPending) && (
                              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                            )}

                            {writePending || txPending
                              ? 'Pending transaction'
                              : 'Poke'}
                          </Button>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {(loading || refetchLoading || !proposals) && (
        <div className='h-96 flex flex-row items-center justify-center'>
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          <p>Fetching proposals. Please wait</p>
        </div>
      )}

      {!loading && !refetchLoading && proposals.length == 0 && (
        <div className='h-96 flex flex-row items-center justify-center'>
          <p>No proposals to poke.</p>
        </div>
      )}
    </div>
  );
}
