import { apiRequest } from '../src/api/client';
import { authApi } from '../src/api/authApi';

jest.mock('../src/api/client', () => ({ apiRequest: jest.fn().mockResolvedValue({}) }));
const call = apiRequest as jest.Mock;

describe('authApi', () => {
  beforeEach(() => call.mockClear());

  it('login posts email, password and device to /auth/login', async () => {
    const input = { email: 'a@b.co', password: 'pw', deviceId: 'device-12345678' };
    await authApi.login(input);
    expect(call).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: input });
  });

  it('register posts name too', async () => {
    const input = { email: 'a@b.co', password: 'pw', name: 'Ana', deviceId: 'device-12345678' };
    await authApi.register(input);
    expect(call).toHaveBeenCalledWith('/auth/register', { method: 'POST', body: input });
  });

  it('refresh sends only the refresh token, without an access token', async () => {
    await authApi.refresh('sid.secret');
    expect(call).toHaveBeenCalledWith('/auth/refresh', { method: 'POST', body: { refreshToken: 'sid.secret' } });
  });

  it('logout and me send the access token', async () => {
    await authApi.logout('tok');
    expect(call).toHaveBeenCalledWith('/auth/logout', { method: 'POST', accessToken: 'tok' });
    await authApi.me('tok');
    expect(call).toHaveBeenCalledWith('/auth/me', { accessToken: 'tok' });
  });
});
