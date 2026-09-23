import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, httpApiClient } from './http-client';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('httpApiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    assign.mockReset();
  });

  const lastInit = () => fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
  const lastHeaders = () => lastInit().headers as Record<string, string>;

  it('sends the CSRF header on state-changing requests', async () => {
    fetchMock.mockResolvedValue(json(204, undefined));
    await httpApiClient.deleteApplication('abc');
    expect(lastInit().method).toBe('DELETE');
    expect(lastHeaders()['X-Requested-With']).toBe('fetch');
  });

  it('sends the CSRF header and JSON body on POSTs', async () => {
    fetchMock.mockResolvedValue(json(204, undefined));
    await httpApiClient.logout();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('/api/v1/auth/logout');
    expect(lastHeaders()['X-Requested-With']).toBe('fetch');
  });

  it('redirects to the login page when the session is gone', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'Unauthorized' }));
    await expect(httpApiClient.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/login?error=session');
  });

  it('surfaces API error messages and validation issues', async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        message: 'Validation failed',
        issues: [{ path: 'companyName', message: 'Required' }],
      }),
    );
    const error = await httpApiClient.createApplication({} as never).then(
      () => {
        throw new Error('expected the request to fail');
      },
      (e: unknown) => e as ApiError,
    );
    expect(error).toMatchObject({ status: 400, message: 'Validation failed' });
    expect(error.issues).toEqual([{ path: 'companyName', message: 'Required' }]);
  });

  it('rejects responses that do not match the contract', async () => {
    fetchMock.mockResolvedValue(json(200, { connected: 'yes' }));
    await expect(httpApiClient.getGmailStatus()).rejects.toThrow();
  });

  it('maps unknown ids to null instead of throwing', async () => {
    fetchMock.mockResolvedValue(json(404, { message: 'Application not found' }));
    await expect(httpApiClient.getApplication('missing')).resolves.toBeNull();
  });

  it('serialises list filters as the API expects', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [], total: 0, page: 1, pageSize: 20 }));
    await httpApiClient.listApplications({
      status: ['APPLIED', 'OFFER'],
      activeOnly: true,
      sortBy: 'company',
      sortDir: 'asc',
      page: 1,
      pageSize: 20,
    });
    const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://x');
    expect(url.pathname).toBe('/api/v1/applications');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      status: 'APPLIED,OFFER',
      activeOnly: 'true',
      sortBy: 'company',
    });
  });

  describe('while the API wakes up', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retries reads on gateway errors and announces it once', async () => {
      const waking = vi.fn();
      window.addEventListener('jat:server-waking', waking);
      fetchMock
        .mockResolvedValueOnce(json(502, {}))
        .mockRejectedValueOnce(new TypeError('network'))
        .mockResolvedValueOnce(
          json(200, { id: 'u', email: 'me@example.com', name: null, avatarUrl: null }),
        );

      const assertion = expect(httpApiClient.getCurrentUser()).resolves.toMatchObject({ id: 'u' });
      await vi.runAllTimersAsync();
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(waking).toHaveBeenCalledTimes(1);
      window.removeEventListener('jat:server-waking', waking);
    });

    it('never retries writes (the first attempt may have reached the server)', async () => {
      fetchMock.mockResolvedValue(json(503, { message: 'Service Unavailable' }));
      await expect(httpApiClient.deleteApplication('abc')).rejects.toMatchObject({ status: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
