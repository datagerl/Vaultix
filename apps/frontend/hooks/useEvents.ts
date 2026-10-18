import { useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { IEscrowEventFilters, IEscrowEventResponse } from '@/types/escrow';
import { EscrowService } from '@/services/escrow';
import { useWebSocket } from '@/app/contexts/WebSocketContext';
import { joinEscrowRoom, leaveEscrowRoom, storeEscrowCursor } from '@/lib/websocket';

interface UseEventsParams extends Omit<IEscrowEventFilters, 'page'> {
    refetchInterval?: number | false;
}

export const useEvents = (params: UseEventsParams = {}) => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useWebSocket();
    const query = useInfiniteQuery<
        IEscrowEventResponse,
        Error,
        InfiniteData<IEscrowEventResponse>,
        readonly unknown[],
        number
    >({
        queryKey: ['events', params],
        queryFn: async ({ pageParam }) => {
            const response = await EscrowService.getEvents({
                ...params,
                page: pageParam,
            });
            return response;
        },
        getNextPageParam: (lastPage) => {
            return lastPage.hasNextPage ? lastPage.page + 1 : undefined;
        },
        initialPageParam: 1,
        refetchInterval: params.refetchInterval ?? false,
    });

    useEffect(() => {
        const escrowId = params.escrowId;
        if (!escrowId || !socket || !isConnected) return;

        const handleEvent = (event: { cursor?: string }) => {
            storeEscrowCursor(escrowId, event.cursor);
            void queryClient.invalidateQueries({ queryKey: ['events'] });
        };

        socket.on('escrow.event', handleEvent);
        joinEscrowRoom(socket, escrowId);

        return () => {
            socket.off('escrow.event', handleEvent);
            leaveEscrowRoom(socket, escrowId);
        };
    }, [params.escrowId, socket, isConnected, queryClient]);

    useEffect(() => {
        const resetEventsOnIdentityChange = () => {
            void queryClient.resetQueries({ queryKey: ['events'] });
        };

        window.addEventListener('auth:session-cleared', resetEventsOnIdentityChange);
        return () => {
            window.removeEventListener('auth:session-cleared', resetEventsOnIdentityChange);
        };
    }, [queryClient]);

    return query;
};
