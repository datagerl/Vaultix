import { act, renderHook, waitFor } from '@testing-library/react';
import { useEvents } from './useEvents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { EscrowService } from '@/services/escrow';

jest.mock('@/services/escrow', () => ({
  EscrowService: { getEvents: jest.fn() },
}));

const event = { id: 'event-1', eventType: 'COMPLETED', createdAt: '2025-01-01' };

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EscrowService.getEvents as jest.Mock).mockResolvedValue({
      events: [event],
      hasNextPage: false,
      totalCount: 1,
      page: 1,
      limit: 10,
    });
  });

  it('fetches events on mount', async () => {
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    expect(result.current.data?.pages[0].events.length).toBeGreaterThan(0);
    expect(result.current.data?.pages[0].events[0].eventType).toBeDefined();
  });

  it('filters events by type', async () => {
    const { result } = renderHook(() => useEvents({ eventType: 'COMPLETED' }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

    const events = result.current.data?.pages[0].events;
    expect(events?.every(e => e.eventType === 'COMPLETED')).toBe(true);
  });

  it('starts from the first page when the event filter changes', async () => {
    const { rerender } = renderHook(
      ({ eventType }) => useEvents({ eventType }),
      {
        initialProps: { eventType: 'FUNDED' },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(EscrowService.getEvents).toHaveBeenCalledTimes(1));

    rerender({ eventType: 'COMPLETED' });

    await waitFor(() => {
      expect(EscrowService.getEvents).toHaveBeenCalledTimes(2);
      expect(EscrowService.getEvents).toHaveBeenLastCalledWith({
        eventType: 'COMPLETED',
        page: 1,
      });
    });
  });

  it('requests subsequent pages with the next page number and stops at metadata boundary', async () => {
    (EscrowService.getEvents as jest.Mock)
      .mockResolvedValueOnce({
        events: [event],
        hasNextPage: true,
        totalCount: 3,
        page: 1,
        limit: 1,
      })
      .mockResolvedValueOnce({
        events: [{ ...event, id: 'event-2' }],
        hasNextPage: true,
        totalCount: 3,
        page: 2,
        limit: 1,
      })
      .mockResolvedValueOnce({
        events: [{ ...event, id: 'event-3' }],
        hasNextPage: false,
        totalCount: 3,
        page: 3,
        limit: 1,
      });

    const { result } = renderHook(() => useEvents({ limit: 1 }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);
    let nextPageResult:
      | Awaited<ReturnType<typeof result.current.fetchNextPage>>
      | undefined;
    await act(async () => {
      nextPageResult = await result.current.fetchNextPage();
    });
    expect(nextPageResult?.data?.pages).toHaveLength(2);
    expect(nextPageResult?.hasNextPage).toBe(true);

    let thirdPageResult:
      | Awaited<ReturnType<typeof result.current.fetchNextPage>>
      | undefined;
    await act(async () => {
      thirdPageResult = await result.current.fetchNextPage();
    });
    expect(thirdPageResult?.data?.pages).toHaveLength(3);
    expect(thirdPageResult?.hasNextPage).toBe(false);

    expect(EscrowService.getEvents).toHaveBeenNthCalledWith(1, {
      limit: 1,
      page: 1,
    });
    expect(EscrowService.getEvents).toHaveBeenNthCalledWith(2, {
      limit: 1,
      page: 2,
    });
    expect(EscrowService.getEvents).toHaveBeenNthCalledWith(3, {
      limit: 1,
      page: 3,
    });
  });

  it('clears cached activity when the authenticated identity is cleared', async () => {
    const { result } = renderHook(() => useEvents(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(EscrowService.getEvents).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('auth:session-cleared'));

    await waitFor(() => expect(EscrowService.getEvents).toHaveBeenCalledTimes(2));
  });
});
