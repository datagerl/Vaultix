import { EscrowService } from './escrow-api';
import { apiClient } from '@/lib/api-client';
import { CanonicalEscrowStatus } from '@/utils/escrowStatus';

jest.mock('@/lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const rawEscrow = (status: unknown) => ({
  id: 'escrow-1',
  title: 'Test',
  description: 'Test',
  amount: '100',
  asset: 'XLM',
  creatorAddress: 'G1',
  counterpartyAddress: 'G2',
  deadline: '2030-01-01',
  status,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
});

describe('EscrowService status normalization at the API boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getEscrows', () => {
    it('normalizes every status in the list response', async () => {
      get.mockResolvedValue({
        escrows: [
          rawEscrow('pending'),
          rawEscrow('active'),
          rawEscrow('expired'),
          rawEscrow('refunded'),
          rawEscrow('cancelled'),
          rawEscrow('disputed'),
          rawEscrow('completed'),
        ],
        hasNextPage: false,
      });

      const result = await EscrowService.getEscrows();

      expect(result.escrows.map((e) => e.status)).toEqual([
        CanonicalEscrowStatus.CREATED,
        CanonicalEscrowStatus.ACTIVE,
        CanonicalEscrowStatus.EXPIRED,
        CanonicalEscrowStatus.REFUNDED,
        CanonicalEscrowStatus.CANCELLED,
        CanonicalEscrowStatus.DISPUTED,
        CanonicalEscrowStatus.COMPLETED,
      ]);
    });

    it('maps an unfamiliar future status to UNKNOWN rather than passing it through', async () => {
      get.mockResolvedValue({
        escrows: [rawEscrow('in_arbitration')],
        hasNextPage: false,
      });

      const result = await EscrowService.getEscrows();

      expect(result.escrows[0].status).toBe(CanonicalEscrowStatus.UNKNOWN);
    });

    it('preserves non-status fields untouched', async () => {
      get.mockResolvedValue({
        escrows: [rawEscrow('active')],
        hasNextPage: false,
        totalCount: 1,
      });

      const result = await EscrowService.getEscrows();

      expect(result.hasNextPage).toBe(false);
      expect(result.totalCount).toBe(1);
      expect(result.escrows[0].id).toBe('escrow-1');
      expect(result.escrows[0].amount).toBe('100');
    });
  });

  describe('single-escrow responses', () => {
    it.each([
      ['getEscrowById', () => EscrowService.getEscrowById('id'), 'get'],
      ['fundEscrow', () => EscrowService.fundEscrow('id', { amount: '1', asset: 'XLM' }), 'post'],
      ['releaseFunds', () => EscrowService.releaseFunds('id'), 'post'],
      ['cancelEscrow', () => EscrowService.cancelEscrow('id'), 'post'],
      ['fileDispute', () => EscrowService.fileDispute('id', { reason: 'r' }), 'post'],
      ['createEscrow', () => EscrowService.createEscrow({}), 'post'],
    ])('normalizes the status returned by %s', async (_name, call, verb) => {
      (verb === 'get' ? get : post).mockResolvedValue(rawEscrow('expired'));

      const escrow = await call();

      expect(escrow.status).toBe(CanonicalEscrowStatus.EXPIRED);
    });

    it('fundEscrow sends only the amount the API whitelists', async () => {
      post.mockResolvedValue(rawEscrow('active'));

      await EscrowService.fundEscrow('id', { amount: '100', asset: 'XLM' });

      expect(post).toHaveBeenCalledWith('/escrows/id/fund', { amount: '100' });
    });

    it('releaseFunds posts to the release endpoint without a body', async () => {
      post.mockResolvedValue(rawEscrow('completed'));

      await EscrowService.releaseFunds('id');

      expect(post).toHaveBeenCalledWith('/escrows/id/release');
    });

    it('normalizes a status-missing response to UNKNOWN', async () => {
      get.mockResolvedValue(rawEscrow(undefined));

      const escrow = await EscrowService.getEscrowById('id');

      expect(escrow.status).toBe(CanonicalEscrowStatus.UNKNOWN);
    });
  });

  describe('status filter translation', () => {
    it('sends the backend wire value for a canonical filter', async () => {
      get.mockResolvedValue({ escrows: [], hasNextPage: false });

      await EscrowService.getEscrows({ status: CanonicalEscrowStatus.CREATED });

      expect(get.mock.calls[0][0]).toContain('status=pending');
    });

    it('sends the backend wire value for an expired filter', async () => {
      get.mockResolvedValue({ escrows: [], hasNextPage: false });

      await EscrowService.getEscrows({ status: CanonicalEscrowStatus.EXPIRED });

      expect(get.mock.calls[0][0]).toContain('status=expired');
    });

    it('includes a wallet address filter', async () => {
      get.mockResolvedValue({ escrows: [], hasNextPage: false });

      await EscrowService.getEscrows({ walletAddress: 'GABC' });

      expect(get.mock.calls[0][0]).toContain('walletAddress=GABC');
    });

    it('omits the status param entirely for the "all" sentinel', async () => {
      get.mockResolvedValue({ escrows: [], hasNextPage: false });

      await EscrowService.getEscrows({ status: 'all' });

      expect(get.mock.calls[0][0]).not.toContain('status=');
    });
  });

  describe('getEvents', () => {
    const event = {
      id: 'event-1',
      eventType: 'COMPLETED',
      createdAt: '2025-01-01',
    };

    it('uses the global events endpoint and translates pagination metadata', async () => {
      get.mockResolvedValue({
        data: [event],
        total: 21,
        page: 2,
        limit: 10,
      });

      const result = await EscrowService.getEvents({ page: 2, limit: 10 });

      expect(get).toHaveBeenCalledWith('/events?page=2&limit=10');
      expect(result).toEqual({
        events: [event],
        totalCount: 21,
        page: 2,
        limit: 10,
        hasNextPage: true,
      });
    });

    it('uses the escrow-scoped endpoint and forwards supported filters', async () => {
      get.mockResolvedValue({
        data: [event],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await EscrowService.getEvents({
        escrowId: 'escrow-1',
        page: 1,
        limit: 10,
        eventType: 'COMPLETED',
        actorId: 'actor-1',
        dateFrom: '2025-01-01T00:00:00.000Z',
        dateTo: '2025-01-31T23:59:59.000Z',
        sortBy: 'createdAt',
        sortOrder: 'ASC',
      });

      expect(get).toHaveBeenCalledWith(
        '/escrows/escrow-1/events?page=1&limit=10&eventType=COMPLETED&escrowId=escrow-1&actorId=actor-1&dateFrom=2025-01-01T00%3A00%3A00.000Z&dateTo=2025-01-31T23%3A59%3A59.000Z&sortBy=createdAt&sortOrder=ASC',
      );
      expect(result.hasNextPage).toBe(false);
    });
  });
});
